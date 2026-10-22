import { describe, expect, it, vi } from 'vitest';
import { uploadImage, type UploadDeps } from './client';
import { MAX_UPLOAD_BYTES } from './limits';

const WS = '0f6a1c2e-9b7d-4e3a-8c5f-1a2b3c4d5e6f';
const ID = '11111111-2222-4333-8444-555555555555';
const file = (type: string, size = 100, name = 'a.jpg') =>
  new File([new Uint8Array(size)], name, { type });
const reply = (status: number, body?: unknown) =>
  new Response(body === undefined ? null : JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
const processed = {
  assetId: 'a1',
  src: 'https://cdn.example/assets/x-1600.webp',
  width: 1600,
  height: 1067,
};

function setup(response: Response | Error = reply(201, processed), uploaded = true) {
  const upload = vi.fn<UploadDeps['upload']>(async () => ({ ok: uploaded }));
  const fetchImpl = vi.fn<typeof fetch>(async () => {
    if (response instanceof Error) throw response;
    return response;
  });
  const deps: UploadDeps = { workspaceId: WS, upload, fetch: fetchImpl, newId: () => ID };
  return { upload, fetchImpl, deps };
}

describe('uploadImage', () => {
  it('uploads the original under the workspace folder and returns the processed image', async () => {
    const { upload, fetchImpl, deps } = setup();
    expect(await uploadImage(file('image/png'), deps)).toEqual({ ok: true, image: processed });
    expect(upload).toHaveBeenCalledWith(`${WS}/${ID}.png`, expect.any(File), 'image/png');
    const [url, init] = fetchImpl.mock.calls[0]!;
    expect(url).toBe('/api/assets');
    expect(init).toMatchObject({ method: 'POST', headers: { 'content-type': 'application/json' } });
    expect(JSON.parse(String(init!.body))).toEqual({ path: `${WS}/${ID}.png` });
  });

  it('refuses wrong types and files over 10 MiB before uploading', async () => {
    const { upload, deps } = setup();
    expect(await uploadImage(file('text/plain', 10, 'notes.txt'), deps)).toEqual({
      ok: false,
      message: 'Choose a JPEG, PNG, WebP, GIF or AVIF image.',
    });
    expect((await uploadImage(file('image/svg+xml'), deps)).ok).toBe(false);
    expect(await uploadImage(file('image/jpeg', MAX_UPLOAD_BYTES + 1), deps)).toEqual({
      ok: false,
      message: 'This image is larger than 10 MB.',
    });
    expect(upload).not.toHaveBeenCalled();
  });

  it('maps route errors to messages', async () => {
    const cases: [ReturnType<typeof setup>, string][] = [
      [
        setup(reply(201, processed), false),
        'The upload failed. Check your connection and try again.',
      ],
      [setup(new Error('offline')), 'The upload failed. Check your connection and try again.'],
      [
        setup(reply(413, { error: 'too_large', reason: 'pixels' })),
        'This image is too large to process (over 40 megapixels).',
      ],
      [
        setup(reply(413, { error: 'too_large', reason: 'bytes' })),
        'This image is larger than 10 MB.',
      ],
      [setup(reply(415, { error: 'unsupported' })), "This file isn't an image LaunchPad can read."],
      [setup(reply(500)), "The image couldn't be processed (HTTP 500)."],
    ];
    for (const [{ deps }, message] of cases) {
      expect(await uploadImage(file('image/jpeg'), deps)).toEqual({ ok: false, message });
    }
  });

  it('a malformed success response is a failure', async () => {
    for (const body of [
      {},
      { ...processed, width: 0 },
      { ...processed, height: 1.5 },
      { ...processed, src: 1 },
      { ...processed, assetId: null },
    ]) {
      expect((await uploadImage(file('image/jpeg'), setup(reply(201, body)).deps)).ok).toBe(false);
    }
  });
});
