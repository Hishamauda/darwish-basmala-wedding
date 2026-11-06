// End-to-end QA with Playwright.
//   node tools/qa.mjs [baseUrl]        (default http://127.0.0.1:8765/)
// Writes qa/QA_REPORT.md, qa/qa-results.json and screenshots in qa/screenshots/.
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const { chromium, devices } = require('playwright');
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const BASE = process.argv[2] || 'http://127.0.0.1:8765/';
const LIVE = !BASE.includes('127.0.0.1') && !BASE.includes('localhost');
const SHOTS = path.join(ROOT, 'qa', LIVE ? 'screenshots-live' : 'screenshots');
fs.mkdirSync(SHOTS, { recursive: true });
const sb = { window: {} };
vm.runInNewContext(fs.readFileSync(path.join(ROOT, 'assets/js/config.js'), 'utf8'), sb);
const C = sb.window.WEDDING;

const results = [];
function check(group, name, ok, detail = '') { results.push({ group, name, ok: !!ok, detail: String(detail) }); }
const VIEWPORTS = [[360, 780], [390, 844], [430, 932], [768, 1024], [1440, 900]];
const T = C.texts, CG = C.congrats;
const HAS_TIME = !!(C.event.isoDate && C.event.startTime);
const HAS_PROGRAM = !!(C.timeline && C.timeline.length);
const HAS_ETIQUETTE = !!T.etiquetteText;
const MAPS = C.venue.mapsUrl || (C.venue.mapsQuery ? 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(C.venue.mapsQuery) : '');
const APPROVED = [
  C.couple.groom, C.couple.bride, C.families.groomFather.name, C.families.groomFather.kunya, C.families.brideFather.name, C.families.brideFather.kunya,
  C.venue.name, C.venue.address, T.bismillah, T.invitationOpening, T.invitationHonor, T.invitationBody, T.invitationClosing,
  C.event.dayName, C.event.dateLong, C.event.dateNumeric, T.envelopeTitle, T.envelopeButton, T.revealLine,
  T.prayer, T.prayerLine, T.finalLine1, T.finalLine2, T.finalAwait,
  CG.opening, CG.headline, CG.couple, CG.families, CG.prayer,
  ...(HAS_TIME ? [C.event.timeLabel] : []),
  ...(HAS_PROGRAM ? C.timeline.flatMap((t) => [t.time, t.title]) : []),
  ...(HAS_ETIQUETTE ? [T.etiquetteTitle, T.etiquetteText, T.etiquetteThanks] : []),
];

const FORBIDDEN = /هدي[ةه]|هدايا|تحويل|بنك|حساب بنكي|محفظ|QR|دفع|wallet|bank|gift|payment|iban/i;

const browser = await chromium.launch();

async function openPage(vw, vh, opts = {}) {
  const ctx = await browser.newContext({ viewport: { width: vw, height: vh }, deviceScaleFactor: vw < 800 ? 2 : 1,
    isMobile: vw < 800, hasTouch: vw < 800, locale: 'ar', permissions: ['clipboard-read', 'clipboard-write'],
    reducedMotion: opts.reduced ? 'reduce' : 'no-preference' });
  const page = await ctx.newPage();
  const log = { errors: [], bad: [], bytes: 0 };
  page.on('console', (m) => { if (m.type() === 'error') log.errors.push(m.text()); });
  page.on('pageerror', (e) => log.errors.push(e.message));
  page.on('response', async (r) => {
    if (r.status() >= 400) log.bad.push(r.status() + ' ' + r.url());
    try { const b = await r.body(); log.bytes += b.length; } catch (e) { /* redirects */ }
  });
  if (opts.clock) await page.clock.install({ time: opts.clock });
  if (opts.share) await page.addInitScript(() => { window.__shared = null; navigator.share = (d) => { window.__shared = d; return Promise.resolve(); }; });
  await page.goto(BASE, { waitUntil: 'networkidle' });
  await page.evaluate(() => document.fonts.ready);
  return { ctx, page, log };
}
async function settle(page, ms) { await page.waitForTimeout(ms); }
const shot = (page, o) => page.screenshot({ ...o, path: o.path.replace(/\.png$/, '.jpg'), type: 'jpeg', quality: 80 });

