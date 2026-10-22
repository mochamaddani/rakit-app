import type { RenderContext } from '@/lib/renderer/context';
import { html, type SafeHtml } from '@/lib/renderer/html';
import type { FaqProps } from './schema';

// Native <details>/<summary>: works without JavaScript (PRD §6.3).
export function renderFaq(props: FaqProps, ctx: RenderContext): SafeHtml {
  const group = props.exclusive ? html` name="faq-${ctx.block.blockId}"` : '';
  const items = props.items.map(
    (item, i) =>
      html`<details class="lp-faq__item"${group}${
        props.openFirst && i === 0 ? html` open` : ''
      }><summary class="lp-faq__q">${ctx.text(item.question)}</summary><div class="lp-faq__a">${ctx.rich(
        item.answer,
      )}</div></details>`,
  );
  return html`<div class="lp-faq">${
    props.heading ? html`<h2 class="lp-h2">${ctx.rich(props.heading)}</h2>` : ''
  }${items}</div>`;
}
