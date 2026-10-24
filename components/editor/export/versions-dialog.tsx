'use client';

import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { formatBytes } from '@/lib/export/size';
import {
  downloadVersion,
  listVersions,
  loadVersionDocument,
  type VersionRow,
} from '@/lib/export/versions';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import { useEditor } from '../editor-context';
import { useExportState } from './export-context';

// Every export, newest first, to download again or restore (PRD §6.8, D-049). Restoring is one
// undoable command, saved by autosave like any edit.

const when = (iso: string) =>
  new Date(iso).toLocaleString('en', { dateStyle: 'medium', timeStyle: 'short' });

export function VersionsDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange(open: boolean): void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Versions</DialogTitle>
        </DialogHeader>
        {open ? <VersionList onRestored={() => onOpenChange(false)} /> : null}
      </DialogContent>
    </Dialog>
  );
}

function VersionList({ onRestored }: { onRestored(): void }) {
  const { pageId, slug, latest } = useExportState();
  const dispatch = useEditor((s) => s.dispatch);
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const [rows, setRows] = useState<VersionRow[] | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  // `latest` changes after an export, so the list includes it.
  useEffect(() => {
    let cancelled = false;
    listVersions(supabase, pageId).then(
      (list) => {
        if (!cancelled) setRows(list);
      },
      (error: unknown) => {
        if (!cancelled) setMessage(error instanceof Error ? error.message : String(error));
      },
    );
    return () => {
      cancelled = true;
    };
  }, [supabase, pageId, latest]);

  const restore = async (row: VersionRow) => {
    setMessage(null);
    const loaded = await loadVersionDocument(supabase, row.id);
    if (!loaded.ok) {
      setMessage(`This version can't be restored: ${loaded.message}`);
      return;
    }
    const result = dispatch({
      type: 'restoreDocument',
      doc: loaded.doc,
      when: when(row.createdAt),
    });
    if (result.ok) onRestored();
    else setMessage(`This version can't be restored: ${result.reason}`);
  };

  const download = async (row: VersionRow) => {
    setMessage(null);
    if (!(await downloadVersion(supabase, row.htmlPath, `${slug}.html`))) {
      setMessage("This export's file couldn't be downloaded.");
    }
  };

  if (rows === null && message === null) return <p className="text-muted-foreground">Loading…</p>;
  return (
    <div className="grid gap-3">
      {message ? (
        <p role="alert" className="text-destructive">
          {message}
        </p>
      ) : null}
      {rows && rows.length === 0 ? <p className="text-muted-foreground">No exports yet.</p> : null}
      {rows && rows.length > 0 ? (
        <ul className="grid gap-2" aria-label="Exports">
          {rows.map((row, index) => (
            <li key={row.id} className="flex flex-wrap items-center gap-2 rounded-md border p-2">
              <div className="min-w-0 flex-1">
                <p className="font-medium">
                  {when(row.createdAt)}
                  {index === 0 ? (
                    <span className="ml-2 rounded bg-muted px-1.5 py-0.5 text-xs">Latest</span>
                  ) : null}
                </p>
                <p className="text-xs text-muted-foreground">
                  {formatBytes(row.byteSize)} ·{' '}
                  {row.options.images === 'hosted' ? 'Hosted' : 'Portable'} · sha256{' '}
                  {row.sha256.slice(0, 12)}
                </p>
              </div>
              <Button size="sm" variant="outline" onClick={() => void download(row)}>
                Download
              </Button>
              <Button size="sm" onClick={() => void restore(row)}>
                Restore
              </Button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
