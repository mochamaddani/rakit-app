'use client';

import { Button } from '@/components/ui/button';
import { useAutosaveApi, useAutosaveState } from './use-autosave';

/** Conflicts and failed saves need a decision, so they get a banner, not just the status text. */
export function SaveBanner() {
  const { autosave, reloadLatest } = useAutosaveApi();
  const status = useAutosaveState((s) => s.status);
  const error = useAutosaveState((s) => s.error);

  if (status === 'conflict') {
    return (
      <div
        role="alert"
        className="flex flex-wrap items-center gap-3 border-b bg-amber-50 px-4 py-2 text-sm text-amber-950"
      >
        <p>This page was changed in another tab or window.</p>
        <Button size="sm" variant="outline" onClick={reloadLatest}>
          Reload latest
        </Button>
        <Button size="sm" onClick={() => void autosave.overwrite()}>
          Keep my version
        </Button>
      </div>
    );
  }
  if (status === 'error') {
    return (
      <div
        role="alert"
        className="flex flex-wrap items-center gap-3 border-b bg-red-50 px-4 py-2 text-sm text-red-950"
      >
        <p>{error}</p>
        <Button size="sm" variant="outline" onClick={() => autosave.retry()}>
          Retry
        </Button>
      </div>
    );
  }
  return null;
}
