import { z } from 'zod';
import { CtaSchema, text } from '@/lib/schema/primitives';

export const StickyCtaPropsSchema = z.object({
  text: text(80).default(''),
  cta: CtaSchema,
  showOn: z.enum(['mobile', 'all']).default('mobile'),
  reveal: z.enum(['always', 'afterFirstSection']).default('afterFirstSection'),
});
export type StickyCtaProps = z.output<typeof StickyCtaPropsSchema>;
