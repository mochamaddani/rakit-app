import { crc32, deflateSync } from 'node:zlib';
import sharp from 'sharp';
import { expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));
const { processImage } = await import('./process');

const solid = (width: number, height: number, alpha = false) =>
  sharp({
    create: {
      width,
      height,
      channels: alpha ? 4 : 3,
      background: alpha ? { r: 0, g: 120, b: 200, alpha: 0.5 } : '#2563eb',
    },
  });
const meta = (data: Uint8Array) => sharp(data).metadata();

/**
 * A 66-byte PNG claiming `width`×`height`: a header and a one-byte IDAT (sharp refuses a PNG with no
 * IDAT as corrupt), enough for the pixel limit to refuse it before decoding anything.
 */
function pngHeader(width: number, height: number): Buffer {
  const chunk = (type: string, data: Buffer) => {
    const length = Buffer.alloc(4);
    length.writeUInt32BE(data.length);
    const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(body));
    return Buffer.concat([length, body, crc]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // RGB
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(Buffer.alloc(1))),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

it('a 3000×2000 JPEG becomes 1600×1067 and 800×533 WebP', async () => {
  const { large, small } = await processImage(await solid(3000, 2000).jpeg().toBuffer());
  expect([large.width, large.height, small.width, small.height]).toEqual([1600, 1067, 800, 533]);
  expect(await meta(large.data)).toMatchObject({ format: 'webp', width: 1600, height: 1067 });
  expect(await meta(small.data)).toMatchObject({ format: 'webp', width: 800, height: 533 });
});

it('small images are never enlarged', async () => {
  const { large, small } = await processImage(await solid(600, 400).png().toBuffer());
  expect([large.width, large.height, small.width, small.height]).toEqual([600, 400, 600, 400]);
});

it('EXIF orientation is applied', async () => {
  const input = await solid(400, 300).jpeg().withMetadata({ orientation: 6 }).toBuffer();
  const { large } = await processImage(input);
  expect([large.width, large.height]).toEqual([300, 400]);
  expect((await meta(large.data)).orientation).toBeUndefined();
});

it('transparency survives', async () => {
  const { large } = await processImage(await solid(200, 200, true).png().toBuffer());
  expect((await meta(large.data)).hasAlpha).toBe(true);
});

it('GIF and AVIF inputs are accepted', async () => {
  for (const input of [
    await solid(200, 100).gif().toBuffer(),
    await solid(200, 100).avif().toBuffer(),
  ]) {
    expect((await processImage(input)).large).toMatchObject({ width: 200, height: 100 });
  }
});

it('rejects bytes that are not an image, SVG and images over 40 megapixels', async () => {
  const svg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"/>');
  await expect(processImage(new TextEncoder().encode('not an image'))).rejects.toMatchObject({
    reason: 'unsupported',
  });
  await expect(processImage(svg)).rejects.toMatchObject({ reason: 'unsupported' });
  await expect(processImage(pngHeader(10_000, 10_000))).rejects.toMatchObject({
    reason: 'too_large',
  });
});
