import { z } from 'zod';
import { IdSchema } from '@/lib/schema/ids';
import { IconNameSchema, rich, text } from '@/lib/schema/primitives';

export const BenefitItemSchema = z.object({
  id: IdSchema,
  icon: z.union([IconNameSchema, z.literal('none')]).default('check'),
  title: text(80, 1),
  text: rich(300).default(''),
});

export const BenefitsPropsSchema = z.object({
  heading: rich(160).default(''),
  subheading: rich(300).default(''),
  items: z.array(BenefitItemSchema).max(12).default([]),
  /** Columns on desktop; mobile shows 1, tablet 2. */
  columns: z.union([z.literal(2), z.literal(3), z.literal(4)]).default(3),
  variant: z.enum(['cards', 'plain']).default('cards'),
});
export type BenefitsProps = z.output<typeof BenefitsPropsSchema>;
