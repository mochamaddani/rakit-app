import type { AutosaveState, SaveStatus } from '@/lib/editor/autosave';
import type { PageDocument } from '@/lib/schema/document';
import type { ExportBuild, ExportOptions } from './build';

// Recording an export (docs/DECISIONS.md D-049): the browser uploads the HTML to the private
// page-versions bucket, then one RPC inserts the version row and points the page at it.

export interface LatestExport {
  versionId: string;
  createdAt: string;
  /** The draft revision the export was built from. */
  draftRevision: number | null;
}

export interface RecordArgs {
  id: string;
  pageId: string;
  document: PageDocument;
  htmlPath: string;
  exportSettings: ExportOptions;
  byteSize: number;
  sha256: string;
  draftRevision: number;
}

export interface RecordDeps {
  /** storage.from('page-versions').upload(path, html, { contentType: 'text/html', upsert: false }). */
  upload(path: string, html: Blob): Promise<{ ok: boolean; message?: string }>;
  /** rpc('record_page_version', …). */
  rpc(args: RecordArgs): Promise<{ ok: true; createdAt: string } | { ok: false; message: string }>;
  remove(path: string): Promise<void>;
  newId(): string;
}

export interface RecordInput {
  workspaceId: string;
  pageId: string;
  doc: PageDocument;
  build: ExportBuild;
  options: ExportOptions;
  draftRevision: number;
}

const messageOf = (error: unknown) => (error instanceof Error ? error.message : String(error));

/** Uploads, then records; a failed record removes the upload. Never throws. */
export async function recordExport(
  input: RecordInput,
  deps: RecordDeps,
): Promise<{ ok: true; latest: LatestExport } | { ok: false; message: string }> {
  const id = deps.newId();
  const htmlPath = `${input.workspaceId}/${input.pageId}/${id}.html`;
  try {
    const uploaded = await deps.upload(
      htmlPath,
      new Blob([input.build.html], { type: 'text/html' }),
    );
    if (!uploaded.ok) return { ok: false, message: uploaded.message ?? 'The upload failed.' };
    const recorded = await deps.rpc({
      id,
      pageId: input.pageId,
      document: input.doc,
      htmlPath,
      exportSettings: input.options,
      byteSize: input.build.bytes,
      sha256: input.build.sha256,
      draftRevision: input.draftRevision,
    });
    if (!recorded.ok) {
      await deps.remove(htmlPath).catch(() => {});
      return recorded;
    }
    return {
      ok: true,
      latest: { versionId: id, createdAt: recorded.createdAt, draftRevision: input.draftRevision },
    };
  } catch (error) {
    return { ok: false, message: messageOf(error) };
  }
}

/** Whether the draft the server holds is the one last exported. */
export function exportFreshness(
  latest: LatestExport | null,
  autosave: { status: SaveStatus; revision: number },
): 'none' | 'current' | 'stale' {
  if (!latest) return 'none';
  return autosave.status === 'saved' && autosave.revision === latest.draftRevision
    ? 'current'
    : 'stale';
}

/** Why an export has to wait for the draft to be saved; null once it is saved. */
export function unsavedReason(state: AutosaveState): string | null {
  switch (state.status) {
    case 'saved':
      return null;
    case 'offline':
      return "you're offline or the server can't be reached.";
    case 'error':
      return state.error ?? 'the server refused the save.';
    case 'conflict':
      return 'this page was changed in another tab or window.';
    default:
      return "the latest changes aren't saved yet.";
  }
}
