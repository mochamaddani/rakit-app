import { parseVideoUrl } from '@/lib/renderer/video';
import { defineBlock } from '../types';
import { asset as videoSnippet } from '../video/snippet.generated';
import { renderHero } from './render';
import { HeroPropsSchema } from './schema';
import { asset as css } from './styles.generated';

export const hero = defineBlock({
  type: 'hero',
  category: 'content',
  label: 'Hero',
  description:
    'Top-of-page headline with optional eyebrow, subheadline, up to two CTAs, trust line and image.',
  icon: 'layout-template',
  schema: HeroPropsSchema,
  defaultProps: () =>
    HeroPropsSchema.parse({
      headline: 'Your main promise in **one line**',
      subheadline: 'Say who it is for and what changes for them.',
      primaryCta: { label: 'Order now', link: { kind: 'default' } },
      image: { src: '', alt: '' },
    }),
  css,
  // The Video block's facade script; collectJs ships a shared asset once.
  snippet: {
    asset: videoSnippet,
    isNeeded: (props) => !!props.video && parseVideoUrl(props.video.url) !== null,
    exportOnly: true,
  },
  render: renderHero,
});
