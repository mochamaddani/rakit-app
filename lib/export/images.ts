import { z } from 'zod';
import { getBlockDefinition } from '@/lib/blocks/registry';
import type { PropPath } from '@/lib/editor/structure';
import type { PageDocument } from '@/lib/schema/document';
import { PageSettingsSchema } from '@/lib/schema/settings';
import { LARGE_IMAGE_BYTES } from './size';

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

const ASSET_1600 =
  /\/storage\/v1\/object\/public\/assets\/[0-9a-f-]{36}\/[0-9a-f-]{36}-1600\.webp$/;

/** An uploaded asset's 1600 px URL → its 800 px variant (D-046); any other URL unchanged. */
export function portableVariant(src: string): string {
  return ASSET_1600.test(src) ? src.replace(/-1600\.webp$/, '-800.webp') : src;
}

export type FetchedImage =
  { ok: true; mime: string; bytes: Uint8Array } | { ok: false; reason: string };

export interface ImageDeps {
  fetchImage(url: string): Promise<FetchedImage>;
}

const INLINE_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'image/avif']);

/** The MIME type without parameters, when it is one we inline; null otherwise. */
export function imageType(image: FetchedImage): string | null {
  if (!image.ok) return null;
  const mime = image.mime.split(';')[0]!.trim().toLowerCase();
  return INLINE_TYPES.has(mime) ? mime : null;
}

export function dataUri(mime: string, bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return `data:${mime};base64,${btoa(binary)}`;
}

function setAtPath(root: unknown, path: PropPath, value: unknown): void {
  let node = root as Record<string | number, unknown>;
  for (const key of path.slice(0, -1)) node = node[key] as Record<string | number, unknown>;
  node[path.at(-1)!] = value;
}

/**
 * Portable mode: block images become data URIs, each URL fetched once. Images that can't be
 * fetched, or aren't PNG, JPEG, WebP, GIF or AVIF, stay links and are listed in `failed`.
 */
export async function inlineImages(
  doc: PageDocument,
  deps: ImageDeps,
): Promise<{ doc: PageDocument; failed: ImageRef[]; large: ImageRef[] }> {
  const copy = structuredClone(doc);
  const refs = collectImages(doc).filter(
    (ref) => ref.blockId !== null && /^https?:\/\//i.test(ref.src.trim()),
  );
  // Every download starts before any is awaited, so a long carousel isn't fetched one by one.
  const fetches = new Map<string, Promise<FetchedImage>>();
  for (const ref of refs) {
    const url = portableVariant(ref.src.trim());
    if (!fetches.has(url)) {
      fetches.set(
        url,
        deps
          .fetchImage(url)
          .catch((error: unknown): FetchedImage => ({ ok: false, reason: String(error) })),
      );
    }
  }
  const failed: ImageRef[] = [];
  const large: ImageRef[] = [];
  for (const ref of refs) {
    const image = await fetches.get(portableVariant(ref.src.trim()))!;
    const mime = imageType(image);
    if (!mime || !image.ok) {
      failed.push(ref);
      continue;
    }
    const uri = dataUri(mime, image.bytes);
    if (uri.length > LARGE_IMAGE_BYTES) large.push(ref);
    const section = copy.sections.find((s) => s.blocks.some((b) => b.id === ref.blockId))!;
    const block = section.blocks.find((b) => b.id === ref.blockId)!;
    setAtPath(block.props, [...ref.path, 'src'], uri);
  }
  return { doc: copy, failed, large };
}
