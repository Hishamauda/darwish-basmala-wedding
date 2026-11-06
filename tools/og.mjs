// Render the Open Graph preview (1200x630 JPG) and the apple-touch-icon (180x180 PNG) with Playwright.
// Usage: node tools/og.mjs      (requires the `playwright` package and its Chromium)
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sb = { window: {} };
vm.runInNewContext(fs.readFileSync(path.join(ROOT, 'assets/js/config.js'), 'utf8'), sb);
const C = sb.window.WEDDING;
const u = (p) => pathToFileURL(path.join(ROOT, p)).href;

const css = `
@font-face{font-family:"Aref Ruqaa";font-weight:700;src:url(${u('assets/fonts/ArefRuqaa-700.woff2')}) format("woff2")}
@font-face{font-family:"Amiri";font-weight:400;src:url(${u('assets/fonts/Amiri-400.woff2')}) format("woff2")}
@font-face{font-family:"Amiri";font-weight:700;src:url(${u('assets/fonts/Amiri-700.woff2')}) format("woff2")}
*{box-sizing:border-box}html,body{margin:0}
.gold{background:linear-gradient(105deg,#6E5328 0%,#A88348 20%,#C6A66B 34%,#E9D7AE 44%,#C6A66B 54%,#A88348 68%,#8A6A35 84%,#6E5328 100%);
 -webkit-background-clip:text;background-clip:text;color:transparent}`;

const og = `<!doctype html><html dir="rtl"><meta charset="utf-8"><style>${css}
body{width:1200px;height:630px;background:radial-gradient(90% 90% at 50% 40%,#FFFEFB 0%,#FAF8F4 55%,#EFE6D8 100%);
 font-family:Amiri;color:#30251E;position:relative;overflow:hidden;display:flex;flex-direction:column;align-items:center;justify-content:center}
.frame{position:absolute;inset:26px;border:1.5px solid #C6A66B;border-radius:6px}
.frame2{position:absolute;inset:36px;border:1px solid rgba(198,166,107,.5);border-radius:4px}
.c{position:absolute;width:120px}.tl{top:30px;left:30px}.tr{top:30px;right:30px;transform:scaleX(-1)}
.bl{bottom:30px;left:30px;transform:scaleY(-1)}.br{bottom:30px;right:30px;transform:scale(-1,-1)}
.glow{position:absolute;inset:0;background:radial-gradient(38% 46% at 50% 50%,rgba(233,215,174,.55),transparent 70%)}
.seal{width:96px;position:relative;filter:drop-shadow(0 8px 12px rgba(78,58,28,.35))}
.eyebrow{position:relative;font-size:32px;font-weight:700;color:#6E5328;margin-top:6px}
.names{position:relative;font:700 118px/1.35 "Aref Ruqaa";display:flex;gap:28px;align-items:baseline;margin-top:-6px;
 filter:drop-shadow(0 2px 0 rgba(255,255,255,.9))}
.amp{font:400 64px Amiri;color:#A88348}
.bride{font-feature-settings:"jalt" 1}
.div{position:relative;width:420px;margin:2px 0 8px}
.date{position:relative;font-size:36px;font-weight:700}.sep{color:#C6A66B;margin:0 14px}
.venue{position:relative;font-size:30px;color:#6E5328;font-weight:700;margin-top:2px}
</style><body><div class="glow"></div><div class="frame"></div><div class="frame2"></div>
<img class="c tl" src="${u('assets/img/corner.svg')}"><img class="c tr" src="${u('assets/img/corner.svg')}">
<img class="c bl" src="${u('assets/img/corner.svg')}"><img class="c br" src="${u('assets/img/corner.svg')}">
<img class="seal" src="${u('assets/img/seal.svg')}">
<div class="eyebrow">${C.texts.envelopeTitle}</div>
<div class="names"><span class="gold">${C.couple.groom}</span><span class="amp">&amp;</span><span class="gold bride">${C.couple.bride}</span></div>
<img class="div" src="${u('assets/img/divider.svg')}">
<div class="date">${C.event.dayName}<span class="sep">|</span>${C.event.dateLong}</div>
<div class="venue">${C.venue.display || C.venue.name + ' – ' + C.venue.shortAddress}</div></body></html>`;

const icon = `<!doctype html><html><style>${css}body{width:180px;height:180px;background:radial-gradient(#FFFEFB,#F4EFE8);display:grid;place-items:center}
img{width:150px;filter:drop-shadow(0 4px 6px rgba(78,58,28,.3))}</style><body><img src="${u('assets/img/seal.svg')}"></body></html>`;

const browser = await chromium.launch();
async function shot(html, w, h, out, type) {
  const tmp = path.join(ROOT, 'tools', '.tmp.html');
  fs.writeFileSync(tmp, html);
  const p = await browser.newPage({ viewport: { width: w, height: h } });
  await p.goto(pathToFileURL(tmp).href);
  await p.evaluate(() => document.fonts.ready);
  await p.waitForTimeout(300);
  await p.screenshot({ path: out, type, quality: type === 'jpeg' ? 90 : undefined });
  await p.close();
  fs.unlinkSync(tmp);
}
await shot(og, 1200, 630, path.join(ROOT, 'assets/img/og-image.jpg'), 'jpeg');
await shot(icon, 180, 180, path.join(ROOT, 'assets/img/apple-touch-icon.png'), 'png');
await browser.close();
console.log('og-image.jpg + apple-touch-icon.png rendered');
