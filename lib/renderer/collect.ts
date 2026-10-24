import { getBlockDefinition } from '@/lib/blocks/registry';
import type { PageDocument } from '@/lib/schema/document';
import { asset as baseCss } from './base.generated';
import type { RenderMode } from './context';
import type { GeneratedAsset } from './generated-asset';
import { asset as previewCss } from './preview.generated';
import { themeCss } from './theme-css';

// The page ships only what its blocks use: base CSS, plus one stylesheet and at most one snippet
// per block type present, in type order so reordering blocks never changes the cascade (D-012).

const pick = (asset: GeneratedAsset, minify: boolean) => (minify ? asset.min : asset.src);

export function presentBlockTypes(doc: PageDocument): string[] {
  return [...new Set(doc.sections.flatMap((section) => section.blocks.map((b) => b.type)))].sort();
}

export function collectCss(doc: PageDocument, opts: { mode: RenderMode; minify: boolean }): string {
  const parts = [themeCss(doc.settings.theme), pick(baseCss, opts.minify)];
  if (opts.mode === 'preview') parts.push(pick(previewCss, opts.minify));
  for (const type of presentBlockTypes(doc)) {
    const definition = getBlockDefinition(type);
    if (definition) parts.push(pick(definition.css, opts.minify));
  }
  return parts.join(opts.minify ? '' : '\n');
}

export function collectJs(doc: PageDocument, opts: { mode: RenderMode; minify: boolean }): string {
  const scripts: string[] = [];
  for (const type of presentBlockTypes(doc)) {
    const snippet = getBlockDefinition(type)?.snippet;
    if (!snippet || (snippet.exportOnly && opts.mode === 'preview')) continue;
    const needed = doc.sections.some((section) =>
      section.blocks.some((b) => b.type === type && snippet.isNeeded?.(b.props) !== false),
    );
    if (needed) scripts.push(pick(snippet.asset, opts.minify));
  }
  return scripts.join('\n');
}
