import { getApiUser, unauthorizedResponse } from '@/lib/auth/require-user';
import { MAX_DRAFT_BYTES, saveDraft } from '@/lib/pages/draft';
import { createSupabaseDraftStore } from '@/lib/pages/draft-store';
import { createSupabaseServerClient } from '@/lib/supabase/server';

/** Saves the editor's draft with a revision check (docs/DECISIONS.md D-035). */
export async function PUT(request: Request, ctx: RouteContext<'/api/pages/[pageId]/draft'>) {
  if (!(await getApiUser())) return unauthorizedResponse();

  // JSON only: a cross-site form can send text/plain without a CORS preflight.
  const mediaType = request.headers.get('content-type')?.split(';', 1)[0]?.trim().toLowerCase();
  if (mediaType !== 'application/json') {
    return Response.json({ error: 'unsupported_media_type' }, { status: 415 });
  }
  const origin = request.headers.get('origin');
  if (origin !== null && origin !== new URL(request.url).origin) {
    return Response.json({ error: 'forbidden' }, { status: 403 });
  }
  // Refuse a declared oversize body before reading it; saveDraft re-checks the actual bytes.
  if (Number(request.headers.get('content-length') ?? 0) > MAX_DRAFT_BYTES) {
    return Response.json({ error: 'too_large', maxBytes: MAX_DRAFT_BYTES }, { status: 413 });
  }

  const rawBody = await request.text();
  const { pageId } = await ctx.params;
  const store = createSupabaseDraftStore(await createSupabaseServerClient());
  const result = await saveDraft(store, { pageId, rawBody });
  return Response.json(result.body, { status: result.status });
}
