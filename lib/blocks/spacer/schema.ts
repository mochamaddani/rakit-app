import { z } from 'zod';
import { when } from '@/lib/schema/primitives';

export const SpacerPropsSchema = z.object({
  /** 16 / 32 / 64 / 96 px. */
  size: z.enum(['sm', 'md', 'lg', 'xl']).default('md'),
  line: z.boolean().default(false),
  lineWidth: when(z.enum(['short', 'full']).default('full'), 'line', [true]),
});
export type SpacerProps = z.output<typeof SpacerPropsSchema>;
