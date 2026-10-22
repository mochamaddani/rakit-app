// Product carousel enhancements (PRD §6.4.1): arrows, dots, keyboard and active-slide state.
// The carousel already swipes without this script (CSS scroll-snap). Every query stays inside its
// own [data-lp-carousel] root, so several carousels never interfere. esbuild wraps this in an IIFE.
// Budget: 1536 bytes minified (enforced by product-carousel.test.ts).
const reduceMotion = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;

document.querySelectorAll('[data-lp-carousel]').forEach((root) => {
  if (root.hasAttribute('data-lp-ready')) return;
  root.setAttribute('data-lp-ready', '');

  const track = root.querySelector('.lp-carousel__track');
  const slides = track ? [...track.children] : [];
  if (slides.length < 2) return;
  const nav = root.querySelector('.lp-carousel__nav');
  const prev = root.querySelector('[data-lp-prev]');
  const next = root.querySelector('[data-lp-next]');
  const dots = root.querySelectorAll('[data-lp-dot]');
  const loop = root.getAttribute('data-loop') === '1';
  const last = slides.length - 1;
  let first = 0; // first visible slide
  let frame = 0;

  const offset = (i) => slides[i].offsetLeft - slides[0].offsetLeft;
  const atStart = () => track.scrollLeft <= 1;
  const atEnd = () => track.scrollLeft + track.clientWidth >= track.scrollWidth - 2;

  const update = () => {
    frame = 0;
    let best = Infinity;
    slides.forEach((_, i) => {
      const distance = Math.abs(offset(i) - track.scrollLeft);
      if (distance < best) {
        best = distance;
        first = i;
      }
    });
    // Several cards can be visible at once: at the end, the last card is the active one.
    const current = atEnd() ? last : first;
    dots.forEach((dot, i) => dot.setAttribute('aria-current', i === current ? 'true' : 'false'));
    if (!loop) {
      if (prev) prev.disabled = atStart();
      if (next) next.disabled = atEnd();
    }
  };

  const go = (i) =>
    track.scrollTo({
      left: offset(Math.max(0, Math.min(last, i))),
      behavior: reduceMotion ? 'auto' : 'smooth',
    });

  // Steps from the first visible card, so "previous" always moves even when several are visible.
  const step = (direction) => {
    if (direction > 0 ? atEnd() : atStart()) {
      if (loop) go(direction > 0 ? 0 : last);
    } else {
      go(first + direction);
    }
  };

  if (nav) nav.hidden = false;
  if (prev) prev.addEventListener('click', () => step(-1));
  if (next) next.addEventListener('click', () => step(1));
  dots.forEach((dot, i) => dot.addEventListener('click', () => go(i)));
  track.addEventListener(
    'scroll',
    () => {
      if (!frame) frame = requestAnimationFrame(update);
    },
    { passive: true },
  );
  track.addEventListener('keydown', (event) => {
    const key = event.key;
    if (key === 'ArrowLeft') step(-1);
    else if (key === 'ArrowRight') step(1);
    else if (key === 'Home') go(0);
    else if (key === 'End') go(last);
    else return;
    event.preventDefault();
  });
  update();
});
