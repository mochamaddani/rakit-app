const utf8 = new TextEncoder();

/** SHA-256 of the UTF-8 text as 64 lowercase hex characters (browser and Node). */
export async function sha256Hex(text: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', utf8.encode(text));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}
