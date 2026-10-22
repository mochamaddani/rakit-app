import type { RenderContext } from '@/lib/renderer/context';
import { renderImage, renderStars } from '@/lib/renderer/fragments';
import { html, type SafeHtml } from '@/lib/renderer/html';
import type { TestimonialsProps } from './schema';

type Testimonial = TestimonialsProps['items'][number];

function renderQuote(item: Testimonial, ctx: RenderContext): SafeHtml {
  const avatar = item.avatar
    ? renderImage(item.avatar, { className: 'lp-quote__avatar', aspectRatio: '1:1' }, ctx)
    : '';
  return html`<figure class="lp-quote">${
    item.rating === undefined ? '' : renderStars(item.rating, ctx)
  }<blockquote class="lp-quote__text"><p>${ctx.rich(item.quote)}</p></blockquote><figcaption class="lp-quote__by">${avatar}<span class="lp-quote__name">${ctx.text(
    item.name,
  )}</span>${item.detail ? html`<span class="lp-quote__detail">${ctx.text(item.detail)}</span>` : ''}</figcaption></figure>`;
}

export function renderTestimonials(props: TestimonialsProps, ctx: RenderContext): SafeHtml {
  const items = props.items.map((item) => renderQuote(item, ctx));
  return html`<div class="lp-testimonials lp-testimonials--${props.layout}">${
    props.heading ? html`<h2 class="lp-h2">${ctx.rich(props.heading)}</h2>` : ''
  }${items.length > 0 ? html`<div class="lp-testimonials__list">${items}</div>` : ''}</div>`;
}
