import { z } from 'zod';
import { SectionLinkSchema, text, UrlLinkSchema } from './primitives';
import { DEFAULT_THEME, ThemeSchema } from './theme';

export const LANGS = ['id', 'en'] as const;
export type Lang = (typeof LANGS)[number];

/** Deterministic price formatting; Intl output differs between ICU builds (docs/DECISIONS.md D-011). */
export const PriceFormatSchema = z.object({
  currency: z.string().regex(/^[A-Z]{3}$/),
  prefix: text(8),
  suffix: text(8),
  thousandsSep: z.enum(['.', ',', ' ', '']),
  decimalSep: z.enum(['.', ',']),
  decimals: z.union([z.literal(0), z.literal(2)]),
});
export type PriceFormat = z.output<typeof PriceFormatSchema>;

export const PRICE_FORMATS: Record<'IDR' | 'USD' | 'MYR' | 'SGD' | 'PHP', PriceFormat> = {
  IDR: {
    currency: 'IDR',
    prefix: 'Rp',
    suffix: '',
    thousandsSep: '.',
    decimalSep: ',',
    decimals: 0,
  },
  USD: {
    currency: 'USD',
    prefix: '$',
    suffix: '',
    thousandsSep: ',',
    decimalSep: '.',
    decimals: 2,
  },
  MYR: {
    currency: 'MYR',
    prefix: 'RM',
    suffix: '',
    thousandsSep: ',',
    decimalSep: '.',
    decimals: 2,
  },
  SGD: {
    currency: 'SGD',
    prefix: 'S$',
    suffix: '',
    thousandsSep: ',',
    decimalSep: '.',
    decimals: 2,
  },
  PHP: {
    currency: 'PHP',
    prefix: '₱',
    suffix: '',
    thousandsSep: ',',
    decimalSep: '.',
    decimals: 2,
  },
};

export const PageSettingsSchema = z.object({
  lang: z.enum(LANGS).default('id'),
  seo: z
    .object({
      title: text(120).default(''),
      description: text(300).default(''),
      // Ad landing pages stay out of search results unless the owner opts in.
      noindex: z.boolean().default(true),
    })
    .prefault({}),
  theme: ThemeSchema.prefault(DEFAULT_THEME),
  price: PriceFormatSchema.prefault(PRICE_FORMATS.IDR),
  /** Target of every `{ kind: 'default' }` link, usually the order-form section. */
  defaultCta: z.discriminatedUnion('kind', [UrlLinkSchema, SectionLinkSchema]).optional(),
});
export type PageSettings = z.output<typeof PageSettingsSchema>;
