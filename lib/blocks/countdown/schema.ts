import { z } from 'zod';
import { datetime, parseWallClock, rich, text, UTC_OFFSETS, when } from '@/lib/schema/primitives';

export const CountdownPropsSchema = z.object({
  heading: rich(160).default(''),
  /** Wall-clock time in `utcOffset`, so the deadline is the same instant for every visitor. */
  endsAt: datetime().default(''),
  utcOffset: z.enum(UTC_OFFSETS).default('+07:00'),
  onEnd: z.enum(['hide', 'message']).default('message'),
  endedText: when(text(160).default(''), 'onEnd', ['message']),
  showDays: z.boolean().default(true),
});
export type CountdownProps = z.output<typeof CountdownPropsSchema>;

/** Days since 1970-01-01 for a civil date (proleptic Gregorian); avoids Date (D-011). */
function daysFromCivil(year: number, month: number, day: number): number {
  const y = month <= 2 ? year - 1 : year;
  const era = Math.floor(y / 400);
  const yoe = y - era * 400;
  const doy = Math.floor((153 * (month + (month > 2 ? -3 : 9)) + 2) / 5) + day - 1;
  const doe = yoe * 365 + Math.floor(yoe / 4) - Math.floor(yoe / 100) + doy;
  return era * 146097 + doe - 719468;
}

/** The deadline in epoch milliseconds; null when no valid deadline is set. Pure. */
export function countdownEndMs(props: CountdownProps): number | null {
  const at = parseWallClock(props.endsAt);
  if (!at) return null;
  const sign = props.utcOffset.startsWith('-') ? -1 : 1;
  const offsetMinutes =
    sign * (Number(props.utcOffset.slice(1, 3)) * 60 + Number(props.utcOffset.slice(4, 6)));
  const minutes =
    daysFromCivil(at.year, at.month, at.day) * 1440 + at.hour * 60 + at.minute - offsetMinutes;
  return minutes * 60_000;
}
