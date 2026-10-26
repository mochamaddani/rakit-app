import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { CURRENT_SCHEMA_VERSION } from '@/lib/schema/document';
import type { Database, Json } from '@/lib/supabase/database.types';
import { getWorkspaceId } from './queries';
import { uniqueSlug } from './slug';

const UNIQUE_VIOLATION = '23505';

export interface NewPage {
  name: string;
  /** Made unique in the workspace (`base`, `base-2`, …). */
  slugBase: string;
  /** A valid PageDocument; callers parse it first. */
  document: unknown;
  tags?: string[];
}

/** Inserts a draft page as the signed-in user. Blank pages, template pages and duplicates use it. */
export async function insertPage(
  supabase: SupabaseClient<Database>,
  page: NewPage,
): Promise<{ ok: true; id: string } | { ok: false }> {
  const workspaceId = await getWorkspaceId(supabase);
  // Two creates can race for the same slug; the unique index decides, and the loser retries.
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const { data: taken, error: readError } = await supabase
      .from('pages')
      .select('slug')
      .like('slug', `${page.slugBase}%`);
    if (readError) return { ok: false };
    const { data, error } = await supabase
      .from('pages')
      .insert({
        workspace_id: workspaceId,
        name: page.name,
        // Slugs name the exported file; renaming a page keeps it (the export dialog edits it).
        slug: uniqueSlug(page.slugBase, new Set(taken.map((row) => row.slug))),
        current_draft: page.document as NonNullable<Json>,
        schema_version: CURRENT_SCHEMA_VERSION,
        tags: page.tags ?? [],
      })
      .select('id')
      .single();
    if (!error) return { ok: true, id: data.id };
    if (error.code !== UNIQUE_VIOLATION) return { ok: false };
  }
  return { ok: false };
}
