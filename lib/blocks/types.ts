import type { z } from 'zod';
import type { RenderContext } from '@/lib/renderer/context';
import type { GeneratedAsset } from '@/lib/renderer/generated-asset';
import type { SafeHtml } from '@/lib/renderer/html';
import type { IdFactory } from '@/lib/schema/ids';

export type BlockCategory = 'content' | 'conversion' | 'special' | 'utility';

export interface BlockSnippet<P> {
  readonly asset: GeneratedAsset;
  /** Ship the script only when some instance needs it (default: always). */
  isNeeded?(props: P): boolean;
  /** Ship it in exported pages only: it talks to third-party code the preview never runs. */
  readonly exportOnly?: boolean;
}

// Pure block definition: no React, usable by the renderer, the AI catalog and the importer
// (docs/DECISIONS.md D-014). Methods use method syntax so concrete definitions stay assignable to
// AnyBlockDefinition.
export interface BlockDefinition<T extends string = string, S extends z.ZodType = z.ZodType> {
  readonly type: T;
  readonly category: BlockCategory;
  /** Palette name. */
  readonly label: string;
  /** One sentence for the palette tooltip and the AI block catalog. */
  readonly description: string;
  /** lucide-react icon name for the editor palette. */
  readonly icon: string;
  readonly schema: S;
  /** Sample content for a newly inserted block; must validate against `schema`. */
  defaultProps(newId: IdFactory): z.output<S>;
  /** Static stylesheet, included once when the type is on the page. */
  readonly css: GeneratedAsset;
  readonly snippet?: BlockSnippet<z.output<S>>;
  /** Trailing sections made only of 'footer' blocks render after </main>. */
  readonly landmark?: 'footer';
  render(props: z.output<S>, ctx: RenderContext): SafeHtml;
}

export type AnyBlockDefinition = BlockDefinition<string, z.ZodType>;

export function defineBlock<const T extends string, S extends z.ZodType>(
  definition: BlockDefinition<T, S>,
): BlockDefinition<T, S> {
  return definition;
}
