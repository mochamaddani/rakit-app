import { defineBlock } from '../types';
import { renderTestimonials } from './render';
import { TestimonialsPropsSchema } from './schema';
import { asset as css } from './styles.generated';

export const testimonials = defineBlock({
  type: 'testimonials',
  category: 'conversion',
  label: 'Testimonials',
  description:
    'Customer quotes with name, optional detail, avatar and star rating. Only use real quotes.',
  icon: 'quote',
  schema: TestimonialsPropsSchema,
  // Placeholders, never invented social proof (PRD §6.11 copy guardrails).
  defaultProps: (newId) =>
    TestimonialsPropsSchema.parse({
      heading: 'What customers say',
      items: [
        {
          id: newId(),
          quote: '[REPLACE: a real customer quote]',
          name: '[REPLACE: customer name]',
        },
        {
          id: newId(),
          quote: '[REPLACE: a real customer quote]',
          name: '[REPLACE: customer name]',
        },
      ],
    }),
  css,
  render: renderTestimonials,
});
