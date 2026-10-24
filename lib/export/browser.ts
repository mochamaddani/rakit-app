import type { BuildDeps, FetchedImage } from './build';

// Browser-only export dependencies (covered by the app e2e tests): image downloads without
// credentials, and favicon rasterizing on a canvas.

const FAVICON_PX = 64;

async function fetchImage(url: string): Promise<FetchedImage> {
  try {
    const response = await fetch(url, { mode: 'cors', credentials: 'omit' });
    if (!response.ok) return { ok: false, reason: `HTTP ${response.status}` };
    return {
      ok: true,
      mime: response.headers.get('content-type') ?? '',
      bytes: new Uint8Array(await response.arrayBuffer()),
    };
  } catch (error) {
    return { ok: false, reason: error instanceof Error ? error.message : String(error) };
  }
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

export const browserExportDeps: BuildDeps = { fetchImage, rasterizeFavicon };
