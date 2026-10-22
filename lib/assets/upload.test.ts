import { describe, expect, it, vi } from 'vitest';
import { MAX_UPLOAD_BYTES } from './limits';

vi.mock('server-only', () => ({}));
const { ImageRejected } = await import('./process');
const { processUpload } = await import('./upload');
type AssetStore = import('./upload').AssetStore;

const WS = '0f6a1c2e-9b7d-4e3a-8c5f-1a2b3c4d5e6f';
const OTHER = '7b0c7a52-3c1e-4c8e-9a43-2f1d2b6f0e11';
const FILE = '11111111-2222-4333-8444-555555555555';
const ASSET = '99999999-8888-4777-8666-555555555555';
const path = `${WS}/${FILE}.jpg`;

function memoryStore(uploads: Record<string, Uint8Array>, failPut = false) {
  const calls: string[] = [];
  const variants = new Map<string, number>();
  const rows: unknown[] = [];
  const store: AssetStore = {
    async download(p) {
      calls.push(`download ${p}`);
      return uploads[p] ?? null;
    },
    async removeUpload(p) {
      calls.push(`remove ${p}`);
    },
    async putVariant(p, data) {
      calls.push(`put ${p}`);
      if (failPut) throw new Error('storage is down');
      variants.set(p, data.byteLength);
    },
    async insertAsset(row) {
      calls.push('insert');
      rows.push(row);
    },
    publicUrl: (p) => `https://cdn.example/assets/${p}`,
  };
  return { store, calls, variants, rows };
}
const processed = async () => ({
  large: { width: 1600, height: 1067, data: new Uint8Array(10) },
  small: { width: 800, height: 533, data: new Uint8Array(5) },
});
const input = (p = path) => ({ workspaceId: WS, path: p, newId: () => ASSET });

describe('processUpload', () => {
  it('processes an upload into two variants and an assets row, and removes the original', async () => {
    const { store, calls, variants, rows } = memoryStore({ [path]: new Uint8Array(100) });
    expect(await processUpload(store, input(), processed)).toEqual({
      status: 201,
      body: {
        assetId: ASSET,
        src: `https://cdn.example/assets/${WS}/${ASSET}-1600.webp`,
        width: 1600,
        height: 1067,
      },
    });
    expect([...variants]).toEqual([
      [`${WS}/${ASSET}-1600.webp`, 10],
      [`${WS}/${ASSET}-800.webp`, 5],
    ]);
    expect(rows).toEqual([
      {
        id: ASSET,
        workspace_id: WS,
        path: `${WS}/${ASSET}`,
        mime: 'image/webp',
        width: 1600,
        height: 1067,
        size: 10,
      },
    ]);
    expect(calls.at(-1)).toBe(`remove ${path}`);
  });

  it('rejects malformed paths (400) and other workspaces (403) without touching storage', async () => {
    const { store, calls } = memoryStore({});
    for (const bad of [
      'x.jpg',
      `${WS}/${FILE}.svg`,
      `${WS}/../${FILE}.jpg`,
      `${WS}/${FILE}.jpg/x`,
      '',
    ]) {
      expect(await processUpload(store, input(bad), processed)).toEqual({
        status: 400,
        body: { error: 'bad_path' },
      });
    }
    expect(await processUpload(store, input(`${OTHER}/${FILE}.jpg`), processed)).toEqual({
      status: 403,
      body: { error: 'forbidden' },
    });
    expect(calls).toEqual([]);
  });

  it('a missing upload answers 404', async () => {
    const { store, calls } = memoryStore({});
    expect(await processUpload(store, input(), processed)).toEqual({
      status: 404,
      body: { error: 'not_found' },
    });
    expect(calls).toEqual([`download ${path}`]);
  });

  it('oversized and unreadable originals are rejected and removed', async () => {
    const big = memoryStore({ [path]: new Uint8Array(MAX_UPLOAD_BYTES + 1) });
    expect(await processUpload(big.store, input(), processed)).toEqual({
      status: 413,
      body: { error: 'too_large', reason: 'bytes' },
    });
    expect(big.calls).toContain(`remove ${path}`);
    for (const [reason, expected] of [
      ['unsupported', { status: 415, body: { error: 'unsupported' } }],
      ['too_large', { status: 413, body: { error: 'too_large', reason: 'pixels' } }],
    ] as const) {
      const { store, calls, rows } = memoryStore({ [path]: new Uint8Array(100) });
      const reject = async () => {
        throw new ImageRejected(reason);
      };
      expect(await processUpload(store, input(), reject)).toEqual(expected);
      expect(calls).toContain(`remove ${path}`);
      expect(rows).toEqual([]);
    }
  });

  it('when storing a variant fails the original is still removed and the error propagates', async () => {
    const { store, calls, rows } = memoryStore({ [path]: new Uint8Array(100) }, true);
    await expect(processUpload(store, input(), processed)).rejects.toThrow('storage is down');
    expect(calls).toContain(`remove ${path}`);
    expect(rows).toEqual([]);
  });
});
