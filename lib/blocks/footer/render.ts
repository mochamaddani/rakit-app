import type { RenderContext } from '@/lib/renderer/context';
import { html, type SafeHtml } from '@/lib/renderer/html';
import type { FooterProps } from './schema';

export function renderFooter(props: FooterProps, ctx: RenderContext): SafeHtml {
  const links = props.links.map(
    (item, i) =>
      html`<li><a href="${ctx.resolveLink(item.link)}"${
        item.link.kind === 'url' && item.link.newTab ? html` target="_blank" rel="noopener"` : ''
      }${ctx.field(`links.${i}.label`, 'text')}>${ctx.text(item.label)}</a></li>`,
  );
  return html`<footer class="lp-footer">${
    props.brand
      ? html`<p class="lp-footer__brand"${ctx.field('brand', 'text')}>${ctx.text(props.brand)}</p>`
      : ''
  }${
    links.length > 0
      ? html`<nav class="lp-footer__nav" aria-label="${ctx.t('links')}"><ul>${links}</ul></nav>`
      : ''
  }${
    props.disclaimer
      ? html`<p class="lp-disclaimer"${ctx.field('disclaimer', 'rich')}>${ctx.rich(props.disclaimer)}</p>`
      : ''
  }${
    props.copyright
      ? html`<p class="lp-footer__copy"${ctx.field('copyright', 'text')}>${ctx.text(props.copyright)}</p>`
      : ''
  }</footer>`;
}
