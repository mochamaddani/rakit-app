import type { SaveRequest, SaveResponse } from './autosave';

/** Browsers cap the bodies of all in-flight keepalive requests at 64 KiB together. */
export const KEEPALIVE_MAX_BYTES = 60_000;

const utf8 = new TextEncoder();

async function readJson(response: Response): Promise<Record<string, unknown>> {
  try {
    const body: unknown = await response.json();
    return typeof body === 'object' && body !== null ? (body as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

/** A revision the editor can build on; anything else means the answer can't be trusted (M4). */
function revisionOf(body: Record<string, unknown>): number | null {
  const { revision } = body;
  return typeof revision === 'number' && Number.isInteger(revision) && revision >= 0
    ? revision
    : null;
}

async function rejection(response: Response): Promise<string> {
  switch (response.status) {
    case 401:
      return 'You were signed out. Sign in again in another tab, then retry.';
    case 404:
      return 'This page no longer exists.';
    case 413:
      return 'This page is too large to save (over 4 MB). Remove pasted image data.';
    case 422: {
      const issues = (await readJson(response)).issues;
      const first = Array.isArray(issues)
        ? (issues[0] as { path?: unknown; message?: unknown })
        : undefined;
      return first
        ? `The page has invalid content: ${String(first.path)}: ${String(first.message)}`
        : 'The page has invalid content.';
    }
    default:
      return `The server refused the save (HTTP ${response.status}).`;
  }
}

/** PUT /api/pages/[pageId]/draft (D-035), with each answer mapped for the autosave controller. */
export function createDraftSender(
  pageId: string,
  fetchImpl: typeof fetch = (input, init) => fetch(input, init),
): (request: SaveRequest) => Promise<SaveResponse> {
  return async ({ doc, baseRevision, keepalive, saveId }) => {
    const body = JSON.stringify({ document: doc, baseRevision, saveId });
    let response: Response;
    try {
      response = await fetchImpl(`/api/pages/${pageId}/draft`, {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body,
        keepalive: keepalive && utf8.encode(body).byteLength <= KEEPALIVE_MAX_BYTES,
      });
    } catch {
      return { kind: 'network' };
    }
    if (response.ok) {
      const revision = revisionOf(await readJson(response));
      return revision === null ? { kind: 'network' } : { kind: 'ok', revision };
    }
    if (response.status === 409) {
      const conflict = await readJson(response);
      const revision = revisionOf(conflict);
      if (revision === null) return { kind: 'network' };
      return {
        kind: 'conflict',
        revision,
        saveId: typeof conflict.saveId === 'string' ? conflict.saveId : null,
      };
    }
    if (response.status >= 500) return { kind: 'network' };
    return { kind: 'rejected', status: response.status, message: await rejection(response) };
  };
}
