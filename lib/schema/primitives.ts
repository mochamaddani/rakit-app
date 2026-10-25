import { z } from 'zod';
import { IdSchema } from './ids';

// Every user-visible string goes through one of these helpers. The `control` metadata tells the
// inspector (M2), the AI catalog (M5) and the registry-wide safety tests which strings are user text.

/** Plain text: always escaped, never interpreted. */
export function text(max: number, min = 0) {
  return z.string().min(min).max(max).meta({ control: 'text' });
}

/** Inline markup (docs/DECISIONS.md D-009): **bold**, *italic*, ==highlight==, [label](url). */
export function rich(max: number, min = 0) {
  return z.string().min(min).max(max).meta({ control: 'rich' });
}

/** Raw code the owner pastes (custom snippets, form embeds). Emitted verbatim in export only. */
export function code(max: number) {
  return z.string().max(max).meta({ control: 'code' });
}

/** Inspector-only metadata: show a field while sibling `key` has one of the values in `in`. */
export interface ShowWhen {
  key: string;
  in: readonly (string | boolean)[];
}

/** Shows the field in the inspector only while sibling `key` has one of `values` (inspector-only metadata). */
export function when<T extends z.ZodType>(
  schema: T,
  key: string,
  values: readonly (string | boolean)[],
): T {
  return schema.meta({ ...schema.meta(), showWhen: { key, in: values } }) as T;
}

const WALL_CLOCK = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/;

export interface WallClock {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
}

const daysInMonth = (year: number, month: number) =>
  month === 2
    ? year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0)
      ? 29
      : 28
    : [4, 6, 9, 11].includes(month)
      ? 30
      : 31;

/** 'YYYY-MM-DDTHH:MM' as numbers; null for anything else or an impossible date. No Date (D-011). */
export function parseWallClock(value: string): WallClock | null {
  const match = WALL_CLOCK.exec(value);
  if (!match) return null;
  const [year, month, day, hour, minute] = match.slice(1).map(Number) as [
    number,
    number,
    number,
    number,
    number,
  ];
  if (month < 1 || month > 12 || day < 1 || day > daysInMonth(year, month)) return null;
  if (hour > 23 || minute > 59) return null;
  return { year, month, day, hour, minute };
}

/** 'YYYY-MM-DDTHH:MM' wall-clock time, '' for unset; rejects impossible dates. Inspector: datetime-local. */
export function datetime() {
  return z
    .string()
    .refine((value) => value === '' || parseWallClock(value) !== null, {
      message: 'Enter a real date and time',
    })
    .meta({ control: 'datetime' });
}

/** Indonesian time zones plus UTC, for deadlines (WIB, WITA, WIT). */
export const UTC_OFFSETS = ['+07:00', '+08:00', '+09:00', '+00:00'] as const;

export const HexColorSchema = z
  .string()
  .regex(/^#[0-9A-Fa-f]{6}$/)
  .meta({ control: 'color' });

export const UrlLinkSchema = z.object({
  kind: z.literal('url'),
  url: z.string().max(2048),
  newTab: z.boolean().default(false),
});
export const SectionLinkSchema = z.object({ kind: z.literal('section'), sectionId: IdSchema });
/** Resolves to the page's default CTA target (settings.defaultCta). */
export const DefaultLinkSchema = z.object({ kind: z.literal('default') });
export const LinkSchema = z.discriminatedUnion('kind', [
  UrlLinkSchema,
  SectionLinkSchema,
  DefaultLinkSchema,
]);
export type Link = z.output<typeof LinkSchema>;

/** An empty src renders a placeholder. */
export const ImageSchema = z
  .object({
    src: z.string().max(8_000_000).default(''),
    alt: text(300).default(''),
    width: z.number().int().positive().optional(),
    height: z.number().int().positive().optional(),
    assetId: z.string().optional(),
  })
  .meta({ control: 'image' });
export type Image = z.output<typeof ImageSchema>;

/** A YouTube or Vimeo video shown behind a click-to-play facade (docs/DECISIONS.md D-052). */
export const VideoSchema = z.object({
  url: z.string().max(2048).default(''),
  /** The player's accessible name; '' uses "Video" in the page language. */
  title: text(120).default(''),
  /** Overrides the YouTube thumbnail; Vimeo videos need one to show a picture. */
  poster: ImageSchema.prefault({}),
  ratio: z.enum(['16:9', '9:16', '1:1', '4:5']).default('16:9'),
});
export type Video = z.output<typeof VideoSchema>;

/** Tracking event a CTA click fires in the exported page (docs/DECISIONS.md D-019). */
export const CTA_EVENTS = ['none', 'Lead', 'Contact', 'InitiateCheckout'] as const;
export type CtaEvent = (typeof CTA_EVENTS)[number];

export const CtaSchema = z.object({
  label: text(80, 1),
  link: LinkSchema,
  variant: z.enum(['primary', 'secondary']).default('primary'),
  event: z.enum(CTA_EVENTS).default('none'),
});
export type Cta = z.output<typeof CtaSchema>;

export const ICON_NAMES = [
  'check',
  'star',
  'shield',
  'truck',
  'clock',
  'heart',
  'leaf',
  'sparkles',
  'gift',
  'lock',
  'chat',
  'phone',
  'refresh',
  'tag',
  'thumbs-up',
  'bolt',
] as const;
export const IconNameSchema = z.enum(ICON_NAMES);
export type IconName = z.output<typeof IconNameSchema>;

export const AspectRatioSchema = z.enum(['1:1', '4:5', '16:9']);
export type AspectRatio = z.output<typeof AspectRatioSchema>;
/** CSS `aspect-ratio` values. */
export const ASPECT_RATIOS = {
  '1:1': '1/1',
  '4:5': '4/5',
  '16:9': '16/9',
} as const satisfies Record<AspectRatio, string>;

export const BlockStyleSchema = z.object({
  align: z.enum(['left', 'center']).optional(),
  hideOn: z.enum(['none', 'mobile', 'desktop']).default('none'),
  spaceAbove: z.enum(['none', 'sm', 'md', 'lg']).default('none'),
});
export type BlockStyle = z.output<typeof BlockStyleSchema>;

/** Tones map to theme color pairs so contrast stays checkable (docs/DECISIONS.md D-015). */
export const SectionStyleSchema = z.object({
  tone: z.enum(['base', 'muted', 'primary', 'dark']).default('base'),
  padY: z.enum(['none', 'sm', 'md', 'lg']).default('md'),
  width: z.enum(['narrow', 'normal', 'wide', 'full']).default('normal'),
});
export type SectionStyle = z.output<typeof SectionStyleSchema>;
