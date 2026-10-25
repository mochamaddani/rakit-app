import { z } from 'zod';
import { IdSchema } from '@/lib/schema/ids';
import { CtaSchema, rich, text } from '@/lib/schema/primitives';

export const OfferSchema = z.object({
  id: IdSchema,
  name: text(80, 1),
  description: rich(300).default(''),
  price: z.number().min(0).max(1e12).optional(),
  compareAtPrice: z.number().min(0).max(1e12).optional(),
  showDiscount: z.boolean().default(false),
  badge: text(30).default(''),
  highlighted: z.boolean().default(false),
  features: z
    .array(z.object({ id: IdSchema, text: text(160, 1) }))
    .max(12)
    .default([]),
  cta: CtaSchema.optional(),
});
export type Offer = z.output<typeof OfferSchema>;

export const PricingPropsSchema = z.object({
  heading: rich(160).default(''),
  subheading: rich(300).default(''),
  offers: z.array(OfferSchema).min(1).max(4),
  /** A line under the offers, e.g. "Free shipping across Indonesia". */
  note: text(200).default(''),
});
export type PricingProps = z.output<typeof PricingPropsSchema>;
