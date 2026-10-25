import type { RenderContext } from '@/lib/renderer/context';
import { renderCta, renderIcon, renderImage } from '@/lib/renderer/fragments';
import { html, type SafeHtml } from '@/lib/renderer/html';
import { ASPECT_RATIOS } from '@/lib/schema/primitives';
import type { ImageTextProps } from './schema';

// The image comes first in the markup so it stacks above the text on phones; from 640 px a class
// puts it on the chosen side.
export function renderImageText(props: ImageTextProps, ctx: RenderContext): SafeHtml {
  const media = html`<div class="lp-image-text__media">${renderImage(
    props.image,
    {
      className: 'lp-image-text__img',
      aspectRatio: props.aspectRatio,
      eager: ctx.aboveFold,
      highPriority: ctx.highPriority,
    },
    ctx,
  )}</div>`;
  const points = props.points.map(
    (point, i) =>
      html`<li>${renderIcon('check')}<span${ctx.field(`points.${i}.text`, 'text')}>${ctx.text(
        point.text,
      )}</span></li>`,
  );
  const text = html`<div class="lp-image-text__text">${
    props.eyebrow
      ? html`<p class="lp-image-text__eyebrow"${ctx.field('eyebrow', 'text')}>${ctx.text(props.eyebrow)}</p>`
      : ''
  }<h2 class="lp-h2"${ctx.field('heading', 'rich')}>${ctx.rich(props.heading)}</h2>${
    props.body
      ? html`<p class="lp-image-text__body"${ctx.field('body', 'rich')}>${ctx.rich(props.body)}</p>`
      : ''
  }${points.length > 0 ? html`<ul class="lp-image-text__points">${points}</ul>` : ''}${
    props.cta ? html`<div>${renderCta(props.cta, ctx, { field: 'cta.label' })}</div>` : ''
  }</div>`;
  return html`<div class="lp-image-text lp-image-text--${props.imageSide}" style="--lp-ar:${
    ASPECT_RATIOS[props.aspectRatio]
  }">${media}${text}</div>`;
}
