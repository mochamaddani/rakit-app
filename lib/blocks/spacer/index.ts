import { defineBlock } from '../types';
import { renderSpacer } from './render';
import { SpacerPropsSchema } from './schema';
import { asset as css } from './styles.generated';

export const spacer = defineBlock({
  type: 'spacer',
  category: 'utility',
  label: 'Spacer / Divider',
  description: 'Empty vertical space between blocks, with an optional dividing line.',
  icon: 'separator-horizontal',
  schema: SpacerPropsSchema,
  defaultProps: () => SpacerPropsSchema.parse({}),
  css,
  render: renderSpacer,
});
