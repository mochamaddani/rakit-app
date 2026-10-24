import { z } from 'zod';
import { getBlockDefinition } from '@/lib/blocks/registry';
import type { PropPath } from '@/lib/editor/structure';
import type { PageDocument } from '@/lib/schema/document';
import { PageSettingsSchema } from '@/lib/schema/settings';

// Images in a document, found through the schemas' `control: 'image'` metadata rather than by
// shape, so a block field that merely has a `src` is never mistaken for one.

export interface ImageRef {
  /** null for page settings (social image, favicon). */
  blockId: string | null;
  path: PropPath;
  src: string;
  alt: string;
}

const isImage = (schema: z.ZodType) =>
  (schema.meta() as { control?: unknown } | undefined)?.control === 'image';

function unwrap(schema: z.ZodType): z.ZodType {
  let inner = schema;
  while (
    inner instanceof z.ZodOptional ||
    inner instanceof z.ZodDefault ||
    inner instanceof z.ZodPrefault
  ) {
    inner = inner.unwrap() as z.ZodType;
  }
  return inner;
}

function walk(
  declared: z.ZodType,
  value: unknown,
  path: PropPath,
  blockId: string | null,
  out: ImageRef[],
): void {
  if (value === undefined || value === null) return;
  const schema = unwrap(declared);
  if (isImage(schema) && typeof value === 'object') {
    const image = value as { src?: unknown; alt?: unknown };
    out.push({
      blockId,
      path,
      src: typeof image.src === 'string' ? image.src : '',
      alt: typeof image.alt === 'string' ? image.alt : '',
    });
    return;
  }
  if (schema instanceof z.ZodObject && typeof value === 'object') {
    for (const [key, field] of Object.entries(schema.shape as Record<string, z.ZodType>)) {
      walk(field, (value as Record<string, unknown>)[key], [...path, key], blockId, out);
    }
  } else if (schema instanceof z.ZodArray && Array.isArray(value)) {
    value.forEach((item, index) =>
      walk(schema.element as z.ZodType, item, [...path, index], blockId, out),
    );
  }
}

/** Every image value in block props, in document order, then the social image and favicon. */
export function collectImages(doc: PageDocument): ImageRef[] {
  const out: ImageRef[] = [];
  for (const section of doc.sections) {
    for (const block of section.blocks) {
      const definition = getBlockDefinition(block.type);
      if (definition) walk(definition.schema, block.props, [], block.id, out);
    }
  }
  walk(PageSettingsSchema, doc.settings, [], null, out);
  return out;
}
