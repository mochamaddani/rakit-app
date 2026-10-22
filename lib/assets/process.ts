import 'server-only';
import sharp from 'sharp';
import { MAX_INPUT_PIXELS, VARIANT_WIDTHS, WEBP_QUALITY } from './limits';

// WebP variants of an uploaded image (docs/DECISIONS.md D-008, D-045): EXIF orientation applied,
// the first frame of an animation, metadata dropped, never enlarged.

export class ImageRejected extends Error {
  constructor(readonly reason: 'unsupported' | 'too_large') {
    super(reason === 'too_large' ? 'The image has too many pixels' : 'Not an image sharp can read');
    this.name = 'ImageRejected';
  }
}

export interface Variant {
  width: number;
  height: number;
  data: Uint8Array;
}

/** sharp's names; AVIF reads as heif (and so does HEIC, which the prebuilt binary can't decode). */
const FORMATS = new Set(['jpeg', 'png', 'webp', 'gif', 'heif']);

const rejection = (error: unknown) =>
  error instanceof ImageRejected
    ? error
    : new ImageRejected(/pixel limit/i.test(String(error)) ? 'too_large' : 'unsupported');

async function variant(input: Uint8Array, width: number): Promise<Variant> {
  const { data, info } = await sharp(input, { limitInputPixels: MAX_INPUT_PIXELS })
    .rotate()
    .resize({ width, withoutEnlargement: true })
    .webp({ quality: WEBP_QUALITY })
    .toBuffer({ resolveWithObject: true });
  return { width: info.width, height: info.height, data };
}

export async function processImage(input: Uint8Array): Promise<{ large: Variant; small: Variant }> {
  try {
    const { format, width = 0, height = 0 } = await sharp(input).metadata();
    if (!format || !FORMATS.has(format)) throw new ImageRejected('unsupported');
    // Refused from the header alone, before any pixels are decoded.
    if (width * height > MAX_INPUT_PIXELS) throw new ImageRejected('too_large');
    const [large, small] = await Promise.all(VARIANT_WIDTHS.map((w) => variant(input, w)));
    return { large: large!, small: small! };
  } catch (error) {
    throw rejection(error);
  }
}
