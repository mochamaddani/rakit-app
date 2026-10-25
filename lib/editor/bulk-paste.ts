import { ProductItemSchema, type ProductItem } from '@/lib/blocks/special/product-carousel/schema';
import { sanitizeUrl } from '@/lib/renderer/url';
import type { IdFactory } from '@/lib/schema/ids';
import type { PriceFormat } from '@/lib/schema/settings';

// Carousel rows pasted from a spreadsheet or a CSV file (PRD §6.4.1, D-054). Columns, in order:
// title, price, compare-at price, image URL, link. Pure: the dialog shows the result and dispatches
// one listInsertMany, so a paste is one undo step.

export interface PastedRow {
  /** The row's number in the pasted table, counting a header row (as a spreadsheet does). */
  line: number;
  title: string;
  price?: number;
  compareAtPrice?: number;
  imageUrl?: string;
  linkUrl?: string;
}

export interface PasteResult {
  rows: PastedRow[];
  errors: { line: number; message: string }[];
}

const TITLE_MAX = 120;
const HEADER_TITLE = /^(title|name|nama|judul|produk|product)$/i;

/** Tab when the first line has one (Sheets, Excel), else comma, else semicolon. */
function delimiterOf(text: string): string {
  const first = text.split('\n').find((line) => line.trim() !== '') ?? '';
  if (first.includes('\t')) return '\t';
  if (first.includes(',')) return ',';
  return first.includes(';') ? ';' : ',';
}

/** Records of cells; a quoted cell may hold the delimiter, line breaks and "" for a quote. */
function records(text: string, delimiter: string): string[][] {
  const out: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const char = text[i]!;
    if (quoted) {
      if (char === '"' && text[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (char === '"') {
        quoted = false;
      } else {
        cell += char;
      }
    } else if (char === '"' && cell === '') {
      quoted = true;
    } else if (char === delimiter) {
      row.push(cell);
      cell = '';
    } else if (char === '\n') {
      row.push(cell);
      out.push(row);
      row = [];
      cell = '';
    } else {
      cell += char;
    }
  }
  row.push(cell);
  out.push(row);
  return out;
}

/** A currency sign or code before or after the number ("Rp", "IDR", "US$", "RM", "S$", "₱"). */
const CURRENCY = /^(?:rp|idr|us\$|usd|\$|rm|myr|s\$|sgd|php|₱)\s*|\s*(?:rp|idr|usd|myr|sgd|php)$/gi;

/**
 * A price as the owner typed it, for the page currency: "Rp149.000", "Rp 1.250.000,00",
 * "1,234.50", "12,99". In a currency without decimals (IDR) a trailing decimal part (",00") is
 * dropped and every other separator groups thousands. Otherwise the last separator is the decimal
 * point when 1–2 digits follow it, and groups thousands when 3 do. Anything but a currency sign,
 * digits and separators ("149rb", "250 g") is null, never a guess.
 */
export function parsePrice(text: string, format: PriceFormat): number | null {
  const kept = text
    .trim()
    .replace(CURRENCY, '')
    .replace(/[.,]-$/, '')
    .replace(/(\d)\s+(?=\d)/g, '$1');
  if (!/^\d[\d.,]*$/.test(kept)) return null;
  let normalized: string;
  if (format.decimals === 0) {
    normalized = kept.replace(/[.,]\d{1,2}$/, '').replace(/[.,]/g, '');
  } else {
    const at = Math.max(kept.lastIndexOf('.'), kept.lastIndexOf(','));
    const after = at < 0 ? 0 : kept.length - at - 1;
    normalized =
      at < 0 || after === 3
        ? kept.replace(/[.,]/g, '')
        : `${kept.slice(0, at).replace(/[.,]/g, '')}.${kept.slice(at + 1)}`;
  }
  const value = Number(normalized);
  return Number.isFinite(value) && value <= 1e12 ? value : null;
}

const isWebUrl = (url: string) => /^https?:\/\//i.test(url) && sanitizeUrl(url, 'link') !== null;

export function parseRows(text: string, format: PriceFormat): PasteResult {
  const normalized = text.replace(/\r\n?/g, '\n');
  const table = records(normalized, delimiterOf(normalized));
  const result: PasteResult = { rows: [], errors: [] };
  table.forEach((cells, index) => {
    const line = index + 1;
    const [title = '', price = '', compareAt = '', image = '', link = ''] = cells.map((cell) =>
      cell.trim(),
    );
    if (cells.every((cell) => cell.trim() === '')) return;
    if (index === 0 && HEADER_TITLE.test(title) && parsePrice(price, format) === null) return;
    const fail = (message: string) =>
      result.errors.push({ line, message: `Row ${line}: ${message}` });
    if (!title) return void fail('the title is missing');
    if (title.length > TITLE_MAX) {
      return void fail(`the title is longer than ${TITLE_MAX} characters`);
    }
    const row: PastedRow = { line, title };
    for (const [key, cell] of [
      ['price', price],
      ['compareAtPrice', compareAt],
    ] as const) {
      if (!cell) continue;
      const value = parsePrice(cell, format);
      if (value === null) return void fail(`"${cell}" isn't a price`);
      row[key] = value;
    }
    if (image) {
      if (!isWebUrl(image)) return void fail('the image address must start with https://');
      row.imageUrl = image;
    }
    if (link) {
      if (!isWebUrl(link)) return void fail('the link must start with https://');
      row.linkUrl = link;
    }
    result.rows.push(row);
  });
  return result;
}

/** Carousel items for the rows: the image's alt text is the product title, the CTA "Buy now". */
export function rowsToCarouselItems(rows: PastedRow[], newId: IdFactory): ProductItem[] {
  return rows.map((row) =>
    ProductItemSchema.parse({
      id: newId(),
      title: row.title,
      price: row.price,
      compareAtPrice: row.compareAtPrice,
      image: row.imageUrl ? { src: row.imageUrl, alt: row.title } : {},
      cta: {
        label: 'Buy now',
        link: row.linkUrl ? { kind: 'url', url: row.linkUrl, newTab: false } : { kind: 'default' },
      },
    }),
  );
}
