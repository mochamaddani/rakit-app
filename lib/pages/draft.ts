import { z } from 'zod';
import { safeParseDocument, type PageDocument } from '@/lib/schema/document';
import type { DocumentIssue } from '@/lib/schema/errors';

// Draft saves (docs/DECISIONS.md D-035): validated here, written only when they are based on the
// current revision. The storage is a seam so the rules can be tested without a database.

/** Vercel caps request bodies at 4.5 MB. */
export const MAX_DRAFT_BYTES = 4 * 1024 * 1024;
const MAX_ISSUES = 20;

export interface DraftStore {
  /** Writes when the stored revision equals baseRevision; null when no row matched. */
  update(
    pageId: string,
    doc: PageDocument,
    baseRevision: number,
  ): Promise<{ revision: number; updatedAt: string } | null>;
  /** The current revision, or null when the page does not exist or is not visible to the caller. */
  currentRevision(pageId: string): Promise<number | null>;
}

export type SaveDraftResult =
  | { status: 200; body: { revision: number; updatedAt: string } }
  | { status: 404; body: { error: 'not_found' } }
  | { status: 409; body: { error: 'conflict'; revision: number } }
  | { status: 413; body: { error: 'too_large'; maxBytes: number } }
  | { status: 422; body: { error: 'invalid'; issues: DocumentIssue[] } };

const PageIdSchema = z.uuid();
const SaveBodySchema = z.object({ document: z.unknown(), baseRevision: z.number().int().min(0) });
const utf8 = new TextEncoder();
const NOT_FOUND = { status: 404, body: { error: 'not_found' } } as const;

const invalid = (issues: readonly DocumentIssue[]): SaveDraftResult => ({
  status: 422,
  body: { error: 'invalid', issues: issues.slice(0, MAX_ISSUES) },
});

export async function saveDraft(
  store: DraftStore,
  input: { pageId: string; rawBody: string },
): Promise<SaveDraftResult> {
  if (!PageIdSchema.safeParse(input.pageId).success) return NOT_FOUND;
  if (utf8.encode(input.rawBody).byteLength > MAX_DRAFT_BYTES) {
    return { status: 413, body: { error: 'too_large', maxBytes: MAX_DRAFT_BYTES } };
  }
  let json: unknown;
  try {
    json = JSON.parse(input.rawBody);
  } catch {
    return invalid([{ path: '', message: 'The request body is not JSON' }]);
  }
  const body = SaveBodySchema.safeParse(json);
  if (!body.success) {
    return invalid(
      body.error.issues.map((issue) => ({
        path: issue.path.map(String).join('.'),
        message: issue.message,
      })),
    );
  }
  const parsed = safeParseDocument(body.data.document);
  if (!parsed.ok) return invalid(parsed.error.issues);

  const saved = await store.update(input.pageId, parsed.doc, body.data.baseRevision);
  if (saved) return { status: 200, body: saved };
  const current = await store.currentRevision(input.pageId);
  return current === null
    ? NOT_FOUND
    : { status: 409, body: { error: 'conflict', revision: current } };
}
