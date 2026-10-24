import { afterEach, describe, expect, it, vi } from 'vitest';
import { createFetchImage, IMAGE_TIMEOUT_MS } from './browser';

afterEach(() => vi.useRealTimers());

describe('createFetchImage', () => {
  it('a host that never answers fails after the timeout instead of hanging the export', async () => {
    vi.useFakeTimers();
    const never: typeof fetch = (_url, init) =>
      new Promise((_resolve, reject) =>
        init?.signal?.addEventListener('abort', () =>
          reject(new DOMException('aborted', 'AbortError')),
        ),
      );
    const pending = createFetchImage(never)('https://slow.example/a.webp');
    await vi.advanceTimersByTimeAsync(IMAGE_TIMEOUT_MS);
    expect(await pending).toEqual({ ok: false, reason: 'No answer within 10 s' });
    expect(IMAGE_TIMEOUT_MS).toBe(10_000);
  });

  it('reads the type and bytes of an answer, and reports HTTP errors', async () => {
    const answer =
      (status: number): typeof fetch =>
      async () =>
        new Response(new Uint8Array([1, 2]), { status, headers: { 'content-type': 'image/webp' } });
    expect(await createFetchImage(answer(200))('https://a.example/x.webp')).toEqual({
      ok: true,
      mime: 'image/webp',
      bytes: new Uint8Array([1, 2]),
    });
    expect(await createFetchImage(answer(404))('https://a.example/x.webp')).toEqual({
      ok: false,
      reason: 'HTTP 404',
    });
  });
});