// ------------------------------------------------------------ per viewport
for (const [vw, vh] of VIEWPORTS) {
  const tag = `${vw}px`;
  const { ctx, page, log } = await openPage(vw, vh);
  const dir = path.join(SHOTS, String(vw)); fs.mkdirSync(dir, { recursive: true });
  check(tag, 'Envelope scene visible on load', await page.isVisible('#envelopeScene'));
  check(tag, 'Content inert before opening', await page.evaluate(() => document.getElementById('main').inert === true));
  await shot(page, { path: path.join(dir, '01-envelope.png') });
  const initialBytes = log.bytes;
  await page.click('#openInvitation');
  await settle(page, 1200);
  await shot(page, { path: path.join(dir, '02-opening.png') });
  await settle(page, 2600);
  check(tag, 'Envelope opens and is removed', await page.evaluate(() => document.getElementById('envelopeScene').hidden));
  check(tag, 'Content interactive after opening', await page.evaluate(() => !document.getElementById('main').inert));
  check(tag, 'Focus moved to names heading', await page.evaluate(() => document.activeElement && document.activeElement.id === 'namesHeading'));
  const anim = await page.evaluate(() => getComputedStyle(document.querySelector('.name-groom')).animationName);
  check(tag, 'Names writing animation runs', /write/.test(anim), anim);
  await settle(page, 2600);
  await shot(page, { path: path.join(dir, '03-names.png') });
  const nb = await page.evaluate(() => [...document.querySelectorAll('.name, .names-amp')].map((e) => { const r = e.getBoundingClientRect(); return [r.left, r.right, e.textContent]; }));
  check(tag, 'Couple names fully inside the viewport (not clipped)', nb.every(([l, r]) => l >= 0 && r <= vw), JSON.stringify(nb.map((x) => [Math.round(x[0]), Math.round(x[1])])));
  check(tag, 'Wedding song starts with the opening tap', await page.evaluate(() => window.WeddingMusic.state === 'playing' && !document.getElementById('weddingSong').paused));
  for (const id of ['invitation', 'venue', ...(HAS_TIME ? ['countdown'] : []), ...(HAS_PROGRAM ? ['program'] : []), ...(HAS_ETIQUETTE ? ['etiquette'] : []), 'prayer', 'finale', 'congrats']) {
    await page.evaluate((id) => document.getElementById(id).scrollIntoView({ behavior: 'instant', block: 'start' }), id);
    await settle(page, id === 'prayer' ? 4400 : 2600);
    await shot(page, { path: path.join(dir, `${id}.png`) });
  }
  const sig = await page.evaluate(() => {
    const brand = document.querySelector('.infiniti-brand').textContent.replace(/\s+/g, ' ').trim();
    const eng = document.querySelector('.infiniti-engineer').textContent.replace(/\s+/g, ' ').trim();
    const sec = document.getElementById('congrats'), fin = document.getElementById('finale');
    const inside = [...sec.querySelectorAll('p, h2, img')].every((e) => { const r = e.getBoundingClientRect(); return r.left >= -0.5 && r.right <= innerWidth + 0.5; });
    const visible = [...sec.querySelectorAll('[data-reveal]')].every((e) => e.classList.contains('is-visible'));
    return { brand, eng, inside, visible, after: sec.getBoundingClientRect().top >= fin.getBoundingClientRect().bottom - 1,
      last: document.querySelector('main').lastElementChild.id, bg: getComputedStyle(sec).backgroundColor };
  });
  check(tag, 'INFINITI signature texts exact', sig.brand === 'INFINITI TECHNOLOGIES' && sig.eng === 'المهندس / هشام عوده «أبو عمر»', `${sig.brand} | ${sig.eng}`);
  check(tag, 'Congratulations section is the last section, after the finale, not overlapping', sig.after && sig.last === 'congrats', sig.last);
  check(tag, 'Congratulations section within the viewport width and fully revealed', sig.inside && sig.visible);
  check(tag, 'Congratulations section keeps the site background (no dark/new background)', sig.bg === 'rgba(0, 0, 0, 0)', sig.bg);
  if (vw === 390 || vw === 1440) await page.locator('#congrats .calm-panel').screenshot({ path: path.join(SHOTS, `infiniti-signature-${vw}.jpg`), type: 'jpeg', quality: 90 });
  const sw = await page.evaluate(() => [document.documentElement.scrollWidth, window.innerWidth]);
  check(tag, 'No horizontal scrolling', sw[0] <= sw[1], `scrollWidth ${sw[0]} / viewport ${sw[1]}`);
  // full page after all reveals
  await page.evaluate(() => window.scrollTo(0, 0));
  await settle(page, 600);
  await shot(page, { path: path.join(dir, '00-fullpage.png'), fullPage: true });
  check(tag, 'No console errors', log.errors.length === 0, log.errors.join(' | '));
  check(tag, 'All assets loaded (no 4xx/5xx)', log.bad.length === 0, log.bad.join(' | '));
  if (vw === 390) check('Performance', 'First load before opening (the song streams only after the tap)', initialBytes < 900 * 1024, `${Math.round(initialBytes / 1024)} KB`);
  // small touch targets
  const small = await page.evaluate(() => [...document.querySelectorAll('a,button')].filter((e) => {
    if (e.closest('[hidden]') || e.classList.contains('skip-link')) return false;
    const r = e.getBoundingClientRect(); return r.width > 0 && (r.width < 44 || r.height < 44); }).map((e) => e.id || e.className));
  check(tag, 'Touch targets ≥ 44×44 px', small.length === 0, small.join(', '));
  await ctx.close();
}

