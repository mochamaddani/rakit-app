import { defineBlock } from '../types';
import { renderStickyCta } from './render';
import { StickyCtaPropsSchema } from './schema';
import { asset as script } from './snippet.generated';
import { asset as css } from './styles.generated';

export const stickyCta = defineBlock({
  type: 'sticky-cta',
  category: 'conversion',
  label: 'Sticky CTA bar',
  description:
    'A button bar fixed to the bottom of the screen on phones, shown once the visitor scrolls past the top.',
  icon: 'panel-bottom',
  schema: StickyCtaPropsSchema,
  defaultProps: () =>
    StickyCtaPropsSchema.parse({ cta: { label: 'Order now', link: { kind: 'default' } } }),
  css,
  snippet: { asset: script },
  render: renderStickyCta,
});
