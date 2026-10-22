import { defineBlock } from '../../types';
import { renderProductCarousel } from './render';
import { ProductCarouselPropsSchema } from './schema';
import { asset as css } from './styles.generated';

export const productCarousel = defineBlock({
  type: 'product-carousel',
  category: 'special',
  label: 'Product Carousel',
  description:
    'Horizontally swipeable product cards with prices, badges, ratings and per-item CTAs; works without JavaScript.',
  icon: 'gallery-horizontal',
  schema: ProductCarouselPropsSchema,
  defaultProps: (newId) =>
    ProductCarouselPropsSchema.parse({
      heading: 'Choose yours',
      items: [1, 2, 3].map((n) => ({
        id: newId(),
        title: `Product ${n}`,
        cta: { label: 'Buy now', link: { kind: 'default' } },
      })),
    }),
  css,
  render: renderProductCarousel,
});
