import { describe, expect, it } from 'vitest';
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
    expect(migrateDocument({ schemaVersion: 1, sections: [] })).toEqual({
      schemaVersion: 1,
      sections: [],
    });
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
