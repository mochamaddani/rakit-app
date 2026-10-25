import { z } from 'zod';
import { IdSchema } from '@/lib/schema/ids';
import { ImageSchema, text } from '@/lib/schema/primitives';

export const LogosPropsSchema = z.object({
  heading: text(120).default(''),
  items: z
    .array(z.object({ id: IdSchema, image: ImageSchema.prefault({}) }))
    .max(24)
    .default([]),
  /** Logo height: 24 / 32 / 48 px. */
  height: z.enum(['sm', 'md', 'lg']).default('md'),
  grayscale: z.boolean().default(true),
});
export type LogosProps = z.output<typeof LogosPropsSchema>;
