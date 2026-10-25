import { z } from 'zod';
import { IdSchema } from '@/lib/schema/ids';
import {
  AspectRatioSchema,
  ImageSchema,
  LinkSchema,
  rich,
  text,
  when,
} from '@/lib/schema/primitives';

export const ProductItemSchema = z.object({
  id: IdSchema,
  image: ImageSchema.prefault({}),
  title: text(120, 1),
  description: rich(300).default(''),
  price: z.number().min(0).max(1e12).optional(),
  compareAtPrice: z.number().min(0).max(1e12).optional(),
  badge: text(30).default(''),
  /** Adds an automatic "-NN%" badge when compareAtPrice is higher than price. */
  showDiscount: z.boolean().default(false),
  rating: z.number().min(0).max(5).optional(),
  reviewCount: z.number().int().min(0).optional(),
  cta: z
    .object({
      label: text(40).default(''),
      link: LinkSchema.prefault({ kind: 'default' }),
    })
    .prefault({}),
});
export type ProductItem = z.output<typeof ProductItemSchema>;

export const ProductCarouselPropsSchema = z.object({
  heading: rich(160).default(''),
  subheading: rich(300).default(''),
  items: z.array(ProductItemSchema).max(50).default([]),
  /** Mobile defaults to 1.3 so the next card peeks in and hints at swiping (PRD §6.4.1). */
  slidesPerView: z
    .object({
      mobile: z.number().min(1).max(2).default(1.3),
      tablet: z.number().min(1).max(4).default(2.5),
      desktop: z.number().min(1).max(6).default(4),
    })
    .prefault({}),
  gap: z.enum(['sm', 'md', 'lg']).default('md'),
  aspectRatio: AspectRatioSchema.default('1:1'),
  imageFit: z.enum(['cover', 'contain']).default('cover'),
  navigation: z.enum(['arrows', 'dots', 'both', 'none']).default('both'),
  arrowsOnTouch: z.boolean().default(false),
  loop: z.boolean().default(false),
  /** Exported pages only; never with reduced motion; stops once the visitor takes over (D-054). */
  autoplay: z.boolean().default(false),
  autoplaySeconds: when(z.number().min(2).max(15).default(5), 'autoplay', [true]),
  /** Fired by each card's button, with the item as parameters (D-019). */
  event: z.enum(['ViewContent', 'AddToCart', 'none']).default('ViewContent'),
  /** Product/ItemList structured data in exported pages; off for ad pages by default. */
  jsonLd: z.boolean().default(false),
});
export type ProductCarouselProps = z.output<typeof ProductCarouselPropsSchema>;
