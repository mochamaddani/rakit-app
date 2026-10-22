import { z } from 'zod';
import { IdSchema } from '@/lib/schema/ids';
import { ImageSchema, rich, text } from '@/lib/schema/primitives';

export const TestimonialItemSchema = z.object({
  id: IdSchema,
  quote: rich(600, 1),
  name: text(80, 1),
  /** City, role or product bought. */
  detail: text(80).default(''),
  avatar: ImageSchema.optional(),
  rating: z.number().min(0).max(5).optional(),
});

export const TestimonialsPropsSchema = z.object({
  heading: rich(160).default(''),
  items: z.array(TestimonialItemSchema).max(12).default([]),
  layout: z.enum(['grid', 'stack']).default('grid'),
});
export type TestimonialsProps = z.output<typeof TestimonialsPropsSchema>;
