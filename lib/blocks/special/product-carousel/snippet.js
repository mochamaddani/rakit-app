// Product carousel enhancements (PRD §6.4.1): arrows, dots, keyboard, active-slide state and
// autoplay. The carousel already swipes without this script (CSS scroll-snap). Every query stays
// inside its own [data-lp-carousel] root, so several carousels never interfere. esbuild wraps this
// in an IIFE. Budget: 2048 bytes minified (enforced by product-carousel.test.ts; D-054).
// ARIA attributes are set through their reflected properties (ariaLabel, ariaCurrent, …).
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

document.querySelectorAll('[data-lp-carousel]').forEach((root) => {
  const data = root.dataset;
  if (data.lpReady != null) return;
  data.lpReady = '';
  const $ = (selector) => root.querySelector(selector);

  const track = $('.lp-carousel__track');
  const slides = track ? [...track.children] : [];
  if (slides.length < 2) return;
  const nav = $('.lp-carousel__nav');
  const prev = $('[data-lp-prev]');
  const next = $('[data-lp-next]');
  const play = $('[data-lp-play]');
  const dots = [...root.querySelectorAll('[data-lp-dot]')];
  const loop = data.loop === '1';
  const last = slides.length - 1;
  let first = 0; // first visible slide
  let target = -1; // where a scroll we started is heading, so fast clicks add up (m-3)
  let frame = 0;

  const offset = (i) => slides[i].offsetLeft - slides[0].offsetLeft;
  const atStart = () => track.scrollLeft <= 1;
  const atEnd = () => track.scrollLeft + track.clientWidth >= track.scrollWidth - 2;

  const update = () => {
    frame = 0;
    // Cards share one width, so the scroll position says which one is first.
    first = Math.min(last, Math.round(track.scrollLeft / offset(1)));
    // A scroll we started is done once it arrives or hits an edge.
    if (target < 0 || Math.abs(offset(target) - track.scrollLeft) < 2 || atEnd() || atStart()) {
      target = -1;
    }
    // One dot per scroll position: a dot whose card can't reach the left edge is hidden. Hidden
    // dots are always the trailing ones, so the visible count gives the last visible dot.
    const max = track.scrollWidth - track.clientWidth - 1;
    const shown = dots.filter((dot, i) => !(dot.hidden = i > 0 && offset(i - 1) >= max)).length - 1;
    const current = atEnd() ? shown : first;
    dots.forEach((dot, i) => (dot.ariaCurrent = i === current));
    // aria-disabled, not disabled: a disabled button drops keyboard focus to <body> at the edge.
    // Arrows always come as a pair.
    if (prev && !loop) {
      prev.ariaDisabled = atStart();
      next.ariaDisabled = atEnd();
    }
  };

  const go = (i) => {
    target = Math.max(0, Math.min(last, i));
    // Smooth through CSS, which base CSS turns off for reduced motion.
    track.scrollTo({ left: offset(target) });
  };

  // Steps from the first visible card (or a scroll still on its way), so "previous" always moves
  // even when several cards are visible.
  const step = (direction, wrap) => {
    if (target < 0 && (direction > 0 ? atEnd() : atStart())) {
      if (wrap) go(direction > 0 ? 0 : last);
    } else {
      go((target < 0 ? first : target) + direction);
    }
  };

  if (nav) nav.hidden = false;
  // Handler properties on our own elements: shorter than addEventListener, and nothing else
  // sets them. (The window's resize listener stays shared.)
  if (prev) {
    prev.onclick = () => step(-1, loop);
    next.onclick = () => step(1, loop);
  }
  dots.forEach((dot, i) => (dot.onclick = () => go(i)));
  track.onscroll = () => {
    if (!frame) frame = requestAnimationFrame(update);
  };
  // A swipe takes over from a scroll we started.
  track.onpointerdown = track.onwheel = () => (target = -1);
  const keys = {
    ArrowLeft: () => step(-1, loop),
    ArrowRight: () => step(1, loop),
    Home: () => go(0),
    End: () => go(last),
  };
  track.onkeydown = (event) => {
    const action = keys[event.key];
    if (action) {
      action();
      event.preventDefault();
    }
  };
  addEventListener('resize', update);
  update();

  // Autoplay (exported pages only, never with reduced motion): skips its turn while the carousel is
  // hovered, focused (except the pause button), off-screen or in a hidden tab. A swipe, click,
  // scroll or key in the carousel pauses it, and the pause button (WCAG 2.2.2) then says "Play"
  // and starts it again. Without autoplay running the button is hidden, never a dead control.
  const seconds = Number(data.autoplay);
  if (!play) return;
  if (!seconds || reduceMotion || root.closest('[data-lp-block]')) {
    play.hidden = true;
    return;
  }
  let paused = false;
  const pause = (value) => {
    if (value === paused) return;
    paused = value;
    const label = play.dataset.lpPlay;
    play.dataset.lpPlay = play.ariaLabel;
    play.ariaLabel = label;
    play.toggleAttribute('data-paused', paused);
  };
  ['pointerdown', 'wheel', 'keydown'].forEach((type) =>
    root.addEventListener(type, (event) => {
      if (!play.contains(event.target)) pause(true);
    }),
  );
  play.onclick = () => pause(!paused);
  const timer = setInterval(() => {
    if (!root.isConnected) return clearInterval(timer);
    const box = root.getBoundingClientRect();
    if (
      !paused &&
      !root.matches(':hover') &&
      !$(':focus:not([data-lp-play])') &&
      box.bottom > 0 &&
      box.top < innerHeight &&
      !document.hidden
    )
      step(1, true);
  }, seconds * 1000);
});
