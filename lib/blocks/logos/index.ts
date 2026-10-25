import { defineBlock } from '../types';
import { renderLogos } from './render';
import { LogosPropsSchema } from './schema';
import { asset as css } from './styles.generated';

export const logos = defineBlock({
  type: 'logos',
  category: 'content',
  label: 'Logos strip',
  description:
    'A row of partner, media or marketplace logos; use only logos you have the right to show.',
  icon: 'award',
  schema: LogosPropsSchema,
  // Placeholders only: a default must never claim a brand the owner hasn't named.
  defaultProps: (newId) =>
    LogosPropsSchema.parse({
      heading: '[REPLACE: As seen in]',
      items: [1, 2, 3, 4].map(() => ({
        id: newId(),
        image: { src: '', alt: '[REPLACE: brand name]' },
      })),
    }),
  css,
  render: renderLogos,
});
