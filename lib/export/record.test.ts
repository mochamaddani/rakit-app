import { describe, expect, it } from 'vitest';
import { createEmptyDocument } from '@/lib/schema/document';
import { DEFAULT_EXPORT_OPTIONS, type ExportBuild } from './build';
import {
  exportFreshness,
  recordExport,
  unsavedReason,
  type RecordArgs,
  type RecordDeps,
} from './record';

const WS = '11111111-1111-4111-8111-111111111111';
const PAGE = '22222222-2222-4222-8222-222222222222';
const VERSION = '33333333-3333-4333-8333-333333333333';
const doc = createEmptyDocument();
const build: ExportBuild = {
  html: '<!doctype html><title>x</title>',
  bytes: 31,
  sha256: 'a'.repeat(64),
  report: { total: 31, rows: [] },
  checklist: [],
};
const input = {
  workspaceId: WS,
  pageId: PAGE,
  doc,
  build,
  options: DEFAULT_EXPORT_OPTIONS,
  draftRevision: 7,
};

function deps(overrides: Partial<RecordDeps> = {}) {
  const log: string[] = [];
  const calls: RecordArgs[] = [];
  const d: RecordDeps = {
    upload: async (path, html) => {
      log.push(`upload ${path} ${html.type} ${await html.text()}`);
      return { ok: true };
    },
    rpc: async (args) => {
      calls.push(args);
      log.push('rpc');
      return { ok: true, createdAt: '2026-10-24T10:00:00Z' };
    },
    remove: async (path) => {
      log.push(`remove ${path}`);
    },
    newId: () => VERSION,
    ...overrides,
  };
  return { d, log, calls };
}

describe('recordExport', () => {
  it("uploads to the workspace/page/version path, then records with the build's hash and size", async () => {
    const { d, log, calls } = deps();
    const result = await recordExport(input, d);
    const path = `${WS}/${PAGE}/${VERSION}.html`;
    expect(log).toEqual([`upload ${path} text/html ${build.html}`, 'rpc']);
    expect(calls).toEqual([
      {
        id: VERSION,
        pageId: PAGE,
        document: doc,
        htmlPath: path,
        exportSettings: DEFAULT_EXPORT_OPTIONS,
        byteSize: 31,
        sha256: 'a'.repeat(64),
        draftRevision: 7,
      },
    ]);
    expect(result).toEqual({
      ok: true,
      latest: { versionId: VERSION, createdAt: '2026-10-24T10:00:00Z', draftRevision: 7 },
    });
  });

  it('a failed RPC removes the upload and reports', async () => {
    const { d, log } = deps({ rpc: async () => ({ ok: false, message: 'permission denied' }) });
    expect(await recordExport(input, d)).toEqual({ ok: false, message: 'permission denied' });
    expect(log.at(-1)).toBe(`remove ${WS}/${PAGE}/${VERSION}.html`);
  });

  it('a failed upload records nothing', async () => {
    const { d, log } = deps({ upload: async () => ({ ok: false, message: 'Payload too large' }) });
    expect(await recordExport(input, d)).toEqual({ ok: false, message: 'Payload too large' });
    expect(log).toEqual([]);
  });

  it('a thrown error is reported, never thrown', async () => {
    const { d } = deps({
      upload: async () => {
        throw new TypeError('Failed to fetch');
      },
    });
    expect(await recordExport(input, d)).toEqual({ ok: false, message: 'Failed to fetch' });
  });
});

describe('export freshness', () => {
  const latest = { versionId: VERSION, createdAt: '2026-10-24T10:00:00Z', draftRevision: 7 };
  it('exportFreshness covers none, current, stale and unsaved', () => {
    expect(exportFreshness(null, { status: 'saved', revision: 7 })).toBe('none');
    expect(exportFreshness(latest, { status: 'saved', revision: 7 })).toBe('current');
    expect(exportFreshness(latest, { status: 'saved', revision: 8 })).toBe('stale');
    expect(exportFreshness(latest, { status: 'dirty', revision: 7 })).toBe('stale');
    expect(
      exportFreshness({ ...latest, draftRevision: null }, { status: 'saved', revision: 7 }),
    ).toBe('stale');
  });
  it('unsavedReason explains why an export must wait', () => {
    const base = { revision: 7, savedVersion: 1, error: null, conflictRevision: null };
    expect(unsavedReason({ ...base, status: 'saved' })).toBeNull();
    expect(unsavedReason({ ...base, status: 'offline' })).toBe(
      "you're offline or the server can't be reached.",
    );
    expect(unsavedReason({ ...base, status: 'error', error: 'This page no longer exists.' })).toBe(
      'This page no longer exists.',
    );
    expect(unsavedReason({ ...base, status: 'conflict' })).toBe(
      'this page was changed in another tab or window.',
    );
    expect(unsavedReason({ ...base, status: 'dirty' })).toBe(
      "the latest changes aren't saved yet.",
    );
  });
});
