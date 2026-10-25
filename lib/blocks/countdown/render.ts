import type { RenderContext } from '@/lib/renderer/context';
import { html, type SafeHtml } from '@/lib/renderer/html';
import type { MessageKey } from '@/lib/renderer/i18n';
import { countdownEndMs, type CountdownProps } from './schema';

const UNITS: ReadonlyArray<{ unit: 'd' | 'h' | 'm' | 's'; label: MessageKey }> = [
  { unit: 'd', label: 'days' },
  { unit: 'h', label: 'hours' },
  { unit: 'm', label: 'minutes' },
  { unit: 's', label: 'seconds' },
];

// A fixed deadline (docs/DECISIONS.md D-051). The digits start as "--"; snippet.js fills them in
// and handles the end, so the renderer never reads the clock.
export function renderCountdown(props: CountdownProps, ctx: RenderContext): SafeHtml {
  const end = countdownEndMs(props);
  const heading = props.heading
    ? html`<p class="lp-countdown__heading"${ctx.field('heading', 'rich')}>${ctx.rich(props.heading)}</p>`
    : '';
  if (end === null) {
    return ctx.mode === 'preview'
      ? html`<div class="lp-countdown">${heading}<p class="lp-countdown__hint">Set an end date in the inspector</p></div>`
      : html``;
  }
  const units = UNITS.filter(({ unit }) => props.showDays || unit !== 'd').map(
    ({ unit, label }) =>
      html`<div class="lp-countdown__unit"><span class="lp-countdown__n" data-u="${unit}">--</span><span class="lp-countdown__l">${ctx.t(
        label,
      )}</span></div>`,
  );
  const ended = props.endedText
    ? html`<p class="lp-countdown__end" hidden${ctx.field('endedText', 'text')}>${ctx.text(props.endedText)}</p>`
    : html`<p class="lp-countdown__end" hidden>${ctx.t('offerEnded')}</p>`;
  return html`<div class="lp-countdown" data-lp-countdown data-end="${String(end)}" data-on-end="${
    props.onEnd
  }" role="timer" aria-live="off">${heading}<div class="lp-countdown__units">${units}</div>${ended}</div>`;
}
