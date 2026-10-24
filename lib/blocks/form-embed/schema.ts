import { z } from 'zod';
import { code, rich, text } from '@/lib/schema/primitives';

export const FormEmbedPropsSchema = z.object({
  heading: rich(160).default(''),
  subheading: rich(300).default(''),
  /** Pasted embed code (Storelink, most providers) or a form page shown in an iframe. */
  mode: z.enum(['snippet', 'iframe']).default('snippet'),
  url: z.string().max(2048).default(''),
  height: z.number().int().min(200).max(4000).default(640),
  /** The iframe's accessible name; empty uses "Order form" in the page language. */
  title: text(120).default(''),
  code: code(20_000).default(''),
  /** Where to go after a detected submit (providers that report submits only). */
  thankYouUrl: z.string().max(2048).default(''),
});
export type FormEmbedProps = z.output<typeof FormEmbedPropsSchema>;
