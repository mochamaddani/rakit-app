import { describe, expect, it } from 'vitest';
import { parseDocument } from '@/lib/schema/document';
import { DocumentValidationError } from '@/lib/schema/errors';
import { migrateDocument } from '@/lib/schema/migrations';

describe('migrateDocument', () => {
  it('treats a missing schemaVersion as 0 and applies steps in order', () => {
    const v0 = { blocks: [] };
    const out = migrateDocument(v0, { 0: (d) => ({ ...d, schemaVersion: 1, sections: [] }) }, 1);
    expect(out).toEqual({ blocks: [], schemaVersion: 1, sections: [] });
    expect(v0).toEqual({ blocks: [] });
  });
  it('passes current documents through unchanged', () => {
    expect(migrateDocument({ schemaVersion: 2, sections: [] })).toEqual({
      schemaVersion: 2,
      sections: [],
    });
  });
  it('1 → 2 drops cookie banners and the sections they leave empty', () => {
    const banner = { id: 'bC', type: 'cookie-banner', props: {} };
    const hero = { id: 'bH', type: 'hero', props: { headline: 'Promo' } };
    const v1 = {
      schemaVersion: 1,
      settings: { lang: 'id' },
      sections: [
        { id: 's1', blocks: [hero, banner] },
        { id: 's2', blocks: [banner] },
        { id: 's3', blocks: [] },
      ],
    };
    expect(migrateDocument(v1)).toEqual({
      schemaVersion: 2,
      settings: { lang: 'id' },
      sections: [
        { id: 's1', blocks: [hero] },
        { id: 's3', blocks: [] },
      ],
    });
    expect(parseDocument(v1).sections.map((s) => s.id)).toEqual(['s1', 's3']);
  });
  it('refuses documents from a newer app version', () => {
    expect(() => migrateDocument({ schemaVersion: 99 })).toThrow(/newer/);
  });
  it('fails loudly when a migration step is missing', () => {
    expect(() => migrateDocument({ schemaVersion: 0 }, {}, 1)).toThrow(
      /no migration from version 0/,
    );
  });
  it('rejects non-object input', () => {
    expect(() => migrateDocument('x')).toThrow(DocumentValidationError);
  });
});
