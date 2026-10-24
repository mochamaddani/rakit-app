// Editor UI only (the renderer never uses Intl, D-011).
const RELATIVE = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });
const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/**
 * "just now", "5 minutes ago", "3 hours ago", "2 days ago", then a date like "Oct 3, 2026" in
 * `timeZone` (the runtime's own when omitted: the viewer's, once rendered in the browser).
 */
export function formatEdited(updatedAt: string, now: Date, timeZone?: string): string {
  const then = new Date(updatedAt);
  const elapsed = now.getTime() - then.getTime();
  if (elapsed < MINUTE) return 'just now';
  if (elapsed < HOUR) return RELATIVE.format(-Math.floor(elapsed / MINUTE), 'minute');
  if (elapsed < DAY) return RELATIVE.format(-Math.floor(elapsed / HOUR), 'hour');
  if (elapsed < 7 * DAY) return RELATIVE.format(-Math.floor(elapsed / DAY), 'day');
  return then.toLocaleDateString('en', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone,
  });
}
