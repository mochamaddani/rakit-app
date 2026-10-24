'use client';

import { exportFreshness } from '@/lib/export/record';
import { useAutosaveState } from '../use-autosave';
import { useExportState } from './export-context';

const TEXT = {
  none: 'Not exported yet',
  current: 'Exported · up to date',
  stale: 'Exported · changes since',
} as const;

/** Whether the draft has changed since the last export (PRD §6.8). */
export function ExportStatus() {
  const { latest } = useExportState();
  const status = useAutosaveState((s) => s.status);
  const revision = useAutosaveState((s) => s.revision);
  return (
    <span data-testid="export-status" className="text-xs text-muted-foreground">
      {TEXT[exportFreshness(latest, { status, revision })]}
    </span>
  );
}