// ------------------------------------------------------------ content & functions (390px)
{
  const { ctx, page, log } = await openPage(390, 844, { share: false });
  await page.click('#openInvitation');
  await settle(page, 3800);
  const body = await page.evaluate(() => document.body.innerText + '\n' + document.getElementById('envelopeScene').textContent);
  const html = await page.content();
  const missing = APPROVED.filter((t) => !body.includes(t));
  check('Content', 'Every approved Arabic text is present verbatim', missing.length === 0, missing.join(' | '));
  const F = C.families;
  check('Content', 'Parents’ names and kunyas exact',
    body.includes(F.groomFather.name) && body.includes(`«${F.groomFather.kunya}»`) && body.includes(F.brideFather.name) && body.includes(`«${F.brideFather.kunya}»`),
    `${F.groomFather.name} «${F.groomFather.kunya}» / ${F.brideFather.name} «${F.brideFather.kunya}»`);
  // with no confirmed ceremony time, no clock time may appear anywhere in the page
  const times = HAS_TIME ? [] : (body.match(/\d{1,2}:\d{2}/g) || []);
  check('Content', 'No unconfirmed time of day anywhere in the page', times.length === 0, times.join(' | '));
  check('Content', 'No gifts / payments / bank / wallet / QR anywhere', !FORBIDDEN.test(body) && !FORBIDDEN.test(html),
    (body.match(FORBIDDEN) || html.match(FORBIDDEN) || [''])[0]);
  const bound = await page.evaluate(() => [...document.querySelectorAll('[data-text]')].map((e) => [e.dataset.text, e.textContent]));
  const get = (p) => p.split('.').reduce((o, k) => (o == null ? o : o[k]), C);
  const mism = bound.filter(([k, v]) => get(k) !== v);
  check('Content', 'All bound texts equal config.js', mism.length === 0, JSON.stringify(mism.slice(0, 3)));
  const iso = await page.evaluate(() => window.__WEDDING_START__);
  if (HAS_TIME) check('Date', `Ceremony start = ${C.event.isoDate} ${C.event.startTime} ${C.event.timeZone}`, !!iso, iso);
  else check('Date', 'No ceremony time set: nothing computes or shows a start time', iso === undefined, String(iso));
  const wd = await page.evaluate((d) => new Intl.DateTimeFormat('ar', { weekday: 'long', timeZone: 'UTC' }).format(new Date(d + 'T12:00:00Z')), C.event.isoDate);
  check('Date', `Day of the week of ${C.event.isoDate} is ${C.event.dayName}`, wd === C.event.dayName, wd);
  const dateVisual = await page.evaluate(() => { const b = document.querySelector('.venue-when bdi'); return [getComputedStyle(b).direction, b.textContent]; });
  check('Date', `Numeric date isolated LTR (cannot flip to ${C.event.isoDate})`, dateVisual[0] === 'ltr' && dateVisual[1] === C.event.dateNumeric, dateVisual.join(' '));
  if (HAS_TIME) {
    // countdown now
    const cdv = await page.evaluate(() => ['cdDays', 'cdHours', 'cdMinutes', 'cdSeconds'].map((i) => document.getElementById(i).textContent));
    const ms = new Date(iso) - Date.now();
    const expDays = Math.floor(ms / 86400000);
    check('Countdown', 'Live countdown matches the time to the ceremony start', Number(cdv[0]) === expDays || Number(cdv[0]) === expDays - 1, cdv.join(':') + ` (expected days ${expDays})`);
    await settle(page, 1100);
    const cdv2 = await page.evaluate(() => document.getElementById('cdSeconds').textContent);
    check('Countdown', 'Countdown ticks every second', cdv2 !== cdv[3], `${cdv[3]} → ${cdv2}`);
  } else {
    const cdHidden = await page.evaluate(() => { const s = document.getElementById('countdown'); return s.hidden && getComputedStyle(s).display === 'none'; });
    check('Countdown', 'No ceremony time yet: countdown hidden (no empty block)', cdHidden);
  }
  if (HAS_PROGRAM) {
    // timeline
    const tli = await page.evaluate(() => [...document.querySelectorAll('.tl-item')].map((li) => li.innerText.replace(/\s+/g, ' ').trim()));
    check('Timeline', `${C.timeline.length} approved timeline entries in order`, tli.length === C.timeline.length && C.timeline.every((t, i) => tli[i].includes(t.time) && tli[i].includes(t.title)), tli.join(' / '));
    await page.evaluate(() => document.getElementById('program').scrollIntoView({ behavior: 'instant' }));
    await settle(page, 400);
    const p1 = await page.evaluate(() => parseFloat(getComputedStyle(document.getElementById('timeline')).getPropertyValue('--p')) || 0);
    await page.mouse.wheel(0, 500); await settle(page, 500);
    const p2 = await page.evaluate(() => parseFloat(getComputedStyle(document.getElementById('timeline')).getPropertyValue('--p')) || 0);
    const lit = await page.evaluate(() => document.querySelectorAll('.tl-item.is-lit').length);
    check('Timeline', 'Gold line lights up progressively while scrolling', p2 > p1 && lit >= 1, `--p ${p1.toFixed(2)} → ${p2.toFixed(2)}, lit ${lit}`);

  } else {
    const pg = await page.evaluate(() => ({ s: document.getElementById('program').hidden, nav: document.querySelector('[data-nav="program"]').hidden,
      items: [...document.querySelectorAll('#dock .dock-item')].filter((b) => !b.hidden).map((b) => Math.round(b.getBoundingClientRect().width)) }));
    check('Timeline', 'No programme yet: section and its dock button hidden, the other dock buttons evenly spread',
      pg.s && pg.nav && pg.items.length === 5 && Math.max(...pg.items) - Math.min(...pg.items) <= 1, JSON.stringify(pg));
  }
  // maps & calendar
  const maps = await page.getAttribute('#mapsLink', 'href');
  if (MAPS) check('Venue', 'Google Maps opens the approved link / search (no invented coordinates)', maps === MAPS, decodeURIComponent(maps));
  else check('Venue', 'No approved map location yet: the map button is hidden', await page.evaluate(() => document.getElementById('mapsLink').hidden && !document.getElementById('mapsLink').offsetParent));
  await page.evaluate(() => document.getElementById('venue').scrollIntoView({ behavior: 'instant' }));
  await settle(page, 600);
  const errsBefore = log.errors.length;   // this probe may 404 on purpose (no time yet): its console line is not a site error
  const ics = await page.evaluate(async () => { const r = await fetch('assets/wedding.ics'); return [r.status, r.headers.get('content-type'), await r.text()]; });
  if (ics[0] === 404) log.errors.splice(errsBefore);
  if (HAS_TIME) {
    await page.click('#calendarToggle');
    check('Calendar', 'Save-the-date menu opens', await page.isVisible('#calendarOptions'));
    const gcal = await page.getAttribute('#gcalLink', 'href');
    check('Calendar', 'Google Calendar link carries the ceremony time', /dates=\d{8}T\d{6}Z\/\d{8}T\d{6}Z/.test(gcal), gcal.slice(0, 160));
    check('Calendar', '.ics file served and correct', ics[0] === 200 && ics[2].includes('DTSTART:') && ics[2].includes('SUMMARY:'), `${ics[0]} ${ics[1]}`);
  } else {
    const cal = await page.evaluate(() => ({ btn: document.getElementById('calendarToggle').hidden, time: document.querySelector('[data-text="event.timeLabel"]').hidden,
      row: document.querySelector('#venue .actions').hidden }));
    check('Calendar', 'No ceremony time yet: no save-the-date button, no time line, no empty actions row', cal.btn && cal.time && (MAPS ? !cal.row : cal.row), JSON.stringify(cal));
    check('Calendar', 'No calendar file with an unconfirmed time is published', ics[0] === 404, String(ics[0]));
  }
  // share fallback (no Web Share in desktop Chromium) -> copies link
  await page.click('#shareButton');
  await settle(page, 500);
  const toast = await page.textContent('#toast');
  let clip = '';
  try { clip = await page.evaluate(() => navigator.clipboard.readText()); } catch (e) { clip = 'n/a'; }
  check('Share', 'Without Web Share API the link is copied + confirmation toast', toast.includes('تم نسخ رابط الدعوة') && (clip === C.site.url || clip === 'n/a'), `${toast} / ${clip}`);
  // nav
  if (HAS_PROGRAM) {
    await page.click('a[data-nav="program"]'); await settle(page, 1400);
    const navOk = await page.evaluate(() => { const r = document.getElementById('program').getBoundingClientRect(); return r.top < innerHeight * 0.5 && r.bottom > 0; });
    check('Navigation', 'Bottom nav scrolls to the programme', navOk);
  }
  await page.click('a[data-nav="venue"]'); await settle(page, 1400);
  check('Navigation', 'Bottom nav scrolls to the venue', await page.evaluate(() => { const r = document.getElementById('venue').getBoundingClientRect(); return r.top < innerHeight * 0.5 && r.bottom > 0; }));
  const cur = await page.evaluate(() => document.querySelector('[data-nav="venue"]').getAttribute('aria-current'));
  check('Navigation', 'Active nav item announced (aria-current)', cur === 'location', cur);
  // the wedding song
  const sg = await page.evaluate(() => { const a = document.getElementById('weddingSong'); return { n: document.querySelectorAll('audio, video').length, loop: a.loop, paused: a.paused, t: a.currentTime, st: window.WeddingMusic.state, pressed: document.getElementById('musicButton').getAttribute('aria-pressed') }; });
  check('Song', 'Song playing after opening (real media state, button pressed)', !sg.paused && sg.st === 'playing' && sg.t > 0 && sg.pressed === 'true', JSON.stringify(sg));
  check('Song', 'Exactly one audio element, loop enabled', sg.n === 1 && sg.loop === true, JSON.stringify(sg));
  await page.click('#musicButton'); await settle(page, 400);
  const q1 = await page.evaluate(() => { const a = document.getElementById('weddingSong'); return { paused: a.paused, t: a.currentTime, st: window.WeddingMusic.state, pressed: document.getElementById('musicButton').getAttribute('aria-pressed') }; });
  await settle(page, 1200);
  const q1b = await page.evaluate(() => document.getElementById('weddingSong').currentTime);
  check('Song', 'Pause stops the song and the button shows it', q1.paused && q1.st === 'paused' && q1.pressed === 'false' && Math.abs(q1b - q1.t) < 0.05, JSON.stringify(q1));
  await page.click('#musicButton'); await settle(page, 1300);
  const q2 = await page.evaluate(() => { const a = document.getElementById('weddingSong'); return { paused: a.paused, t: a.currentTime, pressed: document.getElementById('musicButton').getAttribute('aria-pressed') }; });
  check('Song', 'Resume continues from the same position', !q2.paused && q2.pressed === 'true' && q2.t > q1.t + 0.5, `${q1.t.toFixed(2)}s → ${q2.t.toFixed(2)}s`);
  check('Song', 'Only one sound at a time', await page.evaluate(() => [...document.querySelectorAll('audio, video')].filter((m) => !m.paused).length === 1));
  const mp3 = await page.evaluate(async (src) => { const r = await fetch(src, { method: 'HEAD' }); return [r.status, r.headers.get('content-type'), r.headers.get('content-length')]; }, C.music.src);
  check('Song', 'MP3 served (audio/mpeg) and decodable', mp3[0] === 200 && /audio\/mpeg/.test(mp3[1]) && (await page.evaluate(() => document.getElementById('weddingSong').duration)) > 200, mp3.join(' '));
  check('Console', 'No console errors during functional run', log.errors.length === 0, log.errors.join(' | '));
  await ctx.close();
}

