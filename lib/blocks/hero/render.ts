import type { RenderContext } from '@/lib/renderer/context';
import { renderCta, renderImage } from '@/lib/renderer/fragments';
import { html, type SafeHtml } from '@/lib/renderer/html';
import type { HeroProps } from './schema';

export function renderHero(props: HeroProps, ctx: RenderContext): SafeHtml {
  const headline = ctx.rich(props.headline);
  // Only the first block on the page owns the page's h1.
  const marker = ctx.field('headline', 'rich');
  const heading = ctx.isFirstBlock
    ? html`<h1 class="lp-h1"${marker}>${headline}</h1>`
    : html`<h2 class="lp-h1"${marker}>${headline}</h2>`;
  const ctas = (['primaryCta', 'secondaryCta'] as const).flatMap((key) => {
    const cta = props[key];
    return cta ? [renderCta(cta, ctx, { field: `${key}.label` })] : [];
  });

  const text = html`<div class="lp-hero__text">${
    props.eyebrow
      ? html`<p class="lp-eyebrow"${ctx.field('eyebrow', 'text')}>${ctx.text(props.eyebrow)}</p>`
      : ''
  }${heading}${
    props.subheadline
      ? html`<p class="lp-lead"${ctx.field('subheadline', 'rich')}>${ctx.rich(props.subheadline)}</p>`
      : ''
  }${ctas.length > 0 ? html`<div class="lp-actions">${ctas}</div>` : ''}${
    props.trustLine
      ? html`<p class="lp-trust"${ctx.field('trustLine', 'text')}>${ctx.text(props.trustLine)}</p>`
      : ''
  }</div>`;

  const media = props.image
    ? html`<div class="lp-hero__media">${renderImage(
        props.image,
        { className: 'lp-hero__img', eager: ctx.aboveFold, highPriority: ctx.highPriority },
        ctx,
      )}</div>`
    : '';

  return html`<div class="lp-hero lp-hero--${props.layout} lp-hero--${props.align}">${text}${media}</div>`;
}
