'use client';

import { ChevronLeft, Download, History, Redo2, Settings2, Undo2 } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useRef, useState, type KeyboardEvent, type MouseEvent } from 'react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import type { Viewport } from '@/lib/editor/store';
import { cn } from '@/lib/utils';
import { useEditor } from './editor-context';
import { ExportDialog } from './export/export-dialog';
import { ExportStatus } from './export/export-status';
import { VersionsDialog } from './export/versions-dialog';
import { SaveStatus } from './save-status';
import { useAutosaveApi } from './use-autosave';

const VIEWPORTS: ReadonlyArray<{ value: Viewport; label: string }> = [
  { value: 'mobile', label: 'Mobile' },
  { value: 'tablet', label: 'Tablet' },
  { value: 'desktop', label: 'Desktop' },
];

const LEAVE_WAIT_MS = 3000;

export function TopBar({ name }: { name: string }) {
  const notice = useEditor((s) => s.notice);
  const select = useEditor((s) => s.select);
  const { autosave } = useAutosaveApi();
  const router = useRouter();
  const [confirmLeave, setConfirmLeave] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [versions, setVersions] = useState(false);

  // Save what is pending before leaving (at most 3 s), so the dashboard shows the latest edit,
  // and ask first when it could not be saved (offline, failed or conflicting).
  const leave = async (event: MouseEvent<HTMLAnchorElement>) => {
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.button !== 0) return;
    event.preventDefault();
    await Promise.race([autosave.flush(), new Promise((r) => setTimeout(r, LEAVE_WAIT_MS))]);
    if (autosave.store.getState().status === 'saved') router.push('/dashboard');
    else setConfirmLeave(true);
  };

  return (
    <header className="flex h-12 shrink-0 items-center gap-3 border-b bg-background px-3">
      <Link
        href="/dashboard"
        onClick={leave}
        className="flex items-center gap-1 rounded-md px-2 py-1 text-sm text-muted-foreground hover:bg-muted hover:text-foreground"
      >
        <ChevronLeft className="size-4" aria-hidden="true" />
        Pages
      </Link>
      <h1 className="min-w-0 truncate text-sm font-semibold">{name}</h1>
      <SaveStatus />
      <ExportStatus />
      {notice ? <span className="truncate text-xs text-amber-700">{notice}</span> : null}
      <div className="ml-auto flex items-center gap-2">
        <HistoryButtons />
        <ViewportToggle />
        <Button variant="outline" size="sm" onClick={() => select({ kind: 'page' })}>
          <Settings2 aria-hidden="true" />
          Page settings
        </Button>
        <Button variant="outline" size="sm" onClick={() => setVersions(true)}>
          <History aria-hidden="true" />
          Versions
        </Button>
        <Button size="sm" onClick={() => setExporting(true)}>
          <Download aria-hidden="true" />
          Export
        </Button>
      </div>
      <ExportDialog open={exporting} onOpenChange={setExporting} />
      <VersionsDialog open={versions} onOpenChange={setVersions} />
      <LeaveDialog
        open={confirmLeave}
        onOpenChange={setConfirmLeave}
        onLeave={() => {
          setConfirmLeave(false);
          router.push('/dashboard');
        }}
      />
    </header>
  );
}

function LeaveDialog({
  open,
  onOpenChange,
  onLeave,
}: {
  open: boolean;
  onOpenChange(open: boolean): void;
  onLeave(): void;
}) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Leave without saving?</AlertDialogTitle>
          <AlertDialogDescription>
            Your latest changes aren&apos;t saved yet. They stay in this tab if you leave, but
            closing the tab loses them.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Stay</AlertDialogCancel>
          <AlertDialogAction onClick={onLeave}>Leave anyway</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function HistoryButtons() {
  const undoLabel = useEditor((s) => s.history.past.at(-1)?.label ?? null);
  const redoLabel = useEditor((s) => s.history.future.at(-1)?.label ?? null);
  const undo = useEditor((s) => s.undo);
  const redo = useEditor((s) => s.redo);
  return (
    <div className="flex items-center">
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label="Undo"
        title={undoLabel ? `Undo ${undoLabel}` : 'Undo'}
        disabled={undoLabel === null}
        onClick={() => undo()}
      >
        <Undo2 aria-hidden="true" />
      </Button>
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label="Redo"
        title={redoLabel ? `Redo ${redoLabel}` : 'Redo'}
        disabled={redoLabel === null}
        onClick={() => redo()}
      >
        <Redo2 aria-hidden="true" />
      </Button>
    </div>
  );
}

/** A radio group (roving focus, arrow keys) for the canvas width. */
function ViewportToggle() {
  const viewport = useEditor((s) => s.viewport);
  const setViewport = useEditor((s) => s.setViewport);
  const buttons = useRef<(HTMLButtonElement | null)[]>([]);

  const onKeyDown = (event: KeyboardEvent, index: number) => {
    const step =
      event.key === 'ArrowRight' || event.key === 'ArrowDown'
        ? 1
        : event.key === 'ArrowLeft' || event.key === 'ArrowUp'
          ? -1
          : 0;
    if (!step) return;
    event.preventDefault();
    const next = (index + step + VIEWPORTS.length) % VIEWPORTS.length;
    setViewport(VIEWPORTS[next]!.value);
    buttons.current[next]?.focus();
  };

  return (
    <div role="radiogroup" aria-label="Preview width" className="flex rounded-lg border p-0.5">
      {VIEWPORTS.map((option, index) => {
        const checked = option.value === viewport;
        return (
          <button
            key={option.value}
            ref={(el) => {
              buttons.current[index] = el;
            }}
            type="button"
            role="radio"
            aria-checked={checked}
            tabIndex={checked ? 0 : -1}
            onClick={() => setViewport(option.value)}
            onKeyDown={(event) => onKeyDown(event, index)}
            className={cn(
              'rounded-md px-2.5 py-1 text-xs font-medium text-muted-foreground',
              checked && 'bg-muted text-foreground',
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
