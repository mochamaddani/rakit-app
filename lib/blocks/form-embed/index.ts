import { defineBlock } from '../types';
import { detectFormProvider } from './providers';
import { renderFormEmbed } from './render';
import { FormEmbedPropsSchema } from './schema';
import { asset as script } from './snippet.generated';
import { asset as css } from './styles.generated';

export const formEmbed = defineBlock({
  type: 'form-embed',
  category: 'conversion',
  label: 'Checkout Form',
  description:
    'A checkout or order form from your provider (pasted embed code such as Storelink, or an iframe) that fires Lead on submit where the provider reports it.',
  icon: 'clipboard-list',
  schema: FormEmbedPropsSchema,
  defaultProps: () => FormEmbedPropsSchema.parse({ heading: 'Order here' }),
  css,
  // Only providers that post a submit message need it; Storelink sends its own events.
  snippet: {
    asset: script,
    isNeeded: (props) => detectFormProvider(props)?.conversions === 'message',
    exportOnly: true,
  },
  render: renderFormEmbed,
});
