import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database, Json } from '@/lib/supabase/database.types';
import type { BuildDeps, FetchedImage } from './build';
import type { RecordDeps } from './record';

/** Private bucket of exported files, '<workspace>/<page>/<version>.html' (D-049). */
export const VERSION_BUCKET = 'page-versions';

// Browser-only export dependencies (covered by the app e2e tests): image downloads without
// credentials, and favicon rasterizing on a canvas.

const FAVICON_PX = 64;

/** A host that accepts the connection but never answers must not hang the export (D-046). */
export const IMAGE_TIMEOUT_MS = 10_000;

/** Downloads an image without credentials; gives up after 10 s. */
export function createFetchImage(
  fetchImpl: typeof fetch = (input, init) => fetch(input, init),
): (url: string) => Promise<FetchedImage> {
  return async (url) => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), IMAGE_TIMEOUT_MS);
    try {
      const response = await fetchImpl(url, {
        mode: 'cors',
        credentials: 'omit',
        signal: controller.signal,
      });
      if (!response.ok) return { ok: false, reason: `HTTP ${response.status}` };
      return {
        ok: true,
        mime: response.headers.get('content-type') ?? '',
        bytes: new Uint8Array(await response.arrayBuffer()),
      };
    } catch (error) {
      if (controller.signal.aborted) return { ok: false, reason: 'No answer within 10 s' };
      return { ok: false, reason: error instanceof Error ? error.message : String(error) };
    } finally {
      clearTimeout(timer);
    }
  };
}

/** Draws the image centered in a 64×64 square (contain) and returns a PNG data URI. */
async function rasterizeFavicon(image: FetchedImage & { ok: true }): Promise<string | null> {
  try {
    const bitmap = await createImageBitmap(
      new Blob([image.bytes as Uint8Array<ArrayBuffer>], { type: image.mime }),
    );
    const canvas = document.createElement('canvas');
    canvas.width = FAVICON_PX;
    canvas.height = FAVICON_PX;
    const context = canvas.getContext('2d');
    if (!context) return null;
    const scale = Math.min(FAVICON_PX / bitmap.width, FAVICON_PX / bitmap.height);
    const width = bitmap.width * scale;
    const height = bitmap.height * scale;
    context.drawImage(bitmap, (FAVICON_PX - width) / 2, (FAVICON_PX - height) / 2, width, height);
    bitmap.close();
    return canvas.toDataURL('image/png');
  } catch {
    return null;
  }
}

export const browserExportDeps: BuildDeps = { fetchImage: createFetchImage(), rasterizeFavicon };

/** Recording through the signed-in user's Supabase client (D-049 policies apply). */
export function supabaseRecordDeps(supabase: SupabaseClient<Database>): RecordDeps {
  const bucket = () => supabase.storage.from(VERSION_BUCKET);
  return {
    async upload(path, html) {
      const { error } = await bucket().upload(path, html, {
        contentType: 'text/html',
        upsert: false,
      });
      return error ? { ok: false, message: error.message } : { ok: true };
    },
    async rpc(args) {
      const { data, error } = await supabase.rpc('record_page_version', {
        p_id: args.id,
        p_page_id: args.pageId,
        p_document: args.document as unknown as Json,
        p_html_path: args.htmlPath,
        p_export_settings: args.exportSettings as unknown as Json,
        p_byte_size: args.byteSize,
        p_html_sha256: args.sha256,
        p_draft_revision: args.draftRevision,
      });
      return error ? { ok: false, message: error.message } : { ok: true, createdAt: data };
    },
    async remove(path) {
      await bucket().remove([path]);
    },
    newId: () => crypto.randomUUID(),
  };
}

/** Saves text as a file through a Blob link: the HTML never opens on the editor origin (D-022). */
export function saveFile(text: string, fileName: string): void {
  const url = URL.createObjectURL(new Blob([text], { type: 'text/html' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
