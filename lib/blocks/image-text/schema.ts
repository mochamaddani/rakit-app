import { z } from 'zod';
import { IdSchema } from '@/lib/schema/ids';
import { AspectRatioSchema, CtaSchema, ImageSchema, rich, text } from '@/lib/schema/primitives';

export const ImageTextPropsSchema = z.object({
  eyebrow: text(80).default(''),
  heading: rich(200, 1),
  body: rich(2000).default(''),
  points: z
    .array(z.object({ id: IdSchema, text: text(160, 1) }))
    .max(8)
    .default([]),
  cta: CtaSchema.optional(),
  image: ImageSchema.prefault({}),
  imageSide: z.enum(['left', 'right']).default('left'),
  aspectRatio: AspectRatioSchema.default('4:5'),
});
export type ImageTextProps = z.output<typeof ImageTextPropsSchema>;
