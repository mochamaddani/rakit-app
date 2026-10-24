import { z } from 'zod';
import { code, ImageSchema, SectionLinkSchema, text, UrlLinkSchema } from './primitives';
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

/** '' or a value in the vendor's format, with a message the inspector shows as is. */
const trackingId = (pattern: RegExp, message: string) =>
  z
    .string()
    .regex(new RegExp(`^(?:${pattern.source})?$`), message)
    .default('');

/** Vendor ids and owner code for the exported page only (docs/DECISIONS.md D-047). */
export const TrackingSettingsSchema = z.object({
  metaPixelId: trackingId(/\d{10,20}/, 'Meta Pixel IDs are 10–20 digits'),
  ga4Id: trackingId(/G-[A-Z0-9]{4,16}/, 'GA4 IDs look like G-XXXXXXX'),
  googleAdsId: trackingId(/AW-\d{6,16}/, 'Google Ads IDs look like AW-123456789'),
  googleAdsLeadLabel: trackingId(
    /[A-Za-z0-9_-]{4,64}/,
    'Use the label from the Google Ads conversion snippet',
  ),
  gtmId: trackingId(/GTM-[A-Z0-9]{4,12}/, 'GTM IDs look like GTM-XXXXXXX'),
  headCode: code(20_000).default(''),
  bodyCode: code(20_000).default(''),
});
export type TrackingSettings = z.output<typeof TrackingSettingsSchema>;

/** True when any vendor id is set (custom code alone doesn't count). */
export function hasTrackingIds(tracking: TrackingSettings): boolean {
  return Boolean(tracking.metaPixelId || tracking.ga4Id || tracking.googleAdsId || tracking.gtmId);
}

export const PageSettingsSchema = z.object({
  lang: z.enum(LANGS).default('id'),
  seo: z
    .object({
      title: text(120).default(''),
      description: text(300).default(''),
      // Ad landing pages stay out of search results unless the owner opts in.
      noindex: z.boolean().default(true),
      /** og:image; crawlers need an absolute http(s) URL, so it is never inlined. */
      ogImage: ImageSchema.optional(),
      favicon: ImageSchema.optional(),
    })
    .prefault({}),
  theme: ThemeSchema.prefault(DEFAULT_THEME),
  price: PriceFormatSchema.prefault(PRICE_FORMATS.IDR),
  /** Target of every `{ kind: 'default' }` link, usually the order-form section. */
  defaultCta: z.discriminatedUnion('kind', [UrlLinkSchema, SectionLinkSchema]).optional(),
  tracking: TrackingSettingsSchema.prefault({}),
});
export type PageSettings = z.output<typeof PageSettingsSchema>;
