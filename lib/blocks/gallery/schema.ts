import { z } from 'zod';
import { IdSchema } from '@/lib/schema/ids';
import { AspectRatioSchema, ImageSchema, rich, text } from '@/lib/schema/primitives';

export const GalleryPropsSchema = z.object({
  heading: rich(160).default(''),
  subheading: rich(300).default(''),
  items: z
    .array(
      z.object({ id: IdSchema, image: ImageSchema.prefault({}), caption: text(160).default('') }),
    )
    .max(24)
    .default([]),
  columns: z
    .object({
      mobile: z.union([z.literal(1), z.literal(2)]).default(2),
      desktop: z.union([z.literal(2), z.literal(3), z.literal(4)]).default(3),
    })
    .prefault({}),
  aspectRatio: AspectRatioSchema.default('1:1'),
  imageFit: z.enum(['cover', 'contain']).default('cover'),
});
export type GalleryProps = z.output<typeof GalleryPropsSchema>;
