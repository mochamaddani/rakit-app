import { z } from 'zod';
import { code, text } from '@/lib/schema/primitives';

export const CustomHtmlPropsSchema = z.object({
  /** The owner's own markup. Sanitized in export unless runScripts is on (D-053). */
  html: code(50_000).default('<p>Your HTML here</p>'),
  runScripts: z.boolean().default(false),
  /** Names the block in the checklist and titles its canvas frame. */
  blockName: text(80).default(''),
});
export type CustomHtmlProps = z.output<typeof CustomHtmlPropsSchema>;
