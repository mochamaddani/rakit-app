import type { RenderContext } from '@/lib/renderer/context';
import { html, type SafeHtml } from '@/lib/renderer/html';
import type { SpacerProps } from './schema';

export function renderSpacer(props: SpacerProps, _ctx: RenderContext): SafeHtml {
  return html`<div class="lp-spacer lp-spacer--${props.size}" aria-hidden="true">${
    props.line ? html`<hr class="lp-spacer__line lp-spacer__line--${props.lineWidth}">` : ''
  }</div>`;
}
