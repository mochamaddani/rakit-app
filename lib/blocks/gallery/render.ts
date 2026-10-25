import type { RenderContext } from '@/lib/renderer/context';
import { renderImage } from '@/lib/renderer/fragments';
import { html, type SafeHtml } from '@/lib/renderer/html';
import { ASPECT_RATIOS } from '@/lib/schema/primitives';
import type { GalleryProps } from './schema';

export function renderGallery(props: GalleryProps, ctx: RenderContext): SafeHtml {
  const style = [
    `--lp-cols-m:${props.columns.mobile}`,
    `--lp-cols-d:${props.columns.desktop}`,
    `--lp-ar:${ASPECT_RATIOS[props.aspectRatio]}`,
    `--lp-fit:${props.imageFit}`,
  ].join(';');
  const items = props.items.map(
    (item, i) =>
      html`<figure class="lp-gallery__item">${renderImage(
        item.image,
        {
          className: 'lp-gallery__img',
          aspectRatio: props.aspectRatio,
          eager: ctx.aboveFold && i < props.columns.mobile * 2,
          highPriority: ctx.highPriority && i === 0,
        },
        ctx,
      )}${
        item.caption
          ? html`<figcaption class="lp-gallery__caption"${ctx.field(`items.${i}.caption`, 'text')}>${ctx.text(
              item.caption,
            )}</figcaption>`
          : ''
      }</figure>`,
  );
  return html`<div class="lp-gallery" style="${style}">${
    props.heading
      ? html`<h2 class="lp-h2"${ctx.field('heading', 'rich')}>${ctx.rich(props.heading)}</h2>`
      : ''
  }${
    props.subheading
      ? html`<p class="lp-sub"${ctx.field('subheading', 'rich')}>${ctx.rich(props.subheading)}</p>`
      : ''
  }${items.length > 0 ? html`<div class="lp-gallery__grid">${items}</div>` : ''}</div>`;
}
