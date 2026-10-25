import type { RenderContext } from '@/lib/renderer/context';
import { renderVideo } from '@/lib/renderer/fragments';
import { html, type SafeHtml } from '@/lib/renderer/html';
import type { VideoProps } from './schema';

export function renderVideoBlock(props: VideoProps, ctx: RenderContext): SafeHtml {
  return html`<div class="lp-video-block">${
    props.heading
      ? html`<h2 class="lp-h2"${ctx.field('heading', 'rich')}>${ctx.rich(props.heading)}</h2>`
      : ''
  }${renderVideo(props.video, ctx, { eager: ctx.aboveFold, highPriority: ctx.highPriority })}${
    props.caption
      ? html`<p class="lp-video-block__caption"${ctx.field('caption', 'text')}>${ctx.text(props.caption)}</p>`
      : ''
  }</div>`;
}
