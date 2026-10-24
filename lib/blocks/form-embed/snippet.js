// Turns a provider's submit message into Lead (docs/DECISIONS.md D-048): only from an iframe inside
// the form's own root, only from the provider's origin, once per form. Storelink tracks itself and
// ships no snippet. The page runtime sends `lp:track` on to the vendors.
(function () {
  var doc = document;
  var root = doc.documentElement;
  if (root.hasAttribute('data-lp-form-ready')) return;
  root.setAttribute('data-lp-form-ready', '');
  var SIGNALS = {
    tally: {
      origin: 'https://tally.so',
      match: function (data) {
        return typeof data == 'string' && data.indexOf('Tally.FormSubmitted') > -1;
      },
    },
  };
  window.addEventListener('message', function (e) {
    [].forEach.call(doc.querySelectorAll('[data-lp-form]'), function (form) {
      var signal = SIGNALS[form.getAttribute('data-lp-form')];
      if (!signal || form.hasAttribute('data-lp-sent')) return;
      if (e.origin != signal.origin || !signal.match(e.data)) return;
      var fromForm = [].some.call(form.querySelectorAll('iframe'), function (frame) {
        return frame.contentWindow === e.source;
      });
      if (!fromForm) return;
      form.setAttribute('data-lp-sent', '');
      doc.dispatchEvent(new CustomEvent('lp:track', { detail: { name: 'Lead', params: {} } }));
      var to = form.getAttribute('data-lp-thanks');
      if (to && /^https?:\/\//i.test(to))
        setTimeout(function () {
          location.assign(to);
        }, 500);
    });
  });
})();
