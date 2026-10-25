import { z } from 'zod';
import { CtaSchema, ImageSchema, rich, text, VideoSchema } from '@/lib/schema/primitives';

export const HeroPropsSchema = z.object({
  eyebrow: text(80).default(''),
  headline: rich(200, 1),
  subheadline: rich(400).default(''),
  primaryCta: CtaSchema.optional(),
  secondaryCta: CtaSchema.optional(),
  trustLine: text(160).default(''),
  image: ImageSchema.optional(),
  /** Shown instead of the image, which then becomes the video's poster (D-052). */
  video: VideoSchema.optional(),
  layout: z.enum(['stacked', 'split']).default('stacked'),
  align: z.enum(['left', 'center']).default('center'),
});
export type HeroProps = z.output<typeof HeroPropsSchema>;
