import type { RenderContext } from '@/lib/renderer/context';
import { renderCta } from '@/lib/renderer/fragments';
import { html, type SafeHtml } from '@/lib/renderer/html';
import type { StickyCtaProps } from './schema';

// A bar fixed to the bottom of the viewport (docs/DECISIONS.md D-050). Its own stylesheet collapses
// the band it sits in, so it needs no special case in the renderer or in drag and drop.
export function renderStickyCta(props: StickyCtaProps, ctx: RenderContext): SafeHtml {
  return html`<div class="lp-sticky lp-sticky--${props.showOn}" data-lp-sticky${
    props.reveal === 'afterFirstSection' ? html` data-reveal` : ''
  }><div class="lp-sticky__inner">${
    props.text
      ? html`<p class="lp-sticky__text"${ctx.field('text', 'text')}>${ctx.text(props.text)}</p>`
      : ''
  }${renderCta(props.cta, ctx, { field: 'cta.label' })}</div></div>`;
}
