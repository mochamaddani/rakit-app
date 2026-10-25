import type { RenderContext } from '@/lib/renderer/context';
import { discountPercent, formatPrice } from '@/lib/renderer/format';
import { renderCta, renderIcon, renderImage, renderStars } from '@/lib/renderer/fragments';
import { html, type SafeHtml } from '@/lib/renderer/html';
import { toPlainText } from '@/lib/renderer/inline';
import { ASPECT_RATIOS } from '@/lib/schema/primitives';
import type { ProductCarouselProps, ProductItem } from './schema';

// Scroll-snap markup that swipes natively without JavaScript; snippet.js only adds arrows, dots,
// keyboard support and the active-slide state (PRD §6.4.1).

const GAP_PX = { sm: 8, md: 16, lg: 24 } as const;
const cssNumber = (n: number) => String(Math.round(n * 100) / 100);

function renderPrice(item: ProductItem, ctx: RenderContext): SafeHtml | '' {
  if (item.price === undefined) return '';
  const format = ctx.settings.price;
  const was =
    item.compareAtPrice !== undefined && item.compareAtPrice > item.price
      ? html` <s class="lp-price__was"><span class="lp-sr">${ctx.t('originalPrice')}</span> ${formatPrice(
          item.compareAtPrice,
          format,
        )}</s>`
      : '';
  return html`<p class="lp-price"><span class="lp-price__now">${formatPrice(item.price, format)}</span>${was}</p>`;
}

function renderRating(item: ProductItem, ctx: RenderContext): SafeHtml | '' {
  if (item.rating === undefined) return '';
  const count =
    item.reviewCount === undefined
      ? ''
      : html`<span class="lp-rating__count">(${ctx.t('reviews', { count: item.reviewCount })})</span>`;
  return html`<div class="lp-rating">${renderStars(item.rating, ctx)}${count}</div>`;
}

function renderSlide(
  item: ProductItem,
  index: number,
  props: ProductCarouselProps,
  ctx: RenderContext,
): SafeHtml {
  // Only the cards visible on a phone's first screen load eagerly, and only above the fold.
  const eager = ctx.aboveFold && index < Math.ceil(props.slidesPerView.mobile);
  const discount = item.showDiscount ? discountPercent(item.price, item.compareAtPrice) : null;
  const media = html`<div class="lp-card__media">${renderImage(
    item.image,
    {
      className: 'lp-card__img',
      aspectRatio: props.aspectRatio,
      eager,
      highPriority: ctx.highPriority && index === 0,
    },
    ctx,
  )}${
    item.badge
      ? html`<span class="lp-badge"${ctx.field(`items.${index}.badge`, 'text')}>${ctx.text(item.badge)}</span>`
      : ''
  }${
    discount === null ? '' : html`<span class="lp-badge lp-badge--discount">-${discount}%</span>`
  }</div>`;
  const cta = item.cta.label
    ? renderCta(
        { label: item.cta.label, link: item.cta.link, variant: 'primary', event: 'none' },
        ctx,
        {
          className: 'lp-btn--block',
          dataAttrs: { 'lp-item': item.id },
          field: `items.${index}.cta.label`,
        },
      )
    : '';
  const body = html`<div class="lp-card__body"><h3 class="lp-card__title"${ctx.field(
    `items.${index}.title`,
    'text',
  )}>${ctx.text(item.title)}</h3>${
    item.description
      ? html`<p class="lp-card__desc"${ctx.field(`items.${index}.description`, 'rich')}>${ctx.rich(
          item.description,
        )}</p>`
      : ''
  }${renderRating(item, ctx)}${renderPrice(item, ctx)}${cta}</div>`;
  const label = `${ctx.t('slideLabel', { n: index + 1, total: props.items.length })}: ${item.title}`;
  return html`<div class="lp-carousel__slide" role="group" aria-roledescription="slide" aria-label="${label}" id="${ctx.domId(
    item.id,
  )}"><article class="lp-card">${media}${body}</article></div>`;
}

