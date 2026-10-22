import { describe, expect, it } from 'vitest';
import { createId, IdSchema, sequentialIds } from '@/lib/schema/ids';

describe('ids', () => {
  it('createId returns 10 lowercase alphanumerics that pass IdSchema', () => {
    const id = createId();
    expect(id).toMatch(/^[a-z0-9]{10}$/);
    expect(IdSchema.safeParse(id).success).toBe(true);
  });
  it('sequentialIds is deterministic', () => {
    const next = sequentialIds('it');
    expect([next(), next()]).toEqual(['it1', 'it2']);
  });
  it('IdSchema rejects values that are unsafe in HTML ids or CSS selectors', () => {
    for (const bad of ['', 'a b', 'a"b', '<x>', 'x'.repeat(33)])
      expect(IdSchema.safeParse(bad).success).toBe(false);
  });
});
