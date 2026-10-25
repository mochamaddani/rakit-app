import { defineBlock } from '../types';
import { renderImageText } from './render';
import { ImageTextPropsSchema } from './schema';
import { asset as css } from './styles.generated';

export const imageText = defineBlock({
  type: 'image-text',
  category: 'content',
  label: 'Image + text',
  description:
    'An image beside a heading, body text, check-marked points and an optional button; stacks on phones.',
  icon: 'panels-top-left',
  schema: ImageTextPropsSchema,
  defaultProps: (newId) =>
    ImageTextPropsSchema.parse({
      heading: 'Why it works',
      body: '[REPLACE: explain the benefit in two or three sentences]',
      points: [1, 2, 3].map(() => ({ id: newId(), text: '[REPLACE: point]' })),
    }),
  css,
  render: renderImageText,
});
