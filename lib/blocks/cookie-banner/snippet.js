// Cookie notice (docs/DECISIONS.md D-050): shown until the visitor presses the button, then
// remembered in localStorage. Without storage (file://, blocked) it only forgets. In the editor
// canvas it always shows and the button does nothing. Budget: 512 bytes.
// ES2017 has no optional catch binding, so the catch variables below stay unused.
/* eslint-disable @typescript-eslint/no-unused-vars */
const KEY = 'lp-cookie-ok';
document.querySelectorAll('[data-lp-cookie]').forEach((banner) => {
  if (banner.hasAttribute('data-lp-ready') || banner.closest('[data-lp-block]')) return;
  banner.setAttribute('data-lp-ready', '');
  try {
    if (localStorage.getItem(KEY) === '1') return;
  } catch (err) {
    // Storage blocked: show the notice.
  }
  banner.hidden = false;
  banner.querySelector('button').addEventListener('click', () => {
    try {
      localStorage.setItem(KEY, '1');
    } catch (err) {
      // Storage blocked: the notice comes back next time.
    }
    banner.hidden = true;
    const main = document.querySelector('main');
    if (main) {
      main.setAttribute('tabindex', '-1');
      main.focus();
    }
  });
});
