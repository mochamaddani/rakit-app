import { describe, expect, it } from 'vitest';
import type { PageDocument } from '@/lib/schema/document';
import { MAX_DRAFT_BYTES, saveDraft, type DraftStore } from './draft';

const PAGE = '7b0c7a52-3c1e-4c8e-9a43-2f1d2b6f0e11';
const SAVE = '0f6a1c2e-9b7d-4e3a-8c5f-1a2b3c4d5e6f';
const body = (document: unknown, baseRevision: unknown = 0, saveId?: unknown) =>
  JSON.stringify({ document, baseRevision, saveId });
const EMPTY = { schemaVersion: 2, sections: [] };

function memoryStore(revisions: Record<string, number>) {
  const rows = new Map(
    Object.entries(revisions).map(([id, revision]) => [
      id,
      { revision, doc: null as PageDocument | null, saveId: null as string | null },
    ]),
  );
  const store: DraftStore = {
    async update(id, doc, base, saveId) {
      const row = rows.get(id);
      if (!row || row.revision !== base) return null;
      row.revision = base + 1;
      row.doc = doc;
      row.saveId = saveId;
      return { revision: row.revision, updatedAt: '2026-10-22T10:00:00.123456+00:00' };
    },
    async current(id) {
      const row = rows.get(id);
      return row ? { revision: row.revision, saveId: row.saveId } : null;
    },
  };
  return { store, rows };
}

describe('saveDraft', () => {
  it('saves a valid document and returns the next revision', async () => {
    const { store } = memoryStore({ [PAGE]: 0 });
    expect(await saveDraft(store, { pageId: PAGE, rawBody: body(EMPTY) })).toEqual({
      status: 200,
      body: { revision: 1, updatedAt: '2026-10-22T10:00:00.123456+00:00' },
    });
  });
  it('stores the parsed document with defaults filled in', async () => {
    const { store, rows } = memoryStore({ [PAGE]: 0 });
    const raw = { schemaVersion: 2, sections: [{ id: 's1', blocks: [] }] };
    await saveDraft(store, { pageId: PAGE, rawBody: body(raw) });
    expect(rows.get(PAGE)!.doc!.sections[0]!.style).toEqual({
      tone: 'base',
      padY: 'md',
      width: 'normal',
    });
  });
  it('answers 409 with the current revision when the base is stale', async () => {
    const { store } = memoryStore({ [PAGE]: 3 });
    expect(await saveDraft(store, { pageId: PAGE, rawBody: body(EMPTY, 2) })).toEqual({
      status: 409,
      body: { error: 'conflict', revision: 3, saveId: null },
    });
  });
  it('stores the save id, and a 409 names the save that wrote the current draft', async () => {
    const { store, rows } = memoryStore({ [PAGE]: 0 });
    await saveDraft(store, { pageId: PAGE, rawBody: body(EMPTY, 0, SAVE) });
    expect(rows.get(PAGE)!.saveId).toBe(SAVE);
    expect(await saveDraft(store, { pageId: PAGE, rawBody: body(EMPTY, 0) })).toEqual({
      status: 409,
      body: { error: 'conflict', revision: 1, saveId: SAVE },
    });
  });
  it('answers 422 for a save id that is not a UUID', async () => {
    const { store } = memoryStore({ [PAGE]: 0 });
    expect((await saveDraft(store, { pageId: PAGE, rawBody: body(EMPTY, 0, 'nope') })).status).toBe(
      422,
    );
  });
  it('answers 404 for an unknown or malformed page id', async () => {
    const { store } = memoryStore({});
    expect((await saveDraft(store, { pageId: PAGE, rawBody: body(EMPTY) })).status).toBe(404);
    expect((await saveDraft(store, { pageId: 'not-a-uuid', rawBody: body(EMPTY) })).status).toBe(
      404,
    );
  });
  it('answers 422 with issue paths for an invalid document', async () => {
    const { store } = memoryStore({ [PAGE]: 0 });
    const dup = {
      schemaVersion: 2,
      sections: [
        {
          id: 's1',
          blocks: [
            { id: 'b1', type: 'faq', props: {} },
            { id: 'b1', type: 'faq', props: {} },
          ],
        },
      ],
    };
    const result = await saveDraft(store, { pageId: PAGE, rawBody: body(dup) });
    expect(result.status).toBe(422);
    expect(result.status === 422 && result.body.issues[0]!.path).toBe('sections.0.blocks.1.id');
  });
  it('answers 422 for a body that is not JSON or lacks a valid baseRevision', async () => {
    const { store } = memoryStore({ [PAGE]: 0 });
    expect((await saveDraft(store, { pageId: PAGE, rawBody: '{nope' })).status).toBe(422);
    expect((await saveDraft(store, { pageId: PAGE, rawBody: body(EMPTY, -1) })).status).toBe(422);
    expect(
      (await saveDraft(store, { pageId: PAGE, rawBody: JSON.stringify({ document: EMPTY }) }))
        .status,
    ).toBe(422);
  });
  it('answers 413 above 4 MiB, counting UTF-8 bytes rather than characters', async () => {
    const { store } = memoryStore({ [PAGE]: 0 });
    const rawBody = `"${'é'.repeat(MAX_DRAFT_BYTES / 2 + 1)}"`;
    expect(rawBody.length).toBeLessThan(MAX_DRAFT_BYTES);
    expect(await saveDraft(store, { pageId: PAGE, rawBody })).toEqual({
      status: 413,
      body: { error: 'too_large', maxBytes: MAX_DRAFT_BYTES },
    });
  });
  it('reports at most 20 issues', async () => {
    const { store } = memoryStore({ [PAGE]: 0 });
    const sections = Array.from({ length: 30 }, () => ({ id: 'same', blocks: [] }));
    const result = await saveDraft(store, {
      pageId: PAGE,
      rawBody: body({ schemaVersion: 2, sections }),
    });
    expect(result.status === 422 && result.body.issues.length).toBe(20);
  });
});
