import { expect, it } from 'vitest';
import { HeroPropsSchema } from '@/lib/blocks/hero/schema';
import { ProductCarouselPropsSchema } from '@/lib/blocks/special/product-carousel/schema';
import { ImageSchema } from '@/lib/schema/primitives';
import { schemaAt } from './schema-path';

it('resolves fields through objects, arrays, wrappers and kind unions', () => {
  expect(schemaAt(HeroPropsSchema, ['headline'], {})!.safeParse('').success).toBe(false);
  expect(
    (schemaAt(HeroPropsSchema, ['image'], {}) as unknown as { unwrap(): unknown }).unwrap(),
  ).toBe(ImageSchema);
  const current = { items: [{ cta: { label: '', link: { kind: 'url', url: '' } } }] };
  const url = schemaAt(ProductCarouselPropsSchema, ['items', 0, 'cta', 'link', 'url'], current)!;
  expect(url.safeParse('https://x.test').success).toBe(true);
  expect(schemaAt(ProductCarouselPropsSchema, ['items', 0, 'nope'], current)).toBeNull();
  expect(
    schemaAt(ProductCarouselPropsSchema, ['slidesPerView', 'mobile'], {})!.parse(undefined),
  ).toBe(1.3);
});
