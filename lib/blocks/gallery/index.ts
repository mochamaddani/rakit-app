import { defineBlock } from '../types';
import { renderGallery } from './render';
import { GalleryPropsSchema } from './schema';
import { asset as css } from './styles.generated';

export const gallery = defineBlock({
  type: 'gallery',
  category: 'content',
  label: 'Gallery',
  description: 'A grid of product photos with optional captions, two per row on phones.',
  icon: 'images',
  schema: GalleryPropsSchema,
  defaultProps: (newId) =>
    GalleryPropsSchema.parse({
      heading: 'See it up close',
      items: [1, 2, 3].map(() => ({ id: newId() })),
    }),
  css,
  render: renderGallery,
});
