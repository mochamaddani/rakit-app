import { defineBlock } from '../types';
import { renderFaq } from './render';
import { FaqPropsSchema } from './schema';
import { asset as css } from './styles.generated';

export const faq = defineBlock({
  type: 'faq',
  category: 'content',
  label: 'FAQ',
  description:
    'Accordion of frequently asked questions with short answers; native, works without JavaScript.',
  icon: 'circle-help',
  schema: FaqPropsSchema,
  defaultProps: (newId) =>
    FaqPropsSchema.parse({
      heading: 'Frequently asked questions',
      items: [
        { id: newId(), question: 'A question buyers ask?', answer: 'A short, honest answer.' },
        { id: newId(), question: 'A question buyers ask?', answer: 'A short, honest answer.' },
      ],
    }),
  css,
  render: renderFaq,
});
