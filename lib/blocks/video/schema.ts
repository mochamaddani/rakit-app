import { z } from 'zod';
import { rich, text, VideoSchema } from '@/lib/schema/primitives';

export const VideoPropsSchema = z.object({
  heading: rich(160).default(''),
  video: VideoSchema.prefault({}),
  caption: text(200).default(''),
});
export type VideoProps = z.output<typeof VideoPropsSchema>;
