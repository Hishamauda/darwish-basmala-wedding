/* Youth festival: an isolated dialog launched by the seventh navigation item.
   The invitation, other dialogs, music and visual layout are not modified. */
(function () {
  'use strict';
  var doc = document, root = doc.documentElement, body = doc.body;
  var btn = doc.getElementById('youthButton');
  var page = doc.getElementById('youthPage');
  var closeBtn = doc.getElementById('youthClose');
  var main = doc.getElementById('main'), dock = doc.getElementById('dock');
  if (!btn || !page || !closeBtn || !main || !dock) return;
  var isOpen = false, savedY = 0, savedStyle = null, prevMainInert = false, prevDockInert = false, focusBefore = null;

  function open() {
    if (isOpen || !root.classList.contains('is-open')) return;
    doc.dispatchEvent(new CustomEvent('youth:open')); // cancel auto scroll and its pending timer
    isOpen = true;
    savedY = window.scrollY;
    focusBefore = doc.activeElement;
    prevMainInert = main.inert; prevDockInert = dock.inert;
    savedStyle = { position: body.style.position, top: body.style.top, left: body.style.left,
      right: body.style.right, width: body.style.width };
    page.hidden = false;
    page.scrollTop = 0;
    var dialog = page.querySelector('.youth-dialog');
    if (dialog) dialog.scrollTop = 0;
    main.inert = true; dock.inert = true;
    body.style.position = 'fixed'; body.style.top = (-savedY) + 'px';
    body.style.left = '0'; body.style.right = '0'; body.style.width = '100%';
    btn.setAttribute('aria-expanded', 'true');
    void page.offsetWidth;
    page.classList.add('is-open');
    try { history.pushState({ youthPage: true }, ''); } catch (e) {}
    closeBtn.focus({ preventScroll: true });
  }
  function close() {
    if (!isOpen) return;
    isOpen = false;
    page.classList.remove('is-open');
    page.hidden = true;
    if (savedStyle) {
      Object.keys(savedStyle).forEach(function (k) { body.style[k] = savedStyle[k]; });
    }
    main.inert = prevMainInert; dock.inert = prevDockInert;
    btn.setAttribute('aria-expanded', 'false');
    var b = root.style.scrollBehavior;
    root.style.scrollBehavior = 'auto';
    window.scrollTo(0, savedY);
    root.style.scrollBehavior = b;
    if (focusBefore && focusBefore.isConnected && focusBefore.focus) focusBefore.focus({ preventScroll: true });
  }
  function requestClose() {
    if (!isOpen) return;
    if (history.state && history.state.youthPage) {
      history.back();
      setTimeout(function () { if (isOpen) close(); }, 450);
    } else close();
  }
  btn.addEventListener('click', open);
  closeBtn.addEventListener('click', requestClose);
  page.addEventListener('click', function (event) { if (event.target === page) requestClose(); });
  window.addEventListener('popstate', function () { if (isOpen) close(); });
  doc.addEventListener('keydown', function (event) {
    if (!isOpen) return;
    if (event.key === 'Escape') { event.preventDefault(); requestClose(); return; }
    if (event.key === 'Tab') {
      event.preventDefault(); closeBtn.focus({ preventScroll: true });
    }
  });
  try { if (history.state && history.state.youthPage) history.replaceState(null, ''); } catch (e) {}
  window.__youthPage = { open: open, close: requestClose, get isOpen() { return isOpen; } };
})();
