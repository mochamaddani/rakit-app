import { defineBlock } from '../types';
import { renderCountdown } from './render';
import { countdownEndMs, CountdownPropsSchema } from './schema';
import { asset as script } from './snippet.generated';
import { asset as css } from './styles.generated';

export const countdown = defineBlock({
  type: 'countdown',
  category: 'conversion',
  label: 'Countdown',
  description:
    'Counts down to a real deadline (same moment for every visitor), then shows a message or hides.',
  icon: 'timer',
  schema: CountdownPropsSchema,
  defaultProps: () => CountdownPropsSchema.parse({ heading: 'The offer ends in' }),
  css,
  snippet: { asset: script, isNeeded: (props) => countdownEndMs(props) !== null },
  render: renderCountdown,
});
