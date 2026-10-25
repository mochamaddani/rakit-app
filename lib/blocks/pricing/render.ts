import type { RenderContext } from '@/lib/renderer/context';
import { discountPercent, formatPrice } from '@/lib/renderer/format';
import { renderCta, renderIcon } from '@/lib/renderer/fragments';
import { html, type SafeHtml } from '@/lib/renderer/html';
import type { Offer, PricingProps } from './schema';

function renderPrice(offer: Offer, ctx: RenderContext): SafeHtml | '' {
  if (offer.price === undefined) return '';
  const format = ctx.settings.price;
  const was =
    offer.compareAtPrice !== undefined && offer.compareAtPrice > offer.price
      ? html` <s class="lp-pricing__was"><span class="lp-sr">${ctx.t('originalPrice')}</span> ${formatPrice(
          offer.compareAtPrice,
          format,
        )}</s>`
      : '';
  const discount = offer.showDiscount ? discountPercent(offer.price, offer.compareAtPrice) : null;
  return html`<p class="lp-pricing__price"><span class="lp-pricing__now">${formatPrice(
    offer.price,
    format,
  )}</span>${was}${discount === null ? '' : html` <span class="lp-pricing__off">-${discount}%</span>`}</p>`;
}

function renderOffer(offer: Offer, i: number, ctx: RenderContext): SafeHtml {
  const at = `offers.${i}`;
  const features = offer.features.map(
    (feature, j) =>
      html`<li>${renderIcon('check')}<span${ctx.field(`${at}.features.${j}.text`, 'text')}>${ctx.text(
        feature.text,
      )}</span></li>`,
  );
  return html`<article class="lp-pricing__offer${offer.highlighted ? ' lp-pricing__offer--hl' : ''}">${
    offer.badge
      ? html`<span class="lp-pricing__badge"${ctx.field(`${at}.badge`, 'text')}>${ctx.text(offer.badge)}</span>`
      : ''
  }<h3 class="lp-h3"${ctx.field(`${at}.name`, 'text')}>${ctx.text(offer.name)}</h3>${
    offer.description
      ? html`<p class="lp-pricing__desc"${ctx.field(`${at}.description`, 'rich')}>${ctx.rich(
          offer.description,
        )}</p>`
      : ''
  }${renderPrice(offer, ctx)}${
    features.length > 0 ? html`<ul class="lp-pricing__features">${features}</ul>` : ''
  }${
    offer.cta
      ? renderCta(offer.cta, ctx, { className: 'lp-btn--block', field: `${at}.cta.label` })
      : ''
  }</article>`;
}

export function renderPricing(props: PricingProps, ctx: RenderContext): SafeHtml {
  return html`<div class="lp-pricing" style="--lp-offers:${Math.min(props.offers.length, 3)}">${
    props.heading
      ? html`<h2 class="lp-h2"${ctx.field('heading', 'rich')}>${ctx.rich(props.heading)}</h2>`
      : ''
  }${
    props.subheading
      ? html`<p class="lp-sub"${ctx.field('subheading', 'rich')}>${ctx.rich(props.subheading)}</p>`
      : ''
  }<div class="lp-pricing__offers">${props.offers.map((offer, i) => renderOffer(offer, i, ctx))}</div>${
    props.note
      ? html`<p class="lp-pricing__note"${ctx.field('note', 'text')}>${ctx.text(props.note)}</p>`
      : ''
  }</div>`;
}
