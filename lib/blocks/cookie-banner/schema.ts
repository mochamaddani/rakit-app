import { z } from 'zod';
import { LinkSchema, rich, text } from '@/lib/schema/primitives';

export const CookieBannerPropsSchema = z.object({
  /** '' uses the default notice in the page language. */
  message: rich(400).default(''),
  /** '' uses "Oke" / "OK". */
  buttonLabel: text(40).default(''),
  privacyLink: LinkSchema.optional(),
});
export type CookieBannerProps = z.output<typeof CookieBannerPropsSchema>;
