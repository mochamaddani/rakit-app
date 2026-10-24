import { collectCss, collectJs } from '@/lib/renderer/collect';
import { html } from '@/lib/renderer/html';
import { createRenderEnv, renderBody } from '@/lib/renderer/page';
import type { PageDocument } from '@/lib/schema/document';
import type { SyncPayload } from './protocol';
import type { BlockHtmlCache } from './render-cache';

// What the canvas shows, as strings: the editor diffs two of these and sends only what changed.

export interface CanvasState {
  css: string;
  js: string;
  lang: string;
  /** The page body with one `<div data-lp-slot="<id>">` per block. */
  skeleton: string;
  blocks: ReadonlyMap<string, string>;
}

export function canvasState(doc: PageDocument, cache: BlockHtmlCache): CanvasState {
  const env = createRenderEnv(doc, 'preview');
  const blocks = new Map<string, string>();
  const skeleton = renderBody(doc, env, (block, at) => {
    const markup = cache.get(env, block, at);
    if (markup === null) return null;
    blocks.set(block.id, markup);
    return html`<div data-lp-slot="${block.id}"></div>`;
  }).value;
  return {
    css: collectCss(doc, { mode: 'preview', minify: false }),
    js: collectJs(doc, { mode: 'preview', minify: false }),
    lang: doc.settings.lang,
    skeleton,
    blocks,
  };
}

/** What to send to go from `prev` to `next`; null when nothing changed. */
export function diffCanvas(prev: CanvasState, next: CanvasState): SyncPayload | null {
  const payload: SyncPayload = { blocks: [] };
  if (prev.css !== next.css) payload.css = next.css;
  if (prev.js !== next.js) payload.js = next.js;
  if (prev.lang !== next.lang) payload.lang = next.lang;
  if (prev.skeleton !== next.skeleton) payload.skeleton = next.skeleton;
  for (const [id, markup] of next.blocks) {
    if (prev.blocks.get(id) !== markup) payload.blocks.push({ id, html: markup });
  }
  const unchanged = Object.keys(payload).length === 1 && payload.blocks.length === 0;
  return unchanged ? null : payload;
}
