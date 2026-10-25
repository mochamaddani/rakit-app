import { defineBlock } from '../types';
import { renderPricing } from './render';
import { PricingPropsSchema } from './schema';
import { asset as css } from './styles.generated';

export const pricing = defineBlock({
  type: 'pricing',
  category: 'conversion',
  label: 'Pricing / offer',
  description:
    'One to four offer cards with price, compare-at price, discount, what is included and a button.',
  icon: 'badge-percent',
  schema: PricingPropsSchema,
  // No invented package or price: the owner fills them in.
  defaultProps: (newId) =>
    PricingPropsSchema.parse({
      offers: [
        {
          id: newId(),
          name: '[REPLACE: package name]',
          features: [1, 2, 3].map(() => ({ id: newId(), text: "[REPLACE: what's included]" })),
          cta: { label: 'Order now', link: { kind: 'default' } },
        },
      ],
    }),
  css,
  render: renderPricing,
});