function renderNav(props: ProductCarouselProps, ctx: RenderContext): SafeHtml | '' {
  if ((props.navigation === 'none' && !props.autoplay) || props.items.length < 2) return '';
  // Moving content needs a way to stop it (WCAG 2.2.2); the label swaps when it is pressed.
  const play = props.autoplay
    ? html`<button type="button" class="lp-carousel__play" aria-label="${ctx.t(
        'pauseSlides',
      )}" data-lp-play="${ctx.t('playSlides')}">${renderIcon('pause', 'lp-icon lp-icon--pause')}${renderIcon(
        'play',
        'lp-icon lp-icon--play',
      )}</button>`
    : '';
  const arrows = props.navigation === 'arrows' || props.navigation === 'both';
  const dots = props.navigation === 'dots' || props.navigation === 'both';
  const prev = arrows
    ? html`<button type="button" class="lp-carousel__arrow lp-carousel__prev" aria-label="${ctx.t(
        'prevSlide',
      )}" data-lp-prev>${renderIcon('chevron-left')}</button>`
    : '';
  const next = arrows
    ? html`<button type="button" class="lp-carousel__arrow lp-carousel__next" aria-label="${ctx.t(
        'nextSlide',
      )}" data-lp-next>${renderIcon('chevron-right')}</button>`
    : '';
  const dotList = dots
    ? html`<div class="lp-carousel__dots">${props.items.map(
        (_, i) =>
          html`<button type="button" class="lp-carousel__dot" aria-label="${ctx.t('goToSlide', {
            n: i + 1,
          })}" aria-current="${i === 0 ? 'true' : 'false'}" data-lp-dot="${i}"></button>`,
      )}</div>`
    : '';
  // Hidden until the script runs: without JavaScript the track still swipes and scrolls.
  return html`<div class="lp-carousel__nav" hidden>${play}${prev}${dotList}${next}</div>`;
}

export function renderProductCarousel(props: ProductCarouselProps, ctx: RenderContext): SafeHtml {
  const label = props.heading ? toPlainText(props.heading) : ctx.t('products');
  const classes = props.arrowsOnTouch ? 'lp-carousel lp-carousel--touch-arrows' : 'lp-carousel';
  const { mobile, tablet, desktop } = props.slidesPerView;
  const style = [
    `--lp-spv-m:${cssNumber(mobile)}`,
    `--lp-spv-t:${cssNumber(tablet)}`,
    `--lp-spv-d:${cssNumber(desktop)}`,
    `--lp-gap:${GAP_PX[props.gap]}px`,
    `--lp-ar:${ASPECT_RATIOS[props.aspectRatio]}`,
    `--lp-fit:${props.imageFit}`,
  ].join(';');
  const head =
    props.heading || props.subheading
      ? html`<div class="lp-carousel__head">${
          props.heading
            ? html`<h2 class="lp-h2"${ctx.field('heading', 'rich')}>${ctx.rich(props.heading)}</h2>`
            : ''
        }${
          props.subheading
            ? html`<p class="lp-sub"${ctx.field('subheading', 'rich')}>${ctx.rich(props.subheading)}</p>`
            : ''
        }</div>`
      : '';
  const slides = props.items.map((item, i) => renderSlide(item, i, props, ctx));
  const autoplay =
    props.autoplay && props.items.length > 1
      ? html` data-autoplay="${String(props.autoplaySeconds)}"`
      : '';
  // An empty track has nothing to scroll, so it takes no keyboard focus (M0/M1 review m-4).
  const focusable = props.items.length > 0 ? html` tabindex="0"` : '';
  return html`<section class="${classes}" aria-roledescription="carousel" aria-label="${label}" data-lp-carousel data-loop="${
    props.loop ? '1' : '0'
  }"${autoplay} style="${style}">${head}<div class="lp-carousel__track"${focusable}>${slides}</div>${renderNav(
    props,
    ctx,
  )}</section>`;
}
