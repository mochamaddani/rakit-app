import { getApiUser, unauthorizedResponse } from '@/lib/auth/require-user';
import { MAX_DRAFT_BYTES, saveDraft } from '@/lib/pages/draft';
import { createSupabaseDraftStore } from '@/lib/pages/draft-store';
import { readJsonRequest } from '@/lib/http/json-request';
import { createSupabaseServerClient } from '@/lib/supabase/server';

/** Saves the editor's draft with a revision check (docs/DECISIONS.md D-035). */
export async function PUT(request: Request, ctx: RouteContext<'/api/pages/[pageId]/draft'>) {
  if (!(await getApiUser())) return unauthorizedResponse();
  // JSON only, same origin, at most 4 MiB, readable to the end (M2a review M8).
  const body = await readJsonRequest(request, MAX_DRAFT_BYTES);
  if (!body.ok) return body.response;

  const { pageId } = await ctx.params;
  const store = createSupabaseDraftStore(await createSupabaseServerClient());
  const result = await saveDraft(store, { pageId, rawBody: body.text });
  return Response.json(result.body, { status: result.status });
}
