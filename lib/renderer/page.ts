import { getBlockDefinition } from '@/lib/blocks/registry';
import type { BlockInstance, PageDocument, Section } from '@/lib/schema/document';
import { collectCss, collectJs } from './collect';
import { createRenderContext, type RenderEnv, type RenderMode } from './context';
import {
  byteLength,
  escapeInlineScript,
  escapeInlineStyle,
  html,
  unsafeRaw,
  type SafeHtml,
} from './html';
import { t } from './i18n';

export interface RenderOptions {
  mode: RenderMode;
  /** Defaults to true for export and false for preview. */
  minify?: boolean;
}

export interface BlockStat {
  blockId: string;
  type: string;
  sectionId: string;
  /** UTF-8 bytes of the block's wrapper, including inlined images (export size report, M3). */
  bytes: number;
}

export interface RenderResult {
  html: string;
  bytes: number;
  cssBytes: number;
  jsBytes: number;
  blocks: BlockStat[];
  warnings: string[];
}

/** Where a block sits: the first section is above the fold, and its first block owns the h1. */
export interface BlockAt {
  sectionId: string;
  sectionIndex: number;
  indexInSection: number;
}

export type BlockRenderer = (block: BlockInstance, at: BlockAt) => SafeHtml | null;

const sectionAnchor = (section: Section) => section.anchor ?? `s-${section.id}`;

function blockClasses(block: BlockInstance): string {
  const classes = ['lp-b'];
  if (block.style.align === 'center') classes.push('lp-align-center');
  if (block.style.hideOn === 'mobile') classes.push('lp-hide-m');
  if (block.style.hideOn === 'desktop') classes.push('lp-hide-d');
  if (block.style.spaceAbove !== 'none') classes.push(`lp-mt-${block.style.spaceAbove}`);
  return classes.join(' ');
}

export function createRenderEnv(doc: PageDocument, mode: RenderMode): RenderEnv {
  return {
    mode,
    settings: doc.settings,
    sectionAnchors: new Map(doc.sections.map((section) => [section.id, sectionAnchor(section)])),
  };
}

/** One block's wrapper and content exactly as renderPage emits them; null for an unregistered type. */
export function renderBlock(env: RenderEnv, block: BlockInstance, at: BlockAt): SafeHtml | null {
  const definition = getBlockDefinition(block.type);
  if (!definition) return null;
  const ctx = createRenderContext(env, { blockId: block.id, ...at });
  return html`<div class="${blockClasses(block)}" id="b-${block.id}"${
    env.mode === 'preview' ? html` data-lp-block="${block.id}" data-lp-type="${block.type}"` : ''
  }>${definition.render(block.props, ctx)}</div>`;
}

/**
 * Index of the first trailing section made only of footer-landmark blocks; sections.length when
 * none. Those sections render after </main>, so their <footer> is the page's contentinfo (D-017).
 */
export function footerStart(doc: PageDocument): number {
  const isFooterOnly = (section: Section) =>
    section.blocks.length > 0 &&
    section.blocks.every((block) => getBlockDefinition(block.type)?.landmark === 'footer');
  let start = doc.sections.length;
  while (start > 0 && isFooterOnly(doc.sections[start - 1]!)) start -= 1;
  return start;
}

/** `<main>…</main>` plus the trailing footer sections; a block rendered as null emits nothing. */
export function renderBody(doc: PageDocument, env: RenderEnv, renderOne: BlockRenderer): SafeHtml {
  const preview = env.mode === 'preview';
  const mainEnd = footerStart(doc);
  const sections = doc.sections.map((section, sectionIndex) => {
    const blocks = section.blocks.map(
      (block, indexInSection) =>
        renderOne(block, { sectionId: section.id, sectionIndex, indexInSection }) ?? '',
    );
    const attributes = html` id="${sectionAnchor(section)}" class="lp-s lp-tone-${section.style.tone} lp-pad-${section.style.padY}"${
      preview ? html` data-lp-section="${section.id}"` : ''
    }`;
    const inner = html`<div class="lp-c lp-w-${section.style.width}">${blocks}</div>`;
    return sectionIndex < mainEnd
      ? html`<section${attributes}>${inner}</section>`
      : html`<div${attributes}>${inner}</div>`;
  });
  return html`<main>${sections.slice(0, mainEnd)}</main>${sections.slice(mainEnd)}`;
}

/**
 * The page is data; this is the only function that turns it into HTML (PRD §5). Pure and
 * deterministic: no DOM, no I/O, no clock or randomness — the same document gives the same bytes.
 */
export function renderPage(doc: PageDocument, options: RenderOptions): RenderResult {
  const { mode } = options;
  const minify = options.minify ?? mode === 'export';
  const env = createRenderEnv(doc, mode);
  const stats: BlockStat[] = [];
  const warnings: string[] = [];

  const body = renderBody(doc, env, (block, at) => {
    const markup = renderBlock(env, block, at);
    if (!markup) {
      warnings.push(`Unknown block type "${block.type}" in block ${block.id} was skipped`);
      return null;
    }
    stats.push({
      blockId: block.id,
      type: block.type,
      sectionId: at.sectionId,
      bytes: byteLength(markup.value),
    });
    return markup;
  });
  const css = collectCss(doc, { mode, minify });
  const js = collectJs(doc, { minify });
  const { lang, seo } = doc.settings;

  const head = html`<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${
    seo.title.trim() || t(lang, 'untitled')
  }</title>${seo.description.trim() ? html`<meta name="description" content="${seo.description}">` : ''}${
    seo.noindex ? html`<meta name="robots" content="noindex,nofollow">` : ''
  }<style>${unsafeRaw(escapeInlineStyle(css))}</style>`;
  const script = js ? html`<script>${unsafeRaw(escapeInlineScript(js))}</script>` : '';
  const page = html`<!doctype html><html lang="${lang}"><head>${head}</head><body>${body}${script}</body></html>`;

  return {
    html: page.value,
    bytes: byteLength(page.value),
    cssBytes: byteLength(css),
    jsBytes: byteLength(js),
    blocks: stats,
    warnings,
  };
}
