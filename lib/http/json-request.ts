// The body of a JSON route handler request. The media type must be JSON (a cross-site form can't
// send it without a CORS preflight), an Origin header must be our own, and the body is read with a
// byte cap, so an oversized or aborted upload never reaches the handler (M2a review M8).

export type JsonRequestResult = { ok: true; text: string } | { ok: false; response: Response };

/** JSON media type (415), same Origin (403), body ≤ maxBytes, streamed with a cap (413), readable (400). */
export async function readJsonRequest(
  request: Request,
  maxBytes: number,
): Promise<JsonRequestResult> {
  const refuse = (status: number, body: Record<string, unknown>): JsonRequestResult => ({
    ok: false,
    response: Response.json(body, { status }),
  });
  const tooLarge = () => refuse(413, { error: 'too_large', maxBytes });

  const mediaType = request.headers.get('content-type')?.split(';', 1)[0]?.trim().toLowerCase();
  if (mediaType !== 'application/json') return refuse(415, { error: 'unsupported_media_type' });
  const origin = request.headers.get('origin');
  if (origin !== null && origin !== new URL(request.url).origin) {
    return refuse(403, { error: 'forbidden' });
  }
  // A declared oversize body is refused before reading it; a chunked one is capped while read.
  if (Number(request.headers.get('content-length') ?? 0) > maxBytes) return tooLarge();
  if (!request.body) return { ok: true, text: '' };

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > maxBytes) {
        await reader.cancel().catch(() => {});
        return tooLarge();
      }
      chunks.push(value);
    }
  } catch {
    // The client went away mid-body.
    return refuse(400, { error: 'unreadable_body' });
  }
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return { ok: true, text: new TextDecoder().decode(bytes) };
}
