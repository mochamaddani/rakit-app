// Helpers for block tests only.
import type { z } from 'zod';
import {
  createRenderContext,
  type BlockPosition,
  type RenderContext,
  type RenderMode,
} from '@/lib/renderer/context';
import { PageSettingsSchema } from '@/lib/schema/settings';
import type { AnyBlockDefinition } from './types';

export interface TestContextOverrides {
  mode?: RenderMode;
  settings?: z.input<typeof PageSettingsSchema>;
  block?: Partial<BlockPosition>;
  sectionAnchors?: Record<string, string>;
}

export function testContext(overrides: TestContextOverrides = {}): RenderContext {
  return createRenderContext(
    {
      mode: overrides.mode ?? 'export',
      settings: PageSettingsSchema.parse(overrides.settings ?? {}),
      sectionAnchors: new Map(Object.entries(overrides.sectionAnchors ?? {})),
    },
    { blockId: 'b1', sectionId: 's1', sectionIndex: 0, indexInSection: 0, ...overrides.block },
  );
}

/** Validates `input` with the block's schema, then renders it. */
export function renderBlock(
  definition: AnyBlockDefinition,
  input: unknown,
  overrides?: TestContextOverrides,
): string {
  return String(definition.render(definition.schema.parse(input), testContext(overrides)));
}

/** A raw (unvalidated) one-section, one-block document for parseDocument + renderPage tests. */
export function singleBlockDoc(type: string, props: unknown): unknown {
  return { schemaVersion: 1, sections: [{ id: 's1', blocks: [{ id: 'b1', type, props }] }] };
}
