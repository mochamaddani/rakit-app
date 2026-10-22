import type { RenderContext } from '@/lib/renderer/context';
import { renderIcon } from '@/lib/renderer/fragments';
import { html, type SafeHtml } from '@/lib/renderer/html';
import type { BenefitsProps } from './schema';

export function renderBenefits(props: BenefitsProps, ctx: RenderContext): SafeHtml {
  const items = props.items.map(
    (item) =>
      html`<li class="lp-benefit">${
        item.icon === 'none'
          ? ''
          : html`<span class="lp-benefit__icon">${renderIcon(item.icon)}</span>`
      }<h3 class="lp-h3">${ctx.text(item.title)}</h3>${item.text ? html`<p>${ctx.rich(item.text)}</p>` : ''}</li>`,
  );
  return html`<div class="lp-benefits lp-benefits--${props.variant}" style="--lp-cols:${props.columns}">${
    props.heading ? html`<h2 class="lp-h2">${ctx.rich(props.heading)}</h2>` : ''
  }${props.subheading ? html`<p class="lp-sub">${ctx.rich(props.subheading)}</p>` : ''}${
    items.length > 0 ? html`<ul class="lp-benefits__list">${items}</ul>` : ''
  }</div>`;
}
