import type { Theme } from './theme';

// WCAG 2.x contrast. The theme panel only hints at contrast; M5 validates and auto-adjusts.

/** WCAG AA for body text. */
export const AA_TEXT_RATIO = 4.5;

/** [foreground, background] pairs that sit on each other in rendered pages (section tones, D-015). */
export const THEME_CONTRAST_PAIRS = [
  ['onPrimary', 'primary'],
  ['onAccent', 'accent'],
  ['text', 'background'],
  ['mutedText', 'background'],
  ['text', 'surface'],
  ['onDark', 'dark'],
] as const satisfies ReadonlyArray<readonly [keyof Theme['colors'], keyof Theme['colors']]>;

function linear(channel: number): number {
  const c = channel / 255;
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

/** Relative luminance of a `#RRGGBB` color. */
export function relativeLuminance(hex: string): number {
  const n = Number.parseInt(hex.slice(1), 16);
  return (
    0.2126 * linear((n >> 16) & 255) + 0.7152 * linear((n >> 8) & 255) + 0.0722 * linear(n & 255)
  );
}

/** 1 to 21; symmetric in its arguments. */
export function contrastRatio(foreground: string, background: string): number {
  const a = relativeLuminance(foreground);
  const b = relativeLuminance(background);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}
