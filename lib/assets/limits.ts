// Upload limits and storage layout (docs/DECISIONS.md D-045), shared by the browser and the server.

export const UPLOAD_BUCKET = 'uploads';
export const ASSET_BUCKET = 'assets';
export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
export const MAX_INPUT_PIXELS = 40_000_000;
export const VARIANT_WIDTHS = [1600, 800] as const;
export const WEBP_QUALITY = 80;
/** Accepted original types and the file extension each is stored with. */
export const UPLOAD_TYPES = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'image/avif': 'avif',
} as const;

/** `<workspaceId>/<assetId>` → that variant's object name in the assets bucket. */
export const variantPath = (assetPath: string, width: (typeof VARIANT_WIDTHS)[number]) =>
  `${assetPath}-${width}.webp`;
