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

  const renderSection = (
    section: Section,
    sectionIndex: number,
    element: 'section' | 'div',
  ): SafeHtml => {
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
    const attributes = html` id="${sectionAnchor(section)}" class="lp-s lp-tone-${section.style.tone} lp-pad-${section.style.padY}"${
      preview ? html` data-lp-section="${section.id}"` : ''
    }`;
    const inner = html`<div class="lp-c lp-w-${section.style.width}">${blocks}</div>`;
    return element === 'section'
      ? html`<section${attributes}>${inner}</section>`
      : html`<div${attributes}>${inner}</div>`;
  };

  // Trailing sections made only of footer-landmark blocks go after </main>, so their <footer> is
  // the page's contentinfo landmark (docs/DECISIONS.md D-017).
  const isFooterOnly = (section: Section) =>
    section.blocks.length > 0 &&
    section.blocks.every((block) => getBlockDefinition(block.type)?.landmark === 'footer');
  let mainEnd = doc.sections.length;
  while (mainEnd > 0 && isFooterOnly(doc.sections[mainEnd - 1]!)) mainEnd -= 1;
  const sections = doc.sections.map((section, i) =>
    renderSection(section, i, i < mainEnd ? 'section' : 'div'),
  );
  const mainSections = sections.slice(0, mainEnd);
  const afterMain = sections.slice(mainEnd);
  const css = collectCss(doc, { mode, minify });
  const js = collectJs(doc, { minify });
  const { lang, seo } = doc.settings;

  const head = html`<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${
    seo.title.trim() || t(lang, 'untitled')
  }</title>${seo.description.trim() ? html`<meta name="description" content="${seo.description}">` : ''}${
    seo.noindex ? html`<meta name="robots" content="noindex,nofollow">` : ''
  }<style>${unsafeRaw(escapeInlineStyle(css))}</style>`;
  const script = js ? html`<script>${unsafeRaw(escapeInlineScript(js))}</script>` : '';
  const page = html`<!doctype html><html lang="${lang}"><head>${head}</head><body><main>${mainSections}</main>${afterMain}${script}</body></html>`;

  return {
    html: page.value,
    bytes: byteLength(page.value),
    cssBytes: byteLength(css),
    jsBytes: byteLength(js),
    blocks: stats,
    warnings,
  };
}
