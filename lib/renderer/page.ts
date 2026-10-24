import { getBlockDefinition } from '@/lib/blocks/registry';
import { asset as pageRuntime } from '@/lib/tracking/snippet.generated';
import {
  renderTrackingBodyStart,
  renderTrackingHead,
  trackingBodyAttributes,
} from '@/lib/tracking/vendors';
import type { BlockInstance, PageDocument, Section } from '@/lib/schema/document';
import { hasTrackingIds, type PageSettings } from '@/lib/schema/settings';
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
import { sanitizeUrl } from './url';

export interface RenderOptions {
  mode: RenderMode;
  /** Defaults to true for export and false for preview. */
  minify?: boolean;
  /** Export only (default true): vendor tags and custom code. Preview never tracks (D-047). */
  tracking?: boolean;
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

const pick = (asset: { min: string; src: string }, minify: boolean) =>
  minify ? asset.min : asset.src;

/** A web CTA, a CTA event, a form iframe or vendor ids need the page runtime (D-047). */
function needsPageRuntime(body: string, tracking: PageSettings['tracking'] | null): boolean {
  if (tracking && hasTrackingIds(tracking)) return true;
  return /<a [^>]*href="https?:[^"]*"[^>]*data-lp-cta|data-lp-event=|data-lp-pass/.test(body);
}

/** og:* tags and the favicon, in export only; og:image must be an absolute http(s) URL. */
function socialTags(doc: PageDocument, title: string): SafeHtml {
  const { seo } = doc.settings;
  const image = seo.ogImage && sanitizeUrl(seo.ogImage.src, 'image');
  const favicon = seo.favicon && sanitizeUrl(seo.favicon.src, 'image');
  return html`<meta property="og:title" content="${title}">${
    seo.description.trim()
      ? html`<meta property="og:description" content="${seo.description}">`
      : ''
  }<meta property="og:type" content="website">${
    image && /^https?:\/\//i.test(image) ? html`<meta property="og:image" content="${image}">` : ''
  }${favicon ? html`<link rel="icon" href="${favicon}">` : ''}`;
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
  const exporting = mode === 'export';
  const tracking = exporting && options.tracking !== false ? doc.settings.tracking : null;
  const css = collectCss(doc, { mode, minify });
  const js = [
    exporting && needsPageRuntime(body.value, tracking) ? pick(pageRuntime, minify) : '',
    collectJs(doc, { minify }),
  ]
    .filter(Boolean)
    .join('\n');
  const { lang, seo } = doc.settings;
  const title = seo.title.trim() || t(lang, 'untitled');

  const head = html`<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title>${
    seo.description.trim() ? html`<meta name="description" content="${seo.description}">` : ''
  }${seo.noindex ? html`<meta name="robots" content="noindex,nofollow">` : ''}${
    exporting ? socialTags(doc, title) : ''
  }<style>${unsafeRaw(escapeInlineStyle(css))}</style>${
    tracking ? html`${renderTrackingHead(tracking)}${unsafeRaw(tracking.headCode)}` : ''
  }`;
  const script = js ? html`<script>${unsafeRaw(escapeInlineScript(js))}</script>` : '';
  const page = html`<!doctype html><html lang="${lang}"><head>${head}</head><body${
    tracking ? trackingBodyAttributes(tracking) : ''
  }>${tracking ? renderTrackingBodyStart(tracking) : ''}${body}${
    tracking ? unsafeRaw(tracking.bodyCode) : ''
  }${script}</body></html>`;

  return {
    html: page.value,
    bytes: byteLength(page.value),
    cssBytes: byteLength(css),
    jsBytes: byteLength(js),
    blocks: stats,
    warnings,
  };
}
