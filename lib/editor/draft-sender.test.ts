import { describe, expect, it, vi } from 'vitest';
import { createEmptyDocument, type PageDocument } from '@/lib/schema/document';
import { createDraftSender } from './draft-sender';

const doc = createEmptyDocument();
const reply = (status: number, body?: unknown) =>
  new Response(body === undefined ? null : JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
const sender = (response: Response | Error) => {
  const fetchImpl = vi.fn<typeof fetch>(async () => {
    if (response instanceof Error) throw response;
    return response;
  });
  return { fetchImpl, send: createDraftSender('p1', fetchImpl) };
};

describe('createDraftSender', () => {
  it('PUTs the document and base revision as JSON to the page’s draft endpoint', async () => {
    const { fetchImpl, send } = sender(reply(200, { revision: 3, updatedAt: 't' }));
    expect(await send({ doc, baseRevision: 2, keepalive: false })).toEqual({
      kind: 'ok',
      revision: 3,
    });
    const [url, init] = fetchImpl.mock.calls[0]!;
    expect(url).toBe('/api/pages/p1/draft');
    expect(init).toMatchObject({
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      keepalive: false,
    });
    expect(JSON.parse(String(init!.body))).toEqual({ document: doc, baseRevision: 2 });
  });
  it('uses keepalive only when asked and the body fits in 60,000 bytes', async () => {
    const small = sender(reply(200, { revision: 1 }));
    await small.send({ doc, baseRevision: 0, keepalive: true });
    expect(small.fetchImpl.mock.calls[0]![1]).toMatchObject({ keepalive: true });
    const big = sender(reply(200, { revision: 1 }));
    const bigDoc = { ...doc, filler: 'x'.repeat(70_000) } as unknown as PageDocument;
    await big.send({ doc: bigDoc, baseRevision: 0, keepalive: true });
    expect(big.fetchImpl.mock.calls[0]![1]).toMatchObject({ keepalive: false });
  });
  it.each([
    [reply(409, { error: 'conflict', revision: 7 }), { kind: 'conflict', revision: 7 }],
    [
      reply(401, { error: 'unauthorized' }),
      {
        kind: 'rejected',
        status: 401,
        message: 'You were signed out. Sign in again in another tab, then retry.',
      },
    ],
    [
      reply(404, { error: 'not_found' }),
      { kind: 'rejected', status: 404, message: 'This page no longer exists.' },
    ],
    [
      reply(413, { error: 'too_large', maxBytes: 4194304 }),
      {
        kind: 'rejected',
        status: 413,
        message: 'This page is too large to save (over 4 MB). Remove pasted image data.',
      },
    ],
    [
      reply(422, { error: 'invalid', issues: [{ path: 'sections.0.id', message: 'Bad id' }] }),
      {
        kind: 'rejected',
        status: 422,
        message: 'The page has invalid content: sections.0.id: Bad id',
      },
    ],
    [
      reply(403, { error: 'forbidden' }),
      { kind: 'rejected', status: 403, message: 'The server refused the save (HTTP 403).' },
    ],
    [reply(503), { kind: 'network' }],
    [new Error('offline'), { kind: 'network' }],
  ])('maps %# to its response kind', async (response, expected) => {
    expect(await sender(response).send({ doc, baseRevision: 0, keepalive: false })).toEqual(
      expected,
    );
  });
});
