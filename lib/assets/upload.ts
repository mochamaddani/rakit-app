import { MAX_UPLOAD_BYTES, variantPath } from './limits';
import { ImageRejected, processImage } from './process';

// One uploaded original becomes two WebP variants and an `assets` row (docs/DECISIONS.md D-045).
// Storage is a seam, so these rules are tested without Supabase.

export interface AssetStore {
  /** From the uploads bucket; null when there is no such object (or the caller can't see it). */
  download(path: string): Promise<Uint8Array | null>;
  removeUpload(path: string): Promise<void>;
  /** Into the assets bucket as image/webp, cached for a year (names never repeat). */
  putVariant(path: string, data: Uint8Array): Promise<void>;
  insertAsset(row: {
    id: string;
    workspace_id: string;
    path: string;
    mime: 'image/webp';
    width: number;
    height: number;
    size: number;
  }): Promise<void>;
  publicUrl(path: string): string;
}

export type ProcessUploadResult =
  | { status: 201; body: { assetId: string; src: string; width: number; height: number } }
  | { status: 400; body: { error: 'bad_path' } }
  | { status: 403; body: { error: 'forbidden' } }
  | { status: 404; body: { error: 'not_found' } }
  | { status: 413; body: { error: 'too_large'; reason: 'bytes' | 'pixels' } }
  | { status: 415; body: { error: 'unsupported' } };

const UUID = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}';
const UPLOAD_PATH = new RegExp(`^(${UUID})/${UUID}\\.(?:jpg|png|webp|gif|avif)$`);

export async function processUpload(
  store: AssetStore,
  input: { workspaceId: string; path: string; newId(): string },
  process: typeof processImage = processImage,
): Promise<ProcessUploadResult> {
  const match = UPLOAD_PATH.exec(input.path);
  if (!match) return { status: 400, body: { error: 'bad_path' } };
  if (match[1] !== input.workspaceId) return { status: 403, body: { error: 'forbidden' } };
  const original = await store.download(input.path);
  if (!original) return { status: 404, body: { error: 'not_found' } };

  try {
    if (original.byteLength > MAX_UPLOAD_BYTES) {
      return { status: 413, body: { error: 'too_large', reason: 'bytes' } };
    }
    let variants: Awaited<ReturnType<typeof processImage>>;
    try {
      variants = await process(original);
    } catch (error) {
      if (!(error instanceof ImageRejected)) throw error;
      return error.reason === 'too_large'
        ? { status: 413, body: { error: 'too_large', reason: 'pixels' } }
        : { status: 415, body: { error: 'unsupported' } };
    }
    const assetId = input.newId();
    const assetPath = `${input.workspaceId}/${assetId}`;
    const { large, small } = variants;
    await store.putVariant(variantPath(assetPath, 1600), large.data);
    await store.putVariant(variantPath(assetPath, 800), small.data);
    await store.insertAsset({
      id: assetId,
      workspace_id: input.workspaceId,
      path: assetPath,
      mime: 'image/webp',
      width: large.width,
      height: large.height,
      size: large.data.byteLength,
    });
    return {
      status: 201,
      body: {
        assetId,
        src: store.publicUrl(variantPath(assetPath, 1600)),
        width: large.width,
        height: large.height,
      },
    };
  } finally {
    // Originals are never kept: processed, refused or failed. A failed removal only leaves an
    // orphan in the private bucket, so it never replaces the answer.
    await store.removeUpload(input.path).catch(() => {});
  }
}
