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

export const CtaSchema = z.object({
  label: text(80, 1),
  link: LinkSchema,
  variant: z.enum(['primary', 'secondary']).default('primary'),
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
