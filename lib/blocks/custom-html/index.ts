import { defineBlock } from '../types';
import { renderCustomHtml } from './render';
import { CustomHtmlPropsSchema } from './schema';
import { asset as css } from './styles.generated';

export const customHtml = defineBlock({
  type: 'custom-html',
  category: 'utility',
  label: 'Custom HTML',
  description:
    'Your own HTML for anything else; cleaned of scripts unless you turn on running them in the exported page.',
  icon: 'code-xml',
  schema: CustomHtmlPropsSchema,
  defaultProps: () => CustomHtmlPropsSchema.parse({}),
  css,
  render: renderCustomHtml,
});
