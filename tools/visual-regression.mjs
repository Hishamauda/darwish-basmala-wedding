// Visual regression: approved original vs modified build, section by section.
//   node tools/visual-regression.mjs <originalBaseUrl> <modifiedBaseUrl>
// Writes qa/visual-regression/{390,1440}/<section>-{original,modified,diff}.png + report.json
// Same frozen clock, same scroll positions, same waits for both builds.
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const [ORIG, MOD] = [process.argv[2], process.argv[3]];
const OUT = path.join(ROOT, 'qa', 'visual-regression');
const SECTIONS = ['envelope', 'home', 'invitation', 'venue', 'countdown', 'program', 'etiquette', 'prayer', 'finale', 'dock'];
const FIXED_NOW = new Date('2026-11-01T10:00:00Z');

async function capture(base, vw, vh, dir, label, positions) {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: vw, height: vh }, deviceScaleFactor: vw < 800 ? 2 : 1,
    isMobile: vw < 800, hasTouch: vw < 800 });
  const page = await ctx.newPage();
  await page.clock.setFixedTime(FIXED_NOW);
  await page.addInitScript(() => { let s = 42; Math.random = () => ((s = (s * 16807) % 2147483647) / 2147483647); });
  await page.goto(base, { waitUntil: 'networkidle' });
  await page.evaluate(() => document.fonts.ready);
  const shots = {};
  const snap = async (name, opts = {}) => { const f = path.join(dir, `${name}-${label}.png`); await page.screenshot({ path: f, ...opts }); shots[name] = f; };
  await page.waitForTimeout(800);
  await snap('envelope');
  await page.click('#openInvitation');
  await page.waitForTimeout(7000);
  await page.addStyleTag({ content: '.toast{display:none!important}' });
  const dockBox = await page.locator('#dock').boundingBox();
  await snap('dock', { clip: dockBox });
  await page.addStyleTag({ content: '.dock{visibility:hidden!important}' });
  const pos = positions || await page.evaluate((ids) => {
    const max = document.documentElement.scrollHeight - innerHeight; const o = {};
    ids.forEach((id) => { const el = document.getElementById(id); if (el) o[id] = Math.min(el.offsetTop, max); });
    return o;
  }, SECTIONS.filter((s) => !['envelope', 'dock'].includes(s)));
  for (const id of Object.keys(pos)) {
    await page.evaluate((y) => window.scrollTo(0, y), pos[id]);
    await page.waitForTimeout(id === 'prayer' ? 7000 : 4000);
    await snap(id);
  }
  await browser.close();
  return { shots, pos };
}

async function compare(a, b, out) {
  const { execFileSync } = require('child_process');
  const py = `
import json,sys
from PIL import Image, ImageChops
a=Image.open(sys.argv[1]).convert('RGB'); b=Image.open(sys.argv[2]).convert('RGB')
if a.size!=b.size:
    print(json.dumps({'sameSize':False,'a':a.size,'b':b.size})); sys.exit()
d=ImageChops.difference(a,b).convert('L')
m=d.point(lambda v:255 if v>24 else 0)
n=sum(1 for v in m.getdata() if v)
bb=m.getbbox()
hl=a.copy(); red=Image.new('RGB',a.size,(230,30,60)); hl.paste(red,mask=m)
hl.save(sys.argv[3])
print(json.dumps({'sameSize':True,'changedPixels':n,'ratio':n/(a.size[0]*a.size[1]),'bbox':bb}))`;
  return JSON.parse(execFileSync('python3', ['-c', py, a, b, out]).toString());
}

const report = {};
for (const [vw, vh] of [[390, 844], [1440, 900]]) {
  const dir = path.join(OUT, String(vw)); fs.mkdirSync(dir, { recursive: true });
  const o = await capture(ORIG, vw, vh, dir, 'original');
  const m = await capture(MOD, vw, vh, dir, 'modified', o.pos);
  report[vw] = {};
  for (const s of SECTIONS) {
    if (!o.shots[s] || !m.shots[s]) continue;
    report[vw][s] = await compare(o.shots[s], m.shots[s], path.join(dir, `${s}-diff.png`));
    console.log(vw, s.padEnd(11), JSON.stringify(report[vw][s]));
  }
}
fs.writeFileSync(path.join(OUT, 'report.json'), JSON.stringify(report, null, 1));
