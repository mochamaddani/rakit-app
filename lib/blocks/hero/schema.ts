import { z } from 'zod';
import { CtaSchema, ImageSchema, rich, text } from '@/lib/schema/primitives';

export const HeroPropsSchema = z.object({
  eyebrow: text(80).default(''),
  headline: rich(200, 1),
  subheadline: rich(400).default(''),
  primaryCta: CtaSchema.optional(),
  secondaryCta: CtaSchema.optional(),
  trustLine: text(160).default(''),
  image: ImageSchema.optional(),
  layout: z.enum(['stacked', 'split']).default('stacked'),
  align: z.enum(['left', 'center']).default('center'),
});
export type HeroProps = z.output<typeof HeroPropsSchema>;
