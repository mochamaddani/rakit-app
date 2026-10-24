import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { LatestExport } from '@/lib/export/record';
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
  lastExportedAt: string | null;
  /** The latest export's stored file, for "Download HTML". */
  latestHtmlPath: string | null;
}

/** Newest edit first. */
export async function listPages(supabase: Supabase): Promise<PageSummary[]> {
  const { data, error } = await supabase
    .from('pages')
    .select('id, name, slug, status, updated_at, latest_version_id')
    .order('updated_at', { ascending: false });
  if (error) throw error;
  const versionIds = data.flatMap((row) => (row.latest_version_id ? [row.latest_version_id] : []));
  const latest = new Map<string, { created_at: string; html_path: string }>();
  if (versionIds.length > 0) {
    const { data: versions, error: versionError } = await supabase
      .from('page_versions')
      .select('id, created_at, html_path')
      .in('id', versionIds);
    if (versionError) throw versionError;
    for (const version of versions) latest.set(version.id, version);
  }
  return data.map((row) => {
    const version = row.latest_version_id ? latest.get(row.latest_version_id) : undefined;
    return {
      id: row.id,
      name: row.name,
      slug: row.slug,
      status: STATUSES.has(row.status) ? (row.status as PageStatus) : 'draft',
      updatedAt: row.updated_at,
      lastExportedAt: version?.created_at ?? null,
      latestHtmlPath: version?.html_path ?? null,
    };
  });
}

export interface EditorPageRecord {
  id: string;
  name: string;
  /** Names the exported file (`<slug>.html`). */
  slug: string;
  currentDraft: unknown;
  draftRevision: number;
  latestExport: LatestExport | null;
}

/** null when the page does not exist or belongs to someone else. `pageId` must be a UUID. */
export async function getPageForEditor(
  supabase: Supabase,
  pageId: string,
): Promise<EditorPageRecord | null> {
  const { data, error } = await supabase
    .from('pages')
    .select('id, name, slug, current_draft, draft_revision, latest_version_id')
    .eq('id', pageId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return {
    id: data.id,
    name: data.name,
    slug: data.slug,
    currentDraft: data.current_draft,
    draftRevision: data.draft_revision,
    latestExport: data.latest_version_id
      ? await getLatestExport(supabase, data.latest_version_id)
      : null,
  };
}

async function getLatestExport(
  supabase: Supabase,
  versionId: string,
): Promise<LatestExport | null> {
  const { data, error } = await supabase
    .from('page_versions')
    .select('id, created_at, draft_revision')
    .eq('id', versionId)
    .maybeSingle();
  if (error) throw error;
  return (
    data && { versionId: data.id, createdAt: data.created_at, draftRevision: data.draft_revision }
  );
}

/** The signed-in user's workspace (one per user, created by a trigger at sign-up). */
export async function getWorkspaceId(supabase: Supabase): Promise<string> {
  const { data, error } = await supabase.from('workspaces').select('id').limit(1).maybeSingle();
  if (error) throw error;
  if (!data) throw new Error('This account has no workspace.');
  return data.id;
}
