import { z } from 'zod';
import { IdSchema } from '@/lib/schema/ids';
import { rich, text } from '@/lib/schema/primitives';

export const FaqItemSchema = z.object({
  id: IdSchema,
  question: text(200, 1),
  answer: rich(1200, 1),
});

export const FaqPropsSchema = z.object({
  heading: rich(160).default(''),
  items: z.array(FaqItemSchema).max(30).default([]),
  openFirst: z.boolean().default(false),
  /** Opening one item closes the others (native `<details name>` group). */
  exclusive: z.boolean().default(false),
});
export type FaqProps = z.output<typeof FaqPropsSchema>;
