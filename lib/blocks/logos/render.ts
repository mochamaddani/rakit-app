import type { RenderContext } from '@/lib/renderer/context';
import { renderImage } from '@/lib/renderer/fragments';
import { html, type SafeHtml } from '@/lib/renderer/html';
import type { LogosProps } from './schema';

export function renderLogos(props: LogosProps, ctx: RenderContext): SafeHtml {
  const classes = ['lp-logos', `lp-logos--${props.height}`, props.grayscale ? 'lp-logos--grey' : '']
    .filter(Boolean)
    .join(' ');
  const items = props.items.map(
    (item, i) =>
      html`<li class="lp-logos__item">${renderImage(
        item.image,
        {
          className: 'lp-logos__img',
          eager: ctx.aboveFold,
          highPriority: ctx.highPriority && i === 0,
        },
        ctx,
      )}</li>`,
  );
  return html`<div class="${classes}">${
    props.heading
      ? html`<p class="lp-logos__heading"${ctx.field('heading', 'text')}>${ctx.text(props.heading)}</p>`
      : ''
  }<ul class="lp-logos__list"${props.heading ? '' : html` aria-label="${ctx.t('logos')}"`}>${items}</ul></div>`;
}
