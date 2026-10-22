import { defineBlock } from '../types';
import { renderBenefits } from './render';
import { BenefitsPropsSchema } from './schema';
import { asset as css } from './styles.generated';

export const benefits = defineBlock({
  type: 'benefits',
  category: 'content',
  label: 'Benefits',
  description:
    'Grid of benefits or features, each with an optional icon, a short title and one line of text.',
  icon: 'list-checks',
  schema: BenefitsPropsSchema,
  defaultProps: (newId) =>
    BenefitsPropsSchema.parse({
      heading: 'Why choose us',
      items: [
        {
          id: newId(),
          icon: 'check',
          title: 'Benefit one',
          text: 'Say what it does for the buyer.',
        },
        { id: newId(), icon: 'truck', title: 'Benefit two', text: 'Keep it to one short line.' },
        { id: newId(), icon: 'shield', title: 'Benefit three', text: 'Facts beat adjectives.' },
      ],
    }),
  css,
  render: renderBenefits,
});
