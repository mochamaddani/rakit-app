import { createSupabaseAssetStore } from '@/lib/assets/asset-store';
import { processUpload } from '@/lib/assets/upload';
import { getApiUser, unauthorizedResponse } from '@/lib/auth/require-user';
import { readJsonRequest } from '@/lib/http/json-request';
import { getWorkspaceId } from '@/lib/pages/queries';
import { createSupabaseServerClient } from '@/lib/supabase/server';

const MAX_BODY_BYTES = 4096;

/** Turns an uploaded original into WebP variants and an assets row (docs/DECISIONS.md D-045). */
export async function POST(request: Request) {
  if (!(await getApiUser())) return unauthorizedResponse();
  const body = await readJsonRequest(request, MAX_BODY_BYTES);
  if (!body.ok) return body.response;
  let path: unknown;
  try {
    path = (JSON.parse(body.text) as { path?: unknown } | null)?.path;
  } catch {
    path = undefined;
  }
  if (typeof path !== 'string') return Response.json({ error: 'bad_path' }, { status: 400 });

  const client = await createSupabaseServerClient();
  const result = await processUpload(createSupabaseAssetStore(client), {
    workspaceId: await getWorkspaceId(client),
    path,
    newId: () => crypto.randomUUID(),
  });
  return Response.json(result.body, { status: result.status });
}
