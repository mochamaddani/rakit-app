import { escapeInlineScript, html, unsafeRaw, type SafeHtml } from '@/lib/renderer/html';
import type { TrackingSettings } from '@/lib/schema/settings';

// Vendor tags for exported pages only (docs/DECISIONS.md D-047). Ids are validated by the settings
// schema; they still go through JSON.stringify and escapeInlineScript. The renderer emits this code
// as text: the event id expression runs in the visitor's browser, never here.

const EVENT_ID_JS = "Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,10)";

const META_BASE =
  "!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');";

const GTM_HEAD = (id: string) =>
  `(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src='https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);})(window,document,'script','dataLayer',${JSON.stringify(id)});`;

const inlineScript = (code: string) =>
  html`<script>${unsafeRaw(escapeInlineScript(code))}</script>`;
const js = (value: string) => JSON.stringify(value);

/** Meta base code with PageView, gtag.js with one config per id, and the GTM head snippet. */
export function renderTrackingHead(tracking: TrackingSettings): SafeHtml {
  const parts: SafeHtml[] = [];
  if (tracking.metaPixelId) {
    parts.push(
      inlineScript(
        `${META_BASE}fbq("init",${js(tracking.metaPixelId)});fbq("track","PageView",{},{eventID:${EVENT_ID_JS}});`,
      ),
    );
  }
  const gtagIds = [tracking.ga4Id, tracking.googleAdsId].filter(Boolean);
  if (gtagIds.length > 0) {
    parts.push(
      html`<script async src="https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(
        gtagIds[0]!,
      )}"></script>`,
      inlineScript(
        `window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments)}gtag("js",new Date());${gtagIds
          .map((id) => `gtag("config",${js(id)});`)
          .join('')}`,
      ),
    );
  }
  if (tracking.gtmId) parts.push(inlineScript(GTM_HEAD(tracking.gtmId)));
  return html`${parts}`;
}

/** The GTM and Meta <noscript> fallbacks, first in <body>. */
export function renderTrackingBodyStart(tracking: TrackingSettings): SafeHtml {
  const gtm = tracking.gtmId
    ? html`<noscript><iframe src="https://www.googletagmanager.com/ns.html?id=${encodeURIComponent(
        tracking.gtmId,
      )}" height="0" width="0" style="display:none;visibility:hidden" title="Google Tag Manager"></iframe></noscript>`
    : '';
  const meta = tracking.metaPixelId
    ? html`<noscript><img height="1" width="1" alt="" style="display:none" src="https://www.facebook.com/tr?id=${encodeURIComponent(
        tracking.metaPixelId,
      )}&amp;ev=PageView&amp;noscript=1"></noscript>`
    : '';
  return html`${gtm}${meta}`;
}

/** `data-lp-gtm` and `data-lp-conversion="AW-…/label"` on <body>, read by the page runtime. */
export function trackingBodyAttributes(tracking: TrackingSettings): SafeHtml {
  const conversion =
    tracking.googleAdsId && tracking.googleAdsLeadLabel
      ? html` data-lp-conversion="${tracking.googleAdsId}/${tracking.googleAdsLeadLabel}"`
      : '';
  return html`${tracking.gtmId ? html` data-lp-gtm` : ''}${conversion}`;
}
