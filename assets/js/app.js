/* =====================================================================
   Royal wedding invitation — interactions & motion
   Vanilla JS, no dependencies. All content comes from config.js.
   ===================================================================== */
(function () {
  'use strict';
  var C = window.WEDDING;
  var doc = document, root = doc.documentElement;
  var $ = function (s, r) { return (r || doc).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || doc).querySelectorAll(s)); };
  var reduceMotion = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ------------------------------------------------ 1. bind content from config */
  function get(path) { return path.split('.').reduce(function (o, k) { return o == null ? o : o[k]; }, C); }
  $$('[data-text]').forEach(function (el) {
    var v = get(el.dataset.text);
    if (typeof v === 'string') el.textContent = v;
  });
  doc.title = C.site.title;

  /* timeline items */
  var tl = $('#timeline');
  if (tl) {
    tl.innerHTML = '<span class="tl-progress" aria-hidden="true"></span>' + C.timeline.map(function (it) {
      return '<li class="tl-item" data-reveal><span class="tl-node" aria-hidden="true"></span>' +
        '<div class="tl-card"><span class="tl-time"></span><span class="tl-title"></span></div></li>';
    }).join('');
    $$('.tl-item', tl).forEach(function (li, i) {
      $('.tl-time', li).textContent = C.timeline[i].time;
      $('.tl-title', li).textContent = C.timeline[i].title;
    });
  }

  /* ------------------------------------------------ 2. time: ceremony start in Asia/Gaza */
  function tzOffset(date, tz) {
    var f = new Intl.DateTimeFormat('en-US', { timeZone: tz, hourCycle: 'h23', year: 'numeric', month: '2-digit',
      day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' });
    var p = {};
    f.formatToParts(date).forEach(function (x) { p[x.type] = x.value; });
    var asUTC = Date.UTC(+p.year, +p.month - 1, +p.day, (+p.hour) % 24, +p.minute, +p.second);
    return asUTC - Math.floor(date.getTime() / 1000) * 1000;
  }
  function zonedToUtc(isoDate, hhmm, tz) {
    var d = isoDate.split('-').map(Number), t = hhmm.split(':').map(Number);
    var guess = Date.UTC(d[0], d[1] - 1, d[2], t[0], t[1]);
    try {
      var off = tzOffset(new Date(guess), tz), utc = guess - off, off2 = tzOffset(new Date(utc), tz);
      return new Date(off2 === off ? utc : guess - off2);
    } catch (e) { return new Date(guess - 2 * 3600e3); } // Gaza is UTC+2 in November
  }
  // The ceremony time may not be confirmed yet (config.js → event.startTime). Without it the countdown,
  // the «save to calendar» button and the time line are hidden — nothing is ever guessed.
  var HAS_TIME = !!(C.event.isoDate && C.event.startTime);
  var START = HAS_TIME ? zonedToUtc(C.event.isoDate, C.event.startTime, C.event.timeZone) : null;
  var END = HAS_TIME ? zonedToUtc(C.event.isoDate, C.event.endTime || C.event.startTime, C.event.timeZone) : null;
  if (HAS_TIME) window.__WEDDING_START__ = START.toISOString();

  /* ------------------------------------------------ 3. links: maps & calendar */
  // map: only an approved link or search phrase (config.js → venue.mapsUrl / venue.mapsQuery), otherwise hidden
  var maps = $('#mapsLink');
  var mapsHref = C.venue.mapsUrl || (C.venue.mapsQuery ? 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(C.venue.mapsQuery) : '');
  if (maps) { maps.hidden = !mapsHref; if (mapsHref) maps.href = mapsHref; }
  function gstamp(d) { return d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, ''); }
  var gcal = $('#gcalLink');
  if (gcal && HAS_TIME) {
    gcal.href = 'https://calendar.google.com/calendar/render?action=TEMPLATE' +
      '&text=' + encodeURIComponent('زفاف ' + C.couple.groom + ' ' + C.couple.joiner + ' ' + C.couple.bride) +
      '&dates=' + gstamp(START) + '/' + gstamp(END) +
      '&ctz=' + encodeURIComponent(C.event.timeZone) +
      '&location=' + encodeURIComponent(C.venue.name + '، ' + C.venue.address) +
      '&details=' + encodeURIComponent(C.texts.shareText + '\n' + C.site.url);
  }
  var calToggle = $('#calendarToggle'), calOpts = $('#calendarOptions');
  if (calToggle) calToggle.hidden = !HAS_TIME;
  if (calOpts && !HAS_TIME) calOpts.hidden = true;
  // the venue actions row disappears entirely when it has nothing to show (no empty gap)
  var venueActions = maps ? maps.parentElement : null;
  if (venueActions) venueActions.hidden = !mapsHref && !HAS_TIME;
  // «· الساعة» after the date in the venue scene: only with a confirmed time
  $$('[data-text="event.timeLabel"]').forEach(function (el) {
    el.hidden = !C.event.timeLabel;
    var sep = el.previousElementSibling;
    if (sep && sep.classList.contains('sep')) sep.hidden = !C.event.timeLabel;
  });
  if (calToggle && calOpts) calToggle.addEventListener('click', function () {
    var open = calOpts.hidden;
    calOpts.hidden = !open;
    calToggle.setAttribute('aria-expanded', String(open));
    if (open) { var first = $('a', calOpts); if (first) first.focus(); }
  });

  /* ------------------------------------------------ 4. countdown */
  var cd = { d: $('#cdDays'), h: $('#cdHours'), m: $('#cdMinutes'), s: $('#cdSeconds') };
  var cdGrid = $('#countdownGrid'), cdNote = $('#countdownNote'), cdDone = $('#countdownDone'), cdSum = $('#countdownSummary');
  var last = {};
  function pad2(n) { return (n < 10 ? '0' : '') + n; }
  function setNum(key, val) {
    if (last[key] === val || !cd[key]) return;
    last[key] = val; cd[key].textContent = val;
    if (!reduceMotion) { cd[key].classList.remove('tick'); void cd[key].offsetWidth; cd[key].classList.add('tick'); }
  }
  function tickCountdown() {
    var diff = START.getTime() - Date.now();
    if (diff <= 0) {
      if (cdGrid) cdGrid.hidden = true;
      if (cdNote) cdNote.hidden = true;
      if (cdDone) cdDone.hidden = false;
      return false;
    }
    var s = Math.floor(diff / 1000);
    var days = Math.floor(s / 86400), hours = Math.floor(s % 86400 / 3600), mins = Math.floor(s % 3600 / 60), secs = s % 60;
    setNum('d', String(days)); setNum('h', pad2(hours)); setNum('m', pad2(mins)); setNum('s', pad2(secs));
    if (cdSum && secs === 0 || cdSum && !cdSum.textContent) {
      cdSum.textContent = 'المتبقي على بداية الحفل: ' + days + ' يوم، ' + hours + ' ساعة، ' + mins + ' دقيقة.';
    }
    return true;
  }
  var cdSection = $('#countdown');
  if (cdSection) cdSection.hidden = !HAS_TIME;
  if (HAS_TIME) {
    if (cdNote) cdNote.textContent = C.event.dayName + ' ' + C.event.dateLong + ' — الساعة ' + C.event.timeLabel + ' بتوقيت غزة';
    if (tickCountdown()) { var cdTimer = setInterval(function () { if (!tickCountdown()) clearInterval(cdTimer); }, 1000); }
  }

  /* ------------------------------------------------ 5. toast, share, music */
  var toastEl = $('#toast'), toastT;
  function toast(msg) {
    if (!toastEl) return;
    toastEl.textContent = msg; toastEl.classList.add('is-shown');
    clearTimeout(toastT); toastT = setTimeout(function () { toastEl.classList.remove('is-shown'); }, 2600);
  }
  function copyLink(url) {
    function fallback() {
      var ta = doc.createElement('textarea');
      ta.value = url; ta.setAttribute('readonly', ''); ta.style.position = 'fixed'; ta.style.opacity = '0';
      doc.body.appendChild(ta); ta.select();
      var ok = false; try { ok = doc.execCommand('copy'); } catch (e) {}
      ta.remove();
      toast(ok ? 'تم نسخ رابط الدعوة' : 'رابط الدعوة: ' + url);
    }
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(url).then(function () { toast('تم نسخ رابط الدعوة'); }, fallback);
    } else fallback();
  }
  var shareBtn = $('#shareButton');
  if (shareBtn) shareBtn.addEventListener('click', function () {
    var data = { title: C.site.title, text: C.texts.shareText, url: C.site.url };
    if (navigator.share) {
      navigator.share(data).catch(function (e) { if (!e || e.name !== 'AbortError') copyLink(C.site.url); });
    } else copyLink(C.site.url);
  });

  var musicBtn = $('#musicButton');
  var Music = window.WeddingMusic;
  function syncMusicBtn() {
    if (!musicBtn) return;
    var on = !!(Music && Music.playing);
    musicBtn.setAttribute('aria-pressed', String(on));
    musicBtn.setAttribute('aria-label', on ? 'إيقاف الموسيقى' : 'تشغيل الموسيقى');
  }
  if (Music) Music.onChange(syncMusicBtn);     // button reflects the real state of the song
  if (musicBtn) {
    if (!Music || !C.music.enabled) musicBtn.hidden = true;
    else musicBtn.addEventListener('click', function () {
      if (Music.playing) { Music.pause(); toast('تم إيقاف الموسيقى'); return; }
      Music.play(false).then(function (ok) {      // resume from the same position
        toast(ok ? 'تم تشغيل الموسيقى' : (Music.state === 'error' ? 'تعذّر تحميل أغنية الزفاف' : 'تعذّر تشغيل الأغنية — اضغطوا زر «موسيقى» مرة أخرى'));
      });
    });
  }
  if (Music) Music.setVolume(C.music.volume == null ? 1 : C.music.volume);

  /* ------------------------------------------------ 5b. sections whose data is not confirmed yet
     Hidden (no empty gap) until config.js has their data; they come back by themselves once it does. */
  var hasProgram = !!(C.timeline && C.timeline.length);
  var programScene = $('#program');
  if (programScene) programScene.hidden = !hasProgram;
  $$('[data-nav="program"]').forEach(function (a) { a.hidden = !hasProgram; });
  var etiquetteScene = $('#etiquette');
  if (etiquetteScene) etiquetteScene.hidden = !C.texts.etiquetteText;
  // the bottom dock keeps its buttons evenly spread over however many are shown
  var dockEl = $('#dock');
  if (dockEl) dockEl.style.gridTemplateColumns = 'repeat(' + $$('.dock-item', dockEl).filter(function (b) { return !b.hidden; }).length + ', 1fr)';

  /* ------------------------------------------------ 6. envelope opening (Scene 01) */
  var scene = $('#envelopeScene'), main = $('#main'), dock = $('#dock');
  var opened = false;
  function lock(on) { root.classList.toggle('is-locked', on); }
  if (scene && root.classList.contains('js')) {
    lock(true);
    if (main) main.inert = true;
    if (dock) dock.inert = true;
    var openBtn = $('#openInvitation');
    setTimeout(function () { if (openBtn && !opened) openBtn.focus({ preventScroll: true }); }, 60);
  }
  function revealSite() {
    root.classList.add('is-open');
    if (main) main.inert = false;
    if (dock) dock.inert = false;
    lock(false);
  }
  function finish() {
    if (scene) scene.hidden = true;
    revealSite();
    var target = location.hash && location.hash.length > 1 ? doc.getElementById(location.hash.slice(1)) : null;
    if (target && target.id !== 'home') target.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth' });
    else window.scrollTo(0, 0);
    var h = $('#namesHeading'); if (h) h.focus({ preventScroll: true });
    scheduleAutoScroll();
  }
  function openInvitation() {
    if (opened) return; opened = true;
    if (Music && C.music.enabled) {               // play() is called inside the tap itself (mobile autoplay rules)
      Music.play(true).then(function (ok) { if (!ok) toast(Music.state === 'error' ? 'تعذّر تحميل أغنية الزفاف' : 'لتشغيل أغنية الزفاف اضغطوا زر «موسيقى»'); });
    }
    if (!scene) return finish();
    if (reduceMotion) { scene.classList.add('is-leaving'); setTimeout(finish, 60); return; }
    scene.classList.add('is-opening');
    setTimeout(function () { scene.classList.add('flap-back'); }, 520);
    setTimeout(function () { scene.classList.add('is-rising'); }, 900);
    setTimeout(function () { scene.classList.add('is-leaving'); revealSite(); }, 2150);
    setTimeout(finish, 3300);
  }
  var ob = $('#openInvitation'), sb = $('#sealButton');
  if (ob) ob.addEventListener('click', openInvitation);
  if (sb) sb.addEventListener('click', openInvitation);
  window.__openInvitation = openInvitation;

  /* ------------------------------------------------ 7. scroll reveal */
  $$('section').forEach(function (sec) {
    $$('[data-reveal]', sec).forEach(function (el, i) { el.style.setProperty('--i', String(Math.min(i, 8))); });
  });
  $$('.arch .draw').forEach(function (p) {
    try { p.style.setProperty('--len', Math.ceil(p.getTotalLength()) + 1); } catch (e) {}
  });
  var sparksDone = false;
  function onVisible(el) {
    el.classList.add('is-visible');
    if (el.id === 'finaleMark' && !sparksDone && !reduceMotion) { sparksDone = true; sparks(); }
    // fully clipped sprigs are invisible to IntersectionObserver: they follow the prayer text
    if (el.id === 'prayerText') $$('[data-reveal="sprig"]').forEach(function (s) { s.classList.add('is-visible'); });
  }
  if ('IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) { if (e.isIntersecting) { onVisible(e.target); io.unobserve(e.target); } });
    }, { threshold: 0.16, rootMargin: '0px 0px -6% 0px' });
    $$('[data-reveal]:not([data-reveal="sprig"])').forEach(function (el) { io.observe(el); });
  } else $$('[data-reveal]').forEach(onVisible);

  function sparks() {
    var box = $('#finaleSparks'); if (!box) return;
    var n = 22, html = '';
    for (var i = 0; i < n; i++) {
      var a = (i / n) * Math.PI * 2 + Math.random() * 0.3, r = 120 + Math.random() * 90;
      html += '<span class="spark" style="--dx:' + Math.round(Math.cos(a) * r) + 'px;--dy:' + Math.round(Math.sin(a) * r * 0.8) +
        'px;--d:' + Math.round(300 + Math.random() * 500) + 'ms"></span>';
    }
    box.innerHTML = html;
    setTimeout(function () { box.innerHTML = ''; }, 3200);
  }

  /* ------------------------------------------------ 8. scroll-linked: timeline glow, parallax, active nav */
  var progress = $('.tl-progress'), items = $$('.tl-item'), para = reduceMotion ? [] : $$('[data-parallax]');
  var navItems = $$('[data-nav]'), navTargets = navItems.map(function (a) { return doc.getElementById(a.dataset.nav); });
  var ticking = false;
  function onScroll() {
    ticking = false;
    var vh = window.innerHeight;
    if (tl && progress) {
      var r = tl.getBoundingClientRect();
      var p = Math.max(0, Math.min(1, (vh * 0.62 - r.top) / Math.max(r.height - 30, 1)));
      tl.style.setProperty('--p', p.toFixed(4));
      items.forEach(function (li) {
        var lr = li.getBoundingClientRect();
        li.classList.toggle('is-lit', lr.top + 18 < vh * 0.62);
      });
    }
    para.forEach(function (el) {
      var host = el.parentElement.getBoundingClientRect();
      if (host.bottom < 0 || host.top > vh) return;
      var k = parseFloat(el.dataset.parallax) || 0;
      el.style.transform = 'translate3d(0,' + ((host.top + host.height / 2 - vh / 2) * k).toFixed(1) + 'px,0)';
    });
    var active = -1;
    navTargets.forEach(function (t, i) {
      if (!t) return;
      var r = t.getBoundingClientRect();
      if (r.top < vh * 0.5 && r.bottom > vh * 0.35) active = i;
    });
    navItems.forEach(function (a, i) {
      a.classList.toggle('is-active', i === active);
      if (i === active) a.setAttribute('aria-current', 'location'); else a.removeAttribute('aria-current');
    });
  }
  window.addEventListener('scroll', function () { if (!ticking) { ticking = true; requestAnimationFrame(onScroll); } }, { passive: true });
  window.addEventListener('resize', onScroll, { passive: true });
  onScroll();

  /* ------------------------------------------------ 9. cinematic auto scroll (after the opening)
     Starts once the envelope has gone and the names are fully written, glides down at a
     constant, time-based speed (independent of the screen refresh rate) to the very end,
     and stops for good on the guest's first touch, wheel, key or click. Never runs with
     prefers-reduced-motion. No visual change: it only moves the scroll position. */
  var AUTO_SPEED = 35;          // px per second
  var AUTO_DELAY = 4200;        // ms after the opening finishes (names + date + line revealed)
  var STOP_EVENTS = ['touchstart', 'wheel', 'pointerdown', 'mousedown', 'keydown'];
  var auto = { timer: 0, raf: 0, active: false, done: false, y: 0, last: 0 };
  function stopAutoScroll() {
    if (auto.done) return;
    auto.done = true; auto.active = false;
    clearTimeout(auto.timer); cancelAnimationFrame(auto.raf);
    STOP_EVENTS.forEach(function (e) { window.removeEventListener(e, stopAutoScroll, true); });
    root.style.scrollBehavior = '';
  }
  function autoStep(now) {
    if (!auto.active) return;
    var dt = Math.min(Math.max((now - auto.last) / 1000, 0), 0.1);   // clamp: no jump after a pause
    auto.last = now;
    // the guest (or a link) moved the page by other means -> hand control back
    if (Math.abs(window.scrollY - auto.y) > 4) { stopAutoScroll(); return; }
    var max = Math.max(0, root.scrollHeight - window.innerHeight);
    auto.y = Math.min(auto.y + AUTO_SPEED * dt, max);
    window.scrollTo(0, auto.y);
    if (auto.y >= max - 0.5) { stopAutoScroll(); return; }
    auto.raf = requestAnimationFrame(autoStep);
  }
  function startAutoScroll() {
    if (auto.done || auto.active || reduceMotion) return;
    auto.active = true;
    auto.y = window.scrollY;
    root.style.scrollBehavior = 'auto';      // our tiny steps must not be smoothed by CSS
    auto.raf = requestAnimationFrame(function (t) { auto.last = t; auto.raf = requestAnimationFrame(autoStep); });
  }
  function scheduleAutoScroll() {
    if (reduceMotion || auto.done || auto.timer) return;
    STOP_EVENTS.forEach(function (e) { window.addEventListener(e, stopAutoScroll, { capture: true, passive: true }); });
    auto.timer = setTimeout(startAutoScroll, AUTO_DELAY);
  }
  doc.addEventListener('infiniti:open', stopAutoScroll);   // the INFINITI page stops it for good (and cancels a pending start)
  window.__autoScroll = auto;   // read-only state for the QA script
})();
