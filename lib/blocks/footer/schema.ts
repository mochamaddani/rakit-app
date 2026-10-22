import { z } from 'zod';
import { IdSchema } from '@/lib/schema/ids';
import { LinkSchema, rich, text } from '@/lib/schema/primitives';

export const FooterLinkSchema = z.object({
  id: IdSchema,
  label: text(60, 1),
  link: LinkSchema,
});

export const FooterPropsSchema = z.object({
  brand: text(80).default(''),
  links: z.array(FooterLinkSchema).max(8).default([]),
  disclaimer: rich(1200).default(''),
  copyright: text(120).default(''),
});
export type FooterProps = z.output<typeof FooterPropsSchema>;
