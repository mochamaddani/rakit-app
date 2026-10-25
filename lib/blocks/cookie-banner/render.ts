import type { RenderContext } from '@/lib/renderer/context';
import { html, type SafeHtml } from '@/lib/renderer/html';
import type { CookieBannerProps } from './schema';

// A notice, not a consent gate: tracking loads either way (docs/DECISIONS.md D-050). Hidden until
// snippet.js shows it to a visitor who hasn't dismissed it; the canvas always shows it.
export function renderCookieBanner(props: CookieBannerProps, ctx: RenderContext): SafeHtml {
  const message = props.message
    ? html`<span${ctx.field('message', 'rich')}>${ctx.rich(props.message)}</span>`
    : ctx.t('cookieNotice');
  const privacy = props.privacyLink
    ? html` <a href="${ctx.resolveLink(props.privacyLink)}">${ctx.t('privacy')}</a>`
    : '';
  const button = props.buttonLabel
    ? html`<button type="button" class="lp-btn lp-cookie__ok"${ctx.field('buttonLabel', 'text')}>${ctx.text(
        props.buttonLabel,
      )}</button>`
    : html`<button type="button" class="lp-btn lp-cookie__ok">${ctx.t('cookieOk')}</button>`;
  return html`<section class="lp-cookie" data-lp-cookie aria-label="${ctx.t('cookieRegion')}"${
    ctx.mode === 'export' ? html` hidden` : ''
  }><p class="lp-cookie__text">${message}${privacy}</p>${button}</section>`;
}
