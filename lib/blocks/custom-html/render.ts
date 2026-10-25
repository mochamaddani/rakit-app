import { asset as baseCss } from '@/lib/renderer/base.generated';
import type { RenderContext } from '@/lib/renderer/context';
import { escapeInlineStyle, html, unsafeRaw, type SafeHtml } from '@/lib/renderer/html';
import { themeCss } from '@/lib/renderer/theme-css';
import { sanitizeHtml } from '@/lib/sanitize/html';
import type { CustomHtmlProps } from './schema';

/** Reports the frame's content height to the canvas, which sizes the frame (clamped there). */
const HEIGHT_REPORTER =
  "(function(){var r=function(){parent.postMessage({lpHeight:document.documentElement.scrollHeight},'*')};addEventListener('load',r);if(window.ResizeObserver)new ResizeObserver(r).observe(document.documentElement);r()})()";

// Owner code (docs/DECISIONS.md D-053). Export: sanitized, or verbatim with "Run scripts".
// Preview: never in the canvas document; only inside a nested sandboxed frame, a second opaque
// origin that can't read the canvas DOM or its channel id.
export function renderCustomHtml(props: CustomHtmlProps, ctx: RenderContext): SafeHtml {
  const content = props.runScripts ? props.html : sanitizeHtml(props.html).html;
  if (ctx.mode === 'export') return html`<div class="lp-custom">${unsafeRaw(content)}</div>`;
  const style = `${themeCss(ctx.settings.theme)}${baseCss.min}body{margin:0;background:transparent}`;
  const srcdoc = `<!doctype html><html lang="${ctx.lang}"><head><meta charset="utf-8"><style>${escapeInlineStyle(
    style,
  )}</style></head><body>${content}<script>${HEIGHT_REPORTER}</script></body></html>`;
  return html`<iframe class="lp-custom__frame" sandbox="allow-scripts" title="${
    props.blockName.trim() || ctx.t('customHtml')
  }" data-lp-custom-frame srcdoc="${srcdoc}"></iframe>`;
}
