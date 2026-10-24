'use client';

import { useSyncExternalStore } from 'react';
import { formatEdited } from '@/lib/pages/format';

const subscribe = () => () => {};

/**
 * "3 hours ago" or a date. The server renders dates in UTC; after hydration the browser shows
 * them in the viewer's own time zone (dates older than a week could otherwise be a day off).
 */
export function RelativeTime({ iso, now }: { iso: string; now: string }) {
  const inBrowser = useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );
  return (
    <time dateTime={iso}>{formatEdited(iso, new Date(now), inBrowser ? undefined : 'UTC')}</time>
  );
}
