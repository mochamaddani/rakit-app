import { describe, expect, it } from 'vitest';
import { ProductItemSchema } from '@/lib/blocks/special/product-carousel/schema';
import { sequentialIds } from '@/lib/schema/ids';
import { PRICE_FORMATS } from '@/lib/schema/settings';
import { parsePrice, parseRows, rowsToCarouselItems } from './bulk-paste';

const IDR = PRICE_FORMATS.IDR;
const USD = PRICE_FORMATS.USD;

describe('parseRows', () => {
  it('parses a Sheets paste with a header, Rp prices, quoted cells and bad rows', () => {
    const text = [
      'Nama\tHarga\tHarga coret\tGambar\tLink',
      'Teh Kumis Kucing\tRp149.000\tRp199.000\thttps://cdn.test/a.webp\thttps://shop.test/a',
      '"Paket\tHemat\nIsi 3"\t249.000\t\t\t',
      '\t99.000\t\t\t',
      'Paket Besar\tabc\t\t\t',
      'Paket Sultan\t1.250.000',
      '',
      '',
    ].join('\r\n');
    const result = parseRows(text, IDR);
    expect(result.rows).toEqual([
      {
        line: 2,
        title: 'Teh Kumis Kucing',
        price: 149000,
        compareAtPrice: 199000,
        imageUrl: 'https://cdn.test/a.webp',
        linkUrl: 'https://shop.test/a',
      },
      { line: 3, title: 'Paket\tHemat\nIsi 3', price: 249000 },
      { line: 6, title: 'Paket Sultan', price: 1250000 },
    ]);
    expect(result.errors).toEqual([
      { line: 4, message: 'Row 4: the title is missing' },
      { line: 5, message: 'Row 5: "abc" isn\'t a price' },
    ]);
  });

  it('parses CSV with quotes and semicolon files', () => {
    expect(parseRows('"Botol, besar",12.99,,,\nBotol kecil,"1,234.50"', USD).rows).toEqual([
      { line: 1, title: 'Botol, besar', price: 12.99 },
      { line: 2, title: 'Botol kecil', price: 1234.5 },
    ]);
    expect(parseRows('Nama;Harga\nTeh;149.000\n"Kopi ""Arabika""";15.000', IDR).rows).toEqual([
      { line: 2, title: 'Teh', price: 149000 },
      { line: 3, title: 'Kopi "Arabika"', price: 15000 },
    ]);
    expect(parseRows('Just a title', IDR).rows).toEqual([{ line: 1, title: 'Just a title' }]);
    expect(parseRows('', IDR)).toEqual({ rows: [], errors: [] });
  });

  it('rejects non-https image and link addresses and long titles per row', () => {
    const text = [
      'A\t\t\tjavascript:alert(1)',
      'B\t\t\t\tftp://shop.test',
      `${'x'.repeat(121)}`,
      'C\t\t\t/relative.png',
    ].join('\n');
    expect(parseRows(text, IDR).errors).toEqual([
      { line: 1, message: 'Row 1: the image address must start with https://' },
      { line: 2, message: 'Row 2: the link must start with https://' },
      { line: 3, message: 'Row 3: the title is longer than 120 characters' },
      { line: 4, message: 'Row 4: the image address must start with https://' },
    ]);
  });
});

describe('parsePrice', () => {
  it('parsePrice follows the currency', () => {
    const cases: [string, typeof IDR, number | null][] = [
      ['Rp149.000', IDR, 149000],
      ['149,000', IDR, 149000],
      ['1.250.000', IDR, 1250000],
      ['Rp 99.000,-', IDR, 99000],
      ['$12.99', USD, 12.99],
      ['1,234', USD, 1234],
      ['1,234.50', USD, 1234.5],
      ['12,99', USD, 12.99],
      ['12', USD, 12],
      ['Rp1.250.000,00', IDR, 1250000],
      ['Rp 1.250.000,00', IDR, 1250000],
      ['149.000 IDR', IDR, 149000],
      ['149rb', IDR, null],
      ['Rp 149 ribu', IDR, null],
      ['1jt', IDR, null],
      ['US$ 12.99', USD, 12.99],
      ['', IDR, null],
      ['abc', IDR, null],
      ['-', IDR, null],
    ];
    for (const [text, format, expected] of cases) {
      expect(parsePrice(text, format), `${text} ${format.currency}`).toBe(expected);
    }
  });
});

describe('rowsToCarouselItems', () => {
  it('rowsToCarouselItems makes valid items with fresh ids', () => {
    const items = rowsToCarouselItems(
      [
        {
          line: 1,
          title: 'Teh',
          price: 149000,
          imageUrl: 'https://cdn.test/a.webp',
          linkUrl: 'https://shop.test/a',
        },
        { line: 2, title: 'Kopi' },
      ],
      sequentialIds('n'),
    );
    expect(items.map((item) => ProductItemSchema.safeParse(item).success)).toEqual([true, true]);
    expect(items[0]).toMatchObject({
      id: 'n1',
      title: 'Teh',
      price: 149000,
      image: { src: 'https://cdn.test/a.webp', alt: 'Teh' },
      cta: { label: 'Buy now', link: { kind: 'url', url: 'https://shop.test/a', newTab: false } },
    });
    expect(items[1]).toMatchObject({
      id: 'n2',
      image: { src: '', alt: '' },
      cta: { label: 'Buy now', link: { kind: 'default' } },
    });
    expect(items[1]!.price).toBeUndefined();
  });
});

it('a one-column paste with a unit in it is reported, not read as a price', () => {
  expect(parseRows('Kopi, 250 g', IDR)).toEqual({
    rows: [],
    errors: [{ line: 1, message: 'Row 1: "250 g" isn\'t a price' }],
  });
});
