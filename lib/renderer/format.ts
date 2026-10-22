import type { Lang, PriceFormat } from '@/lib/schema/settings';

// No Intl here: its output differs between ICU builds, and the renderer must be byte-stable
// across Node and browsers (docs/DECISIONS.md D-011).

export function formatPrice(amount: number, format: PriceFormat): string {
  const [whole = '', fraction] = Math.abs(amount).toFixed(format.decimals).split('.');
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, format.thousandsSep);
  const number = fraction ? `${grouped}${format.decimalSep}${fraction}` : grouped;
  return `${amount < 0 ? '-' : ''}${format.prefix}${number}${format.suffix}`;
}

/** Whole-percent discount when the compare-at price is really higher; otherwise null. */
export function discountPercent(price?: number, compareAt?: number): number | null {
  if (price === undefined || compareAt === undefined) return null;
  if (!(price > 0 && price < compareAt)) return null;
  const percent = Math.round((1 - price / compareAt) * 100);
  return percent >= 1 ? percent : null;
}

export function formatDecimal(value: number, lang: Lang): string {
  const rounded = Math.round(value * 10) / 10;
  const text = Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
  return lang === 'id' ? text.replace('.', ',') : text;
}
