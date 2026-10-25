import { parseVideoUrl } from '@/lib/renderer/video';
import { defineBlock } from '../types';
import { renderVideoBlock } from './render';
import { VideoPropsSchema } from './schema';
import { asset as script } from './snippet.generated';
import { asset as css } from './styles.generated';

/** Shared with Hero, which shows a video as its media (collectJs ships it once). */
export const videoSnippet = script;

export const video = defineBlock({
  type: 'video',
  category: 'content',
  label: 'Video',
  description:
    'A YouTube or Vimeo video behind a lightweight poster; the player loads only when tapped.',
  icon: 'circle-play',
  schema: VideoPropsSchema,
  defaultProps: () => VideoPropsSchema.parse({}),
  css,
  snippet: {
    asset: script,
    isNeeded: (props) => parseVideoUrl(props.video.url) !== null,
    exportOnly: true,
  },
  render: renderVideoBlock,
});
