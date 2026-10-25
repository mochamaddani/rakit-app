import { defineBlock } from '../types';
import { renderCookieBanner } from './render';
import { CookieBannerPropsSchema } from './schema';
import { asset as script } from './snippet.generated';
import { asset as css } from './styles.generated';

export const cookieBanner = defineBlock({
  type: 'cookie-banner',
  category: 'utility',
  label: 'Cookie banner',
  description:
    'A small cookie notice with a dismiss button; a notice only, it does not block tracking.',
  icon: 'cookie',
  schema: CookieBannerPropsSchema,
  defaultProps: () => CookieBannerPropsSchema.parse({}),
  css,
  snippet: { asset: script },
  render: renderCookieBanner,
});