// Web Share API path
{
  const { ctx, page } = await openPage(390, 844, { share: true });
  await page.click('#openInvitation'); await settle(page, 3800);
  await page.click('#shareButton'); await settle(page, 300);
  const d = await page.evaluate(() => window.__shared);
  check('Share', 'Web Share API used when available (title, text, url)', d && d.url === C.site.url && d.text === C.texts.shareText, JSON.stringify(d));
  await ctx.close();
}
// music must not start before interaction
{
  const { ctx, page } = await openPage(390, 844);
  await settle(page, 1500);
  check('Song', 'No sound before the guest interacts', (await page.getAttribute('#musicButton', 'aria-pressed')) === 'false' && await page.evaluate(() => document.getElementById('weddingSong').paused));
  await ctx.close();
}
// the browser blocks playback: invitation still opens, no false 'playing', guest told to use the music button
{
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await ctx.newPage(); const errs = []; page.on('pageerror', (e) => errs.push(e.message));
  await page.addInitScript(() => { HTMLMediaElement.prototype.play = function () { return Promise.reject(new DOMException('blocked by test', 'NotAllowedError')); }; });
  await page.goto(BASE, { waitUntil: 'networkidle' });
  await page.click('#openInvitation'); await settle(page, 600);
  const st = await page.evaluate(() => ({ state: window.WeddingMusic.state, pressed: document.getElementById('musicButton').getAttribute('aria-pressed'), toast: document.getElementById('toast').textContent }));
  await settle(page, 3400);
  check('Song', 'Blocked autoplay: invitation still opens', await page.evaluate(() => document.getElementById('envelopeScene').hidden));
  check('Song', 'Blocked autoplay: no false “playing”, guest is told to use the music button', st.state === 'blocked' && st.pressed === 'false' && /موسيقى/.test(st.toast), JSON.stringify(st));
  check('Song', 'Blocked autoplay: no page errors', errs.length === 0, errs.join(' | '));
  await ctx.close();
}
// the MP3 fails to load: the invitation keeps working
{
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await ctx.newPage(); const errs = []; page.on('pageerror', (e) => errs.push(e.message));
  await page.route('**/*.mp3', (r) => r.fulfill({ status: 404, body: 'missing' }));
  await page.goto(BASE, { waitUntil: 'networkidle' });
  await page.click('#openInvitation'); await settle(page, 3800);
  const st = await page.evaluate(() => ({ opened: document.getElementById('envelopeScene').hidden, state: window.WeddingMusic.state, pressed: document.getElementById('musicButton').getAttribute('aria-pressed') }));
  check('Song', 'Missing MP3: invitation works, no “playing” state, no crash', st.opened && st.state === 'error' && st.pressed === 'false' && errs.length === 0, JSON.stringify(st) + errs.join('|'));
  await ctx.close();
}
// keyboard
{
  const { ctx, page } = await openPage(1440, 900);
  await page.keyboard.press('Enter'); // focus starts on the open button
  await settle(page, 3800);
  check('Keyboard', 'Invitation opens with the keyboard (Enter on focused button)', await page.evaluate(() => document.getElementById('envelopeScene').hidden));
  const stops = [];
  for (let i = 0; i < 14; i++) { await page.keyboard.press('Tab'); stops.push(await page.evaluate(() => { const a = document.activeElement; return (a.id || a.getAttribute('data-nav') || a.className || a.tagName).toString().slice(0, 24); })); }
  const expectStops = [...(MAPS ? ['mapsLink'] : []), ...(HAS_TIME ? ['calendarToggle'] : []), 'home', 'shareButton', 'musicButton', 'whatsappButton'];
  check('Keyboard', 'Tab reaches buttons, links and the bottom nav', expectStops.every((s) => stops.includes(s)), stops.join(' → '));
  const focusStyle = await page.evaluate(() => getComputedStyle(document.activeElement).outlineStyle);
  check('Keyboard', 'Visible focus indicator', focusStyle !== 'none', focusStyle);
  await ctx.close();
}
// reduced motion
{
  const { ctx, page } = await openPage(390, 844, { reduced: true });
  await page.click('#openInvitation'); await settle(page, 400);
  const st = await page.evaluate(() => [document.getElementById('envelopeScene').hidden, getComputedStyle(document.querySelector('.name-groom')).maskImage || getComputedStyle(document.querySelector('.name-groom')).webkitMaskImage]);
  check('Accessibility', 'prefers-reduced-motion: instant open, no masking/parallax', st[0] === true && (st[1] === 'none' || !st[1]), JSON.stringify(st));
  await shot(page, { path: path.join(SHOTS, 'reduced-motion-390.png') });
  await ctx.close();
}
// after the ceremony starts (only once a ceremony time is set)
if (HAS_TIME) {
  const startIso = await (async () => { const { ctx, page } = await openPage(390, 844); const v = await page.evaluate(() => window.__WEDDING_START__); await ctx.close(); return v; })();
  const { ctx, page } = await openPage(390, 844, { clock: new Date(new Date(startIso).getTime() + 5000) });
  await page.click('#openInvitation'); await page.clock.runFor(4000);
  const done = [await page.isVisible('#countdownDone'), await page.textContent('#countdownDone'), await page.isVisible('#countdownGrid')];
  check('Countdown', 'At the ceremony time the countdown turns into the welcome message', done[0] === true && done[2] === false && done[1] === C.texts.countdownDone, done[1]);
  await page.evaluate(() => document.getElementById('countdown').scrollIntoView({ behavior: 'instant' }));
  await page.clock.runFor(2500);
  await shot(page, { path: path.join(SHOTS, 'countdown-after-start-390.png') });
  await ctx.close();
}
// colour contrast of text tokens (WCAG)
{
  const lum = (h) => { const c = [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255).map((x) => (x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4)); return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]; };
  const cr = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
  const pairs = [['Espresso text on Ivory', '#30251E', '#FAF8F4', 4.5], ['Soft text #5A4A3D on Pearl', '#5A4A3D', '#F4EFE8', 4.5],
    ['Gold-ink #8A6A35 small text on Ivory', '#8A6A35', '#FAF8F4', 4.5], ['Gold-deep #6E5328 on Pearl', '#6E5328', '#F4EFE8', 4.5],
    ['Antique gold #A88348 (large display only) on Ivory', '#A88348', '#FAF8F4', 3], ['Button text on gold-ink', '#FFFDF8', '#8A6A35', 4.5]];
  for (const [n, a, b, min] of pairs) { const v = cr(a, b); check('Contrast', n, v >= min, `${v.toFixed(2)}:1 (min ${min})`); }
}
await browser.close();

// ------------------------------------------------------------ report
const ok = results.filter((r) => r.ok).length;
fs.writeFileSync(path.join(ROOT, 'qa', LIVE ? 'qa-results-live.json' : 'qa-results.json'), JSON.stringify({ base: BASE, date: new Date().toISOString(), ok, total: results.length, results }, null, 1));
const md = [`# QA ${LIVE ? '(live)' : '(local)'} — ${BASE}`, '', `**${ok}/${results.length} checks passed** — ${new Date().toISOString()}`, '',
  '| Group | Check | Result | Detail |', '|---|---|---|---|',
  ...results.map((r) => `| ${r.group} | ${r.name} | ${r.ok ? '✅' : '❌'} | ${r.detail.replace(/\|/g, '/').slice(0, 160)} |`)].join('\n');
fs.writeFileSync(path.join(ROOT, 'qa', LIVE ? 'QA_REPORT_LIVE.md' : 'QA_REPORT.md'), md + '\n');
console.log(`${ok}/${results.length} passed`);
results.filter((r) => !r.ok).forEach((r) => console.log('FAIL', r.group, '-', r.name, '-', r.detail));
