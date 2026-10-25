import { z } from 'zod';
import { code, rich, text, when } from '@/lib/schema/primitives';

export const FormEmbedPropsSchema = z.object({
  heading: rich(160).default(''),
  subheading: rich(300).default(''),
  /** Pasted embed code (Storelink, most providers) or a form page shown in an iframe. */
  mode: z.enum(['snippet', 'iframe']).default('snippet'),
  url: when(z.string().max(2048).default(''), 'mode', ['iframe']),
  height: when(z.number().int().min(200).max(4000).default(640), 'mode', ['iframe']),
  /** The iframe's accessible name; empty uses "Order form" in the page language. */
  title: when(text(120).default(''), 'mode', ['iframe']),
  code: when(code(20_000).default(''), 'mode', ['snippet']),
  /** Where to go after a detected submit (providers that report submits only). */
  thankYouUrl: z.string().max(2048).default(''),
});
export type FormEmbedProps = z.output<typeof FormEmbedPropsSchema>;
