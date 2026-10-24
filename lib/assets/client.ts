import { MAX_UPLOAD_BYTES, UPLOAD_TYPES } from './limits';

// Uploading an image from the editor (docs/DECISIONS.md D-045): the original goes straight from
// the browser to Storage, under the workspace's folder; the processing route then turns it into
// WebP variants and answers with the large one.

export interface UploadDeps {
  workspaceId: string;
  /** storage.from('uploads').upload(path, file, { contentType, upsert: false }). */
  upload(path: string, file: Blob, contentType: string): Promise<{ ok: boolean }>;
  fetch: typeof fetch;
  newId(): string;
}

export type UploadResult =
  | { ok: true; image: { src: string; width: number; height: number; assetId: string } }
  | { ok: false; message: string };

const FAILED = 'The upload failed. Check your connection and try again.';
const TOO_BIG = 'This image is larger than 10 MB.';

const isUploadType = (type: string): type is keyof typeof UPLOAD_TYPES =>
  Object.hasOwn(UPLOAD_TYPES, type);
const isPositiveInt = (value: unknown): value is number =>
  typeof value === 'number' && Number.isInteger(value) && value > 0;

export async function uploadImage(file: File, deps: UploadDeps): Promise<UploadResult> {
  if (!isUploadType(file.type)) {
    return { ok: false, message: 'Choose a JPEG, PNG, WebP, GIF or AVIF image.' };
  }
  if (file.size > MAX_UPLOAD_BYTES) return { ok: false, message: TOO_BIG };
  const path = `${deps.workspaceId}/${deps.newId()}.${UPLOAD_TYPES[file.type]}`;

  let response: Response;
  try {
    if (!(await deps.upload(path, file, file.type)).ok) return { ok: false, message: FAILED };
    response = await deps.fetch('/api/assets', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ path }),
    });
  } catch {
    return { ok: false, message: FAILED };
  }
  const body = (await response.json().catch(() => null)) as Record<string, unknown> | null;
  // A success is trusted only when it has every field the image needs (M2a review M4).
  if (
    response.status === 201 &&
    body &&
    typeof body.src === 'string' &&
    typeof body.assetId === 'string' &&
    isPositiveInt(body.width) &&
    isPositiveInt(body.height)
  ) {
    return {
      ok: true,
      image: { src: body.src, width: body.width, height: body.height, assetId: body.assetId },
    };
  }
  if (response.status === 413) {
    return {
      ok: false,
      message:
        body?.reason === 'pixels'
          ? 'This image is too large to process (over 40 megapixels).'
          : TOO_BIG,
    };
  }
  if (response.status === 415) {
    return { ok: false, message: "This file isn't an image Rakit can read." };
  }
  return { ok: false, message: `The image couldn't be processed (HTTP ${response.status}).` };
}
