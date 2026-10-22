import { defineBlock } from '../types';
import { renderFooter } from './render';
import { FooterPropsSchema } from './schema';
import { asset as css } from './styles.generated';

export const footer = defineBlock({
  type: 'footer',
  category: 'content',
  label: 'Footer',
  description:
    'Page footer with brand, Privacy Policy / Terms / Contact links, disclaimer and copyright line.',
  icon: 'panel-bottom',
  schema: FooterPropsSchema,
  // Ad platforms review these links (PRD §6.9).
  defaultProps: (newId) =>
    FooterPropsSchema.parse({
      links: [
        { id: newId(), label: 'Privacy Policy', link: { kind: 'url', url: '' } },
        { id: newId(), label: 'Terms', link: { kind: 'url', url: '' } },
        { id: newId(), label: 'Contact', link: { kind: 'url', url: '' } },
      ],
    }),
  css,
  landmark: 'footer',
  render: renderFooter,
});
