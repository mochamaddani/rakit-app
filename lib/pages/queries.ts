import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/database.types';

// Reads run as the signed-in user, so RLS scopes every query to their workspace.
type Supabase = SupabaseClient<Database>;

export type PageStatus = 'draft' | 'exported' | 'live' | 'archived';
const STATUSES: ReadonlySet<string> = new Set<PageStatus>([
  'draft',
  'exported',
  'live',
  'archived',
]);

export interface PageSummary {
  id: string;
  name: string;
  slug: string;
  status: PageStatus;
  updatedAt: string;
}

/** Newest edit first. */
export async function listPages(supabase: Supabase): Promise<PageSummary[]> {
  const { data, error } = await supabase
    .from('pages')
    .select('id, name, slug, status, updated_at')
    .order('updated_at', { ascending: false });
  if (error) throw error;
  return data.map((row) => ({
    id: row.id,
    name: row.name,
    slug: row.slug,
    status: STATUSES.has(row.status) ? (row.status as PageStatus) : 'draft',
    updatedAt: row.updated_at,
  }));
}

export interface EditorPageRecord {
  id: string;
  name: string;
  currentDraft: unknown;
  draftRevision: number;
}

/** null when the page does not exist or belongs to someone else. `pageId` must be a UUID. */
export async function getPageForEditor(
  supabase: Supabase,
  pageId: string,
): Promise<EditorPageRecord | null> {
  const { data, error } = await supabase
    .from('pages')
    .select('id, name, current_draft, draft_revision')
    .eq('id', pageId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return {
    id: data.id,
    name: data.name,
    currentDraft: data.current_draft,
    draftRevision: data.draft_revision,
  };
}

/** The signed-in user's workspace (one per user, created by a trigger at sign-up). */
export async function getWorkspaceId(supabase: Supabase): Promise<string> {
  const { data, error } = await supabase.from('workspaces').select('id').limit(1).maybeSingle();
  if (error) throw error;
  if (!data) throw new Error('This account has no workspace.');
  return data.id;
}
