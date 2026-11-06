/* =====================================================================
   INFINITI Technologies — fullscreen brand page, opened by the «واتساب»
   item of the bottom dock (#whatsappButton in index.html).
   Self-contained: builds its own DOM from config.js (WEDDING.infinitiPage)
   and styles only its own .inf-* classes (assets/css/infiniti-page.css).
   While the page is open the invitation is frozen exactly where it was:
   auto scroll stopped (and its pending start cancelled), page scroll
   locked, everything behind made inert. Closing — button, Esc or the
   phone's back button — returns to the very same position. The song,
   the envelope and every invitation animation are never touched.
   ===================================================================== */
(function () {
  'use strict';
  var W = window.WEDDING || {}, C = W.infinitiPage, S = W.signature || {};
  if (!C) return;
  var doc = document, root = doc.documentElement, body = doc.body;
  var reduceMotion = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  var ENTER_MS = 760, EXIT_MS = 520;

  /* Official WhatsApp glyph (Simple Icons, CC0 — shape unmodified). */
  var WA_PATH = 'M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z';
  var WA_SVG = '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="' + WA_PATH + '"/></svg>';
  /* Thin line icons (drawn for this page; paths only so pathLength works everywhere). */
  var ICON = {
    invite: '<path pathLength="1" d="M4 7.2c0-.9.7-1.7 1.6-1.7h12.8c.9 0 1.6.8 1.6 1.7v9.6c0 .9-.7 1.7-1.6 1.7H5.6c-.9 0-1.6-.8-1.6-1.7z"/>' +
            '<path pathLength="1" d="m4.6 6.4 7.4 6 7.4-6"/><path pathLength="1" d="M12 15.9s-1.9-1.1-1.9-2.4c0-.6.4-1 1-1 .4 0 .7.2.9.5.2-.3.5-.5.9-.5.6 0 1 .4 1 1 0 1.3-1.9 2.4-1.9 2.4z"/>',
    web:    '<path pathLength="1" d="M3.5 6.2c0-.9.7-1.7 1.7-1.7h13.6c1 0 1.7.8 1.7 1.7v9.3c0 .9-.7 1.7-1.7 1.7H5.2c-1 0-1.7-.8-1.7-1.7z"/>' +
            '<path pathLength="1" d="M3.5 8.4h17"/><path pathLength="1" d="M9.5 20h5M12 17.2V20"/><path pathLength="1" d="m10 11.2-1.8 1.6 1.8 1.6M14 11.2l1.8 1.6-1.8 1.6"/>',
    ai:     '<path pathLength="1" d="M10.5 3.8 12 8.2l4.4 1.5L12 11.2l-1.5 4.4L9 11.2 4.6 9.7 9 8.2z"/>' +
            '<path pathLength="1" d="m17.2 13.6.8 2.2 2.2.8-2.2.8-.8 2.2-.8-2.2-2.2-.8 2.2-.8z"/><path pathLength="1" d="M5.5 16.5h3.2l1.6 2.7h3"/>'
  };

  function el(tag, cls, text, attrs) {
    var n = doc.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    if (attrs) Object.keys(attrs).forEach(function (k) { n.setAttribute(k, attrs[k]); });
    return n;
  }
  function svgIcon(name) {
    var s = el('span', 'inf-icon', null, { 'aria-hidden': 'true' });
    s.innerHTML = '<svg viewBox="0 0 24 24" focusable="false">' + ICON[name] + '</svg>';
    return s;
  }
  function brandMark(cls) {
    var p = el('p', cls, null, { lang: 'en', dir: 'ltr' });
    p.appendChild(el('span', cls + '-name', S.company || 'INFINITI'));
    p.appendChild(el('span', cls + '-sub', S.companyLine || 'TECHNOLOGIES'));
    return p;
  }
  var waHref = 'https://wa.me/' + String(C.whatsappNumber).replace(/\D/g, '') + '?text=' + encodeURIComponent(C.whatsappMessage);

  /* ------------------------------------------------ the «واتساب» item of the bottom dock */
  var btn = doc.getElementById('whatsappButton');
  if (!btn) return;

  /* ------------------------------------------------ the page */
  var page = el('div', 'inf-page', null, { id: 'infinitiPage', role: 'dialog', 'aria-modal': 'true',
    'aria-labelledby': 'infTitle', lang: 'ar', dir: 'rtl' });
  page.hidden = true;
  var scroller = el('div', 'inf-scroll');
  var bar = el('div', 'inf-bar');
  var closeBtn = el('button', 'inf-close', null, { type: 'button' });
  closeBtn.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M9.5 6.5 15 12l-5.5 5.5"/></svg>';
  closeBtn.appendChild(el('span', null, C.closeLabel));
  bar.appendChild(closeBtn);

  var hero = el('header', 'inf-hero');
  var mark = brandMark('inf-mark'); mark.setAttribute('data-inf', 'hero');
  var tag = el('p', 'inf-tagline', C.tagline, { lang: 'en', dir: 'ltr', 'data-inf': 'hero' });
  var rule = el('span', 'inf-rule', null, { 'aria-hidden': 'true', 'data-inf': 'hero' });
  var title = el('h2', 'inf-title', null, { id: 'infTitle', 'data-inf': 'hero' });
  title.appendChild(el('span', 'inf-title-1', C.headline1));
  title.appendChild(el('span', 'inf-title-2', C.headline2));
  var q = el('p', 'inf-question', C.question, { 'data-inf': 'hero' });
  var lead = el('p', 'inf-lead', C.lead, { 'data-inf': 'hero' });
  var bodyP = el('p', 'inf-body', null, { 'data-inf': 'hero' });
  var parts = String(C.body).split('{brand}');
  bodyP.appendChild(doc.createTextNode(parts[0]));
  if (parts.length > 1) {
    bodyP.appendChild(el('bdi', 'inf-brand-inline', C.brandInline, { lang: 'en', dir: 'ltr' }));
    bodyP.appendChild(doc.createTextNode(parts.slice(1).join('{brand}')));
  }
  [mark, tag, rule, title, q, lead, bodyP].forEach(function (n) { hero.appendChild(n); });

  var services = el('section', 'inf-services', null, { 'aria-labelledby': 'infServicesTitle' });
  services.appendChild(el('h3', 'inf-eyebrow', C.servicesTitle, { id: 'infServicesTitle', 'data-inf': '' }));
  var list = el('ul', 'inf-cards');
  (C.services || []).forEach(function (sv) {
    var li = el('li', 'inf-card', null, { 'data-inf': '' });
    li.appendChild(svgIcon(sv.icon));
    li.appendChild(el('h4', 'inf-card-title', sv.title));
    li.appendChild(el('p', 'inf-card-text', sv.text));
    list.appendChild(li);
  });
  services.appendChild(list);

  var contact = el('section', 'inf-contact', null, { 'aria-labelledby': 'infContactTitle' });
  contact.appendChild(el('h3', 'inf-contact-title', C.contactTitle, { id: 'infContactTitle', 'data-inf': '' }));
  contact.appendChild(el('p', 'inf-contact-text', C.contactText, { 'data-inf': '' }));
  var cta = el('a', 'inf-cta', null, { id: 'infWhatsApp', href: waHref, target: '_blank', rel: 'noopener noreferrer', 'data-inf': '' });
  cta.innerHTML = '<span class="inf-cta-glyph">' + WA_SVG + '</span>';
  cta.appendChild(el('span', 'inf-cta-label', C.ctaLabel));
  cta.appendChild(el('span', 'visually-hidden', ' — يفتح محادثة واتساب'));
  contact.appendChild(cta);

  var sign = el('footer', 'inf-sign', null, { 'data-inf': '' });
  sign.appendChild(el('span', 'inf-rule', null, { 'aria-hidden': 'true' }));
  sign.appendChild(brandMark('inf-sign-brand'));
  var who = el('p', 'inf-sign-name');
  who.appendChild(el('span', null, S.engineer || 'المهندس / هشام عوده'));
  who.appendChild(el('span', 'inf-sign-kunya', '«' + (S.kunya || 'أبو عمر') + '»'));
  sign.appendChild(who);
  var site = el('p', 'inf-site');
  site.appendChild(el('span', 'inf-site-label', 'الموقع الإلكتروني'));
  site.appendChild(el('a', 'inf-site-link', C.websiteLabel, { href: C.website, target: '_blank', rel: 'noopener', lang: 'en', dir: 'ltr' }));
  sign.appendChild(site);

  [bar, hero, services, contact, sign].forEach(function (n) { scroller.appendChild(n); });
  page.appendChild(scroller);
  body.appendChild(page);

  /* ------------------------------------------------ reveal (inside the page only) */
  var reveals = Array.prototype.slice.call(page.querySelectorAll('[data-inf]'));
  var heroItems = reveals.filter(function (n) { return n.getAttribute('data-inf') === 'hero'; });
  var restItems = reveals.filter(function (n) { return n.getAttribute('data-inf') !== 'hero'; });
  heroItems.forEach(function (n, i) { n.style.setProperty('--d', (260 + i * 110) + 'ms'); });
  Array.prototype.slice.call(list.children).forEach(function (n, i) { n.style.setProperty('--d', (i * 120) + 'ms'); });
  var io = 'IntersectionObserver' in window ? new IntersectionObserver(function (entries) {
    entries.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add('is-in'); io.unobserve(e.target); } });
  }, { root: scroller, threshold: 0.18 }) : null;
  function resetReveal() {
    reveals.forEach(function (n) { n.classList.remove('is-in'); });
    if (io) { io.disconnect(); restItems.forEach(function (n) { io.observe(n); }); }
    else restItems.forEach(function (n) { n.classList.add('is-in'); });
  }

  /* ------------------------------------------------ freeze / restore the invitation */
  var isOpen = false, locked = false, savedY = 0, lastFocus = null, saved = null, timer = 0, inertList = [];
  function setInert(on) {
    if (on) {
      inertList = Array.prototype.slice.call(body.children).filter(function (n) {
        return n !== page && !/^(SCRIPT|NOSCRIPT|STYLE|AUDIO|TEMPLATE)$/.test(n.tagName);
      }).map(function (n) { var prev = !!n.inert; n.inert = true; return [n, prev]; });
    } else {
      inertList.forEach(function (p) { p[0].inert = p[1]; });
      inertList = [];
    }
  }
  function lockScroll() {               // the page is opaque by now: nothing behind can be seen moving
    if (locked || !isOpen) return;
    locked = true;
    var s = body.style;
    saved = { position: s.position, top: s.top, left: s.left, right: s.right, width: s.width };
    s.position = 'fixed'; s.top = (-savedY) + 'px'; s.left = '0'; s.right = '0'; s.width = '100%';
  }
  function unlockScroll() {
    if (!locked) return;
    locked = false;
    var s = body.style;
    Object.keys(saved).forEach(function (k) { s[k] = saved[k]; });
    var sb = root.style.scrollBehavior;
    root.style.scrollBehavior = 'auto';  // jump back instantly (the CSS asks for smooth scrolling)
    window.scrollTo(0, savedY);
    root.style.scrollBehavior = sb;
  }
  function setOrigin() {
    var r = btn.getBoundingClientRect(), vw = window.innerWidth, vh = window.innerHeight;
    var x = r.width ? r.left + r.width / 2 : vw / 2, y = r.height ? r.top + r.height / 2 : vh / 2;
    page.style.setProperty('--ox', x.toFixed(1) + 'px');
    page.style.setProperty('--oy', y.toFixed(1) + 'px');
    page.style.setProperty('--or', Math.ceil(Math.hypot(Math.max(x, vw - x), Math.max(y, vh - y)) + 4) + 'px');
  }

  function open() {
    if (isOpen) return;
    // app.js stops the cinematic auto scroll and cancels its pending start (also covers
    // activation without a pointer or a key, e.g. assistive technology)
    doc.dispatchEvent(new CustomEvent('infiniti:open'));
    isOpen = true;
    clearTimeout(timer);
    savedY = window.scrollY;
    lastFocus = doc.activeElement;
    setOrigin();
    page.classList.remove('is-closing');
    page.hidden = false;
    scroller.scrollTop = 0;
    resetReveal();
    setInert(true);
    void page.offsetWidth;              // commit the start frame of the entrance
    page.classList.add('is-open');
    root.classList.add('inf-open');
    btn.setAttribute('aria-expanded', 'true');
    heroItems.forEach(function (n) { n.classList.add('is-in'); });
    try { if (!(history.state && history.state.infinitiPage)) history.pushState({ infinitiPage: true }, ''); } catch (e) {}
    closeBtn.focus({ preventScroll: true });
    timer = setTimeout(lockScroll, reduceMotion ? 0 : ENTER_MS);
  }
  function close() {
    if (!isOpen) return;
    isOpen = false;
    clearTimeout(timer);
    unlockScroll();                     // back to the exact position while the page still covers it
    setInert(false);
    page.classList.remove('is-open');
    root.classList.remove('inf-open');
    btn.setAttribute('aria-expanded', 'false');
    setOrigin();
    page.classList.add('is-closing');
    timer = setTimeout(function () { page.hidden = true; page.classList.remove('is-closing'); }, reduceMotion ? 0 : EXIT_MS);
    if (lastFocus && lastFocus.focus && doc.contains(lastFocus)) lastFocus.focus({ preventScroll: true });
  }
  function requestClose() {             // close button / Esc: step back through history like the phone's back button
    if (!isOpen) return;
    if (history.state && history.state.infinitiPage) {
      history.back();
      setTimeout(function () { if (isOpen) close(); }, 450);   // safety net if popstate never arrives
    } else close();
  }

  // The dock slides in while the envelope is still leaving: a tap in that last second opens the
  // page right after the opening has finished (so the opening never pulls focus out of it).
  var scene = doc.getElementById('envelopeScene'), waiting = false;
  btn.addEventListener('click', function () {
    if (!scene || scene.hidden) return open();
    if (waiting) return;
    waiting = true;
    var mo = new MutationObserver(function () { if (scene.hidden) { mo.disconnect(); waiting = false; open(); } });
    mo.observe(scene, { attributes: true, attributeFilter: ['hidden'] });
  });
  closeBtn.addEventListener('click', requestClose);
  window.addEventListener('popstate', function () { if (isOpen) close(); });
  doc.addEventListener('keydown', function (e) {
    if (!isOpen) return;
    if (e.key === 'Escape' || e.key === 'Esc') { e.preventDefault(); requestClose(); return; }
    if (e.key !== 'Tab') return;        // keep focus inside the dialog
    var f = Array.prototype.slice.call(page.querySelectorAll('button, a[href]'));
    if (!f.length) return;
    var first = f[0], last = f[f.length - 1];
    if (e.shiftKey && (doc.activeElement === first || !page.contains(doc.activeElement))) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && (doc.activeElement === last || !page.contains(doc.activeElement))) { e.preventDefault(); first.focus(); }
  });
  // a reload while the page was open leaves our history entry behind: drop its marker
  try { if (history.state && history.state.infinitiPage) history.replaceState(null, ''); } catch (e) {}

  window.__infinitiPage = { open: open, close: requestClose, get isOpen() { return isOpen; }, whatsappHref: waHref };
})();
