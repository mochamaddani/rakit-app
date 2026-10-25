// Click-to-play video (docs/DECISIONS.md D-052): the facade link opens the video on YouTube/Vimeo
// without JavaScript; with it, a plain click swaps in the player, so no player request happens
// before the visitor asks. Export only. esbuild wraps this in an IIFE. Budget: 768 bytes.
document.querySelectorAll('[data-lp-video]').forEach((link) => {
  if (link.hasAttribute('data-lp-ready')) return;
  link.setAttribute('data-lp-ready', '');
  link.addEventListener('click', (event) => {
    if (event.button || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    const frame = document.createElement('iframe');
    frame.src = link.getAttribute('data-lp-video');
    frame.title = link.getAttribute('data-lp-title');
    frame.setAttribute('allow', 'autoplay; encrypted-media; picture-in-picture; fullscreen');
    frame.setAttribute('allowfullscreen', '');
    link.replaceWith(frame);
    frame.focus();
  });
});
