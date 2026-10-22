import { expect, it } from 'vitest';
import { readJsonRequest } from './json-request';

const json = { 'content-type': 'application/json' };
const stream = (chunks: string[], { fail = false } = {}) =>
  new ReadableStream<Uint8Array>({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(new TextEncoder().encode(chunk));
      if (fail) controller.error(new Error('aborted'));
      else controller.close();
    },
  });
const request = (init: RequestInit & { duplex?: 'half' }) =>
  new Request('http://localhost:3000/api/x', { method: 'POST', ...init });

it('reads a JSON body', async () => {
  expect(await readJsonRequest(request({ headers: json, body: '{"a":1}' }), 100)).toEqual({
    ok: true,
    text: '{"a":1}',
  });
  const sameOrigin = request({
    headers: { 'content-type': 'application/json; charset=utf-8', origin: 'http://localhost:3000' },
    body: '{}',
  });
  expect((await readJsonRequest(sameOrigin, 100)).ok).toBe(true);
});

it.each<[string, RequestInit & { duplex?: 'half' }, number]>([
  ['text/plain → 415', { headers: { 'content-type': 'text/plain' }, body: '{}' }, 415],
  [
    'foreign Origin → 403',
    { headers: { ...json, origin: 'https://evil.example' }, body: '{}' },
    403,
  ],
  [
    'content-length over the cap → 413',
    { headers: { ...json, 'content-length': '101' }, body: '{}' },
    413,
  ],
  [
    'a chunked body over the cap → 413',
    { headers: json, body: stream(['x'.repeat(60), 'x'.repeat(60)]), duplex: 'half' },
    413,
  ],
  [
    'an erroring body stream → 400',
    { headers: json, body: stream(['{'], { fail: true }), duplex: 'half' },
    400,
  ],
])('%s', async (_, init, status) => {
  const result = await readJsonRequest(request(init), 100);
  expect(result.ok).toBe(false);
  expect(result.ok ? null : result.response.status).toBe(status);
});
