'use client';

import type { SaveStatus as Status } from '@/lib/editor/autosave';
import { cn } from '@/lib/utils';
import { useAutosaveState } from './use-autosave';

const TEXT: Record<Status, string> = {
  saved: 'Saved',
  dirty: 'Unsaved changes',
  saving: 'Saving…',
  offline: 'Offline — retrying',
  error: 'Not saved',
  conflict: 'Conflict',
};

/** Not a live region: it changes on every keystroke. Errors and conflicts get an alert banner. */
export function SaveStatus() {
  const status = useAutosaveState((s) => s.status);
  return (
    <span
      data-testid="save-status"
      className={cn(
        'text-xs text-muted-foreground',
        (status === 'error' || status === 'conflict') && 'text-destructive',
      )}
    >
      {TEXT[status]}
    </span>
  );
}
