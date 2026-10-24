// Page runtime for exported pages (docs/DECISIONS.md D-047), never shipped in preview.
// Events: a `lp:track` DOM event { name, params } or a click on [data-lp-event] goes to Meta Pixel,
// gtag and GTM with one event id each (D-021). Passthrough: incoming utm_* and click ids are kept
// for the tab and appended to outbound CTA links and form iframes that lack them.
// ES2017 has no optional catch binding, so the catch variables below stay unused.
/* eslint-disable @typescript-eslint/no-unused-vars */
(function () {
  var w = window;
  var doc = document;
  var body = doc.body;
  var GA = {
    Lead: 'generate_lead',
    Contact: 'contact',
    InitiateCheckout: 'begin_checkout',
    ViewContent: 'select_item',
  };
  var CLICK_IDS = ['gclid', 'fbclid', 'wbraid', 'gbraid'];
  var STORE = 'lp-params';

  function eventId() {
    var tail = '';
    var bytes = w.crypto.getRandomValues(new Uint8Array(8));
    for (var i = 0; i < 8; i++) tail += (bytes[i] % 36).toString(36);
    return Date.now().toString(36) + '-' + tail;
  }

  function track(name, params) {
    var id = eventId();
    var p = params || {};
    var ga = GA[name] || name;
    var conversion = body.getAttribute('data-lp-conversion');
    if (typeof w.fbq == 'function') w.fbq('track', name, p, { eventID: id });
    if (typeof w.gtag == 'function') {
      w.gtag('event', ga, Object.assign({}, p, { event_id: id }));
      if (name == 'Lead' && conversion)
        w.gtag('event', 'conversion', { send_to: conversion, transaction_id: id });
    }
    if (body.hasAttribute('data-lp-gtm'))
      (w.dataLayer = w.dataLayer || []).push(Object.assign({ event: ga, event_id: id }, p));
  }

  doc.addEventListener('lp:track', function (e) {
    var d = e.detail || {};
    if (d.name) track(d.name, d.params);
  });
  doc.addEventListener(
    'click',
    function (e) {
      var el = e.target && e.target.closest && e.target.closest('[data-lp-event]');
      if (el) track(el.getAttribute('data-lp-event'));
    },
    true,
  );

  var params = {};
  try {
    params = JSON.parse(sessionStorage.getItem(STORE)) || {};
  } catch (err) {
    params = {};
  }
  new URLSearchParams(location.search).forEach(function (value, key) {
    if ((key.indexOf('utm_') == 0 || CLICK_IDS.indexOf(key) > -1) && value.length <= 500)
      params[key] = value;
  });
  Object.keys(params)
    .slice(20)
    .forEach(function (k) {
      delete params[k];
    });
  var keys = Object.keys(params);
  try {
    sessionStorage.setItem(STORE, JSON.stringify(params));
  } catch (err) {
    // file:// or blocked storage: passthrough still works for this page view.
  }

  function nameOf(pair) {
    var name = pair.split('=')[0];
    try {
      return decodeURIComponent(name.replace(/\+/g, ' '));
    } catch (err) {
      return name;
    }
  }

  function pass(url) {
    if (!/^https?:/i.test(url)) return url;
    var at = url.indexOf('#');
    var hash = at < 0 ? '' : url.slice(at);
    var base = at < 0 ? url : url.slice(0, at);
    var q = base.indexOf('?');
    var have =
      q < 0
        ? []
        : base
            .slice(q + 1)
            .split('&')
            .map(nameOf);
    var add = keys
      .filter(function (k) {
        return have.indexOf(k) < 0;
      })
      .map(function (k) {
        return encodeURIComponent(k) + '=' + encodeURIComponent(params[k]);
      });
    if (!add.length) return url;
    var joiner = q < 0 ? '?' : /[?&]$/.test(base) ? '' : '&';
    return base + joiner + add.join('&') + hash;
  }

  function rewrite(selector, attr) {
    [].forEach.call(doc.querySelectorAll(selector), function (el) {
      var before = el.getAttribute(attr);
      var after = pass(before);
      if (after != before) el.setAttribute(attr, after);
    });
  }
  rewrite('a[data-lp-cta][href]', 'href');
  rewrite('iframe[data-lp-pass][src]', 'src');
})();
