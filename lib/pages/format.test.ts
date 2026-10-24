import { expect, it } from 'vitest';
import { formatEdited } from './format';

const now = new Date('2026-10-22T12:00:00Z');
it.each([
  ['2026-10-22T11:59:30Z', 'just now'],
  ['2026-10-22T11:55:00Z', '5 minutes ago'],
  ['2026-10-22T09:00:00Z', '3 hours ago'],
  ['2026-10-20T12:00:00Z', '2 days ago'],
  ['2026-10-03T08:00:00Z', 'Oct 3, 2026'],
])('%s → %s', (iso, text) => expect(formatEdited(iso, now)).toBe(text));

it('dates older than a week use the given time zone', () => {
  expect(formatEdited('2026-10-01T20:00:00Z', now, 'UTC')).toBe('Oct 1, 2026');
  expect(formatEdited('2026-10-01T20:00:00Z', now, 'Asia/Jakarta')).toBe('Oct 2, 2026');
});
