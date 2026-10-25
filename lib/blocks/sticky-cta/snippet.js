// Sticky CTA bar (docs/DECISIONS.md D-050): with "after the first section", the bar shows once the
// first section leaves the viewport. html.lp-js tells CSS the script runs, so without JavaScript
// the bar is simply always there. In the editor canvas it always shows. Budget: 512 bytes.
document.documentElement.classList.add('lp-js');
document.querySelectorAll('[data-lp-sticky]').forEach((bar) => {
  if (bar.hasAttribute('data-lp-ready')) return;
  bar.setAttribute('data-lp-ready', '');
  const first = [...document.querySelectorAll('.lp-s')].find((s) => !s.contains(bar));
  const on = (value) => bar.classList.toggle('lp-sticky--on', value);
  if (!bar.hasAttribute('data-reveal') || bar.closest('[data-lp-block]') || !first) return on(true);
  new IntersectionObserver(([entry]) => on(!entry.isIntersecting)).observe(first);
});
