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

const sectionAnchor = (section: Section) => section.anchor ?? `s-${section.id}`;

function blockClasses(block: BlockInstance): string {
  const classes = ['lp-b'];
  if (block.style.align === 'center') classes.push('lp-align-center');
  if (block.style.hideOn === 'mobile') classes.push('lp-hide-m');
  if (block.style.hideOn === 'desktop') classes.push('lp-hide-d');
  if (block.style.spaceAbove !== 'none') classes.push(`lp-mt-${block.style.spaceAbove}`);
  return classes.join(' ');
}

/**
 * The page is data; this is the only function that turns it into HTML (PRD §5). Pure and
 * deterministic: no DOM, no I/O, no clock or randomness — the same document gives the same bytes.
 */
export function renderPage(doc: PageDocument, options: RenderOptions): RenderResult {
  const { mode } = options;
  const minify = options.minify ?? mode === 'export';
  const preview = mode === 'preview';
  const env: RenderEnv = {
    mode,
    settings: doc.settings,
    sectionAnchors: new Map(doc.sections.map((section) => [section.id, sectionAnchor(section)])),
  };
  const stats: BlockStat[] = [];
  const warnings: string[] = [];

  const renderSection = (section: Section, sectionIndex: number): SafeHtml => {
    const blocks = section.blocks.map((block, indexInSection) => {
      const definition = getBlockDefinition(block.type);
      if (!definition) {
        warnings.push(`Unknown block type "${block.type}" in block ${block.id} was skipped`);
        return '';
      }
      const ctx = createRenderContext(env, {
        blockId: block.id,
        sectionId: section.id,
        sectionIndex,
        indexInSection,
      });
      const markup = html`<div class="${blockClasses(block)}" id="b-${block.id}"${
        preview ? html` data-lp-block="${block.id}" data-lp-type="${block.type}"` : ''
      }>${definition.render(block.props, ctx)}</div>`;
      stats.push({
        blockId: block.id,
        type: block.type,
        sectionId: section.id,
        bytes: byteLength(markup.value),
      });
      return markup;
    });
    return html`<section id="${sectionAnchor(section)}" class="lp-s lp-tone-${section.style.tone} lp-pad-${section.style.padY}"${
      preview ? html` data-lp-section="${section.id}"` : ''
    }><div class="lp-c lp-w-${section.style.width}">${blocks}</div></section>`;
  };

  const sections = doc.sections.map(renderSection);
  const css = collectCss(doc, { mode, minify });
  const js = collectJs(doc, { minify });
  const { lang, seo } = doc.settings;

  const head = html`<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${
    seo.title.trim() || t(lang, 'untitled')
  }</title>${seo.description.trim() ? html`<meta name="description" content="${seo.description}">` : ''}${
    seo.noindex ? html`<meta name="robots" content="noindex,nofollow">` : ''
  }<style>${unsafeRaw(escapeInlineStyle(css))}</style>`;
  const script = js ? html`<script>${unsafeRaw(escapeInlineScript(js))}</script>` : '';
  const page = html`<!doctype html><html lang="${lang}"><head>${head}</head><body><main>${sections}</main>${script}</body></html>`;

  return {
    html: page.value,
    bytes: byteLength(page.value),
    cssBytes: byteLength(css),
    jsBytes: byteLength(js),
    blocks: stats,
    warnings,
  };
}
