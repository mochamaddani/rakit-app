import type { SupabaseClient } from '@supabase/supabase-js';
import { describe, expect, it } from 'vitest';
import type { Database } from '@/lib/supabase/database.types';
import { loadVersionDocument } from './versions';

/** A client whose single-row query answers with `row`. */
const client = (row: unknown, error: unknown = null) =>
  ({
    from: () => ({
      select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: row, error }) }) }),
    }),
  }) as unknown as SupabaseClient<Database>;

describe('loadVersionDocument', () => {
  it('loadVersionDocument migrates an old document and reports an invalid one', async () => {
    const old = {
      document: {
        schemaVersion: 1,
        settings: { seo: { title: 'Lama' } },
        sections: [{ id: 's1', blocks: [{ id: 'b1', type: 'hero', props: { headline: 'Halo' } }] }],
      },
    };
    const loaded = await loadVersionDocument(client(old), 'v1');
    expect(loaded.ok).toBe(true);
    if (loaded.ok) {
      expect(loaded.doc.settings.tracking.metaPixelId).toBe('');
      expect(loaded.doc.sections[0]!.blocks[0]!.props).toMatchObject({ headline: 'Halo' });
    }

    const invalid = await loadVersionDocument(
      client({
        document: {
          schemaVersion: 1,
          sections: [{ id: 's1', blocks: [{ id: 'b1', type: 'hero', props: {} }] }],
        },
      }),
      'v2',
    );
    expect(invalid).toEqual({ ok: false, message: expect.stringContaining('headline') });
  });

  it('a missing version or a failed read says so', async () => {
    expect(await loadVersionDocument(client(null), 'v3')).toEqual({
      ok: false,
      message: 'This version no longer exists.',
    });
    expect(await loadVersionDocument(client(null, { message: 'boom' }), 'v4')).toEqual({
      ok: false,
      message: 'boom',
    });
  });
});
