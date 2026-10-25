import { z } from 'zod';
import type { PropPath } from '@/lib/editor/structure';

// Images in a value, found through the schemas' `control: 'image'` metadata rather than by shape,
// so a field that merely has a `src` is never mistaken for one. Used by the renderer (image
// priority) and by export (inlining, checklist).

export interface FoundImage {
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

function walk(declared: z.ZodType, value: unknown, path: PropPath, out: FoundImage[]): void {
  if (value === undefined || value === null) return;
  const schema = unwrap(declared);
  if (isImage(schema) && typeof value === 'object') {
    const image = value as { src?: unknown; alt?: unknown };
    out.push({
      path,
      src: typeof image.src === 'string' ? image.src : '',
      alt: typeof image.alt === 'string' ? image.alt : '',
    });
    return;
  }
  if (schema instanceof z.ZodObject && typeof value === 'object') {
    for (const [key, field] of Object.entries(schema.shape as Record<string, z.ZodType>)) {
      walk(field, (value as Record<string, unknown>)[key], [...path, key], out);
    }
  } else if (schema instanceof z.ZodArray && Array.isArray(value)) {
    value.forEach((item, index) => walk(schema.element as z.ZodType, item, [...path, index], out));
  }
}

/** Every image value under `value`, in document order; `path` prefixes each result's path. */
export function findImages(schema: z.ZodType, value: unknown, path: PropPath = []): FoundImage[] {
  const out: FoundImage[] = [];
  walk(schema, value, path, out);
  return out;
}
