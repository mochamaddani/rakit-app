import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { DraftStore } from '@/lib/pages/draft';
import { CURRENT_SCHEMA_VERSION } from '@/lib/schema/document';
import type { Database, Json } from '@/lib/supabase/database.types';

/** DraftStore on the pages table, queried as the signed-in user (RLS scopes the rows). */
export function createSupabaseDraftStore(supabase: SupabaseClient<Database>): DraftStore {
  return {
    async update(pageId, doc, baseRevision, saveId) {
      // Matching on the base revision makes the write conditional: a stale save updates nothing.
      const { data, error } = await supabase
        .from('pages')
        .update({
          current_draft: doc as unknown as NonNullable<Json>,
          schema_version: CURRENT_SCHEMA_VERSION,
          draft_revision: baseRevision + 1,
          draft_save_id: saveId,
        })
        .eq('id', pageId)
        .eq('draft_revision', baseRevision)
        .select('draft_revision, updated_at')
        .maybeSingle();
      if (error) throw error;
      return data && { revision: data.draft_revision, updatedAt: data.updated_at };
    },
    async current(pageId) {
      const { data, error } = await supabase
        .from('pages')
        .select('draft_revision, draft_save_id')
        .eq('id', pageId)
        .maybeSingle();
      if (error) throw error;
      return data && { revision: data.draft_revision, saveId: data.draft_save_id };
    },
  };
}
