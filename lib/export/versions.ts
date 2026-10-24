import type { SupabaseClient } from '@supabase/supabase-js';
import { safeParseDocument, type PageDocument } from '@/lib/schema/document';
import type { Database } from '@/lib/supabase/database.types';
import { saveFile, VERSION_BUCKET } from './browser';
import type { ExportOptions } from './build';

// The versions list and rollback (docs/DECISIONS.md D-049), as the signed-in user.

type BrowserSupabase = SupabaseClient<Database>;

export interface VersionRow {
  id: string;
  createdAt: string;
  byteSize: number;
  sha256: string;
  options: Partial<ExportOptions>;
  htmlPath: string;
}

export const VERSIONS_SHOWN = 50;

/** Newest first, at most 50. */
export async function listVersions(
  supabase: BrowserSupabase,
  pageId: string,
): Promise<VersionRow[]> {
  const { data, error } = await supabase
    .from('page_versions')
    .select('id, created_at, byte_size, html_sha256, export_settings, html_path')
    .eq('page_id', pageId)
    .order('created_at', { ascending: false })
    .limit(VERSIONS_SHOWN);
  if (error) throw error;
  return data.map((row) => ({
    id: row.id,
    createdAt: row.created_at,
    byteSize: row.byte_size,
    sha256: row.html_sha256,
    options: (row.export_settings ?? {}) as Partial<ExportOptions>,
    htmlPath: row.html_path,
  }));
}

/** The stored document, migrated and validated, or the reason it can't be restored. */
export async function loadVersionDocument(
  supabase: BrowserSupabase,
  versionId: string,
): Promise<{ ok: true; doc: PageDocument } | { ok: false; message: string }> {
  const { data, error } = await supabase
    .from('page_versions')
    .select('document')
    .eq('id', versionId)
    .maybeSingle();
  if (error) return { ok: false, message: error.message };
  if (!data) return { ok: false, message: 'This version no longer exists.' };
  const parsed = safeParseDocument(data.document);
  if (parsed.ok) return { ok: true, doc: parsed.doc };
  const issue = parsed.error.issues[0];
  return {
    ok: false,
    message: issue ? `${issue.path}: ${issue.message}` : 'The stored page is not valid.',
  };
}

/** Saves a stored export as `fileName`; false when it can't be read. */
export async function downloadVersion(
  supabase: BrowserSupabase,
  htmlPath: string,
  fileName: string,
): Promise<boolean> {
  const { data, error } = await supabase.storage.from(VERSION_BUCKET).download(htmlPath);
  if (error || !data) return false;
  saveFile(await data.text(), fileName);
  return true;
}
