'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { updatePageSlug } from '@/app/(editor)/dashboard/actions';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { browserExportDeps, saveFile, supabaseRecordDeps } from '@/lib/export/browser';
import {
  buildExport,
  DEFAULT_EXPORT_OPTIONS,
  type BuildDeps,
  type ExportBuild,
  type ExportOptions,
  type FetchedImage,
} from '@/lib/export/build';
import { recordExport, unsavedReason } from '@/lib/export/record';
import { formatBytes, SIZE_HARD_BYTES, SIZE_WARN_BYTES } from '@/lib/export/size';
import type { PageDocument } from '@/lib/schema/document';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import { cn } from '@/lib/utils';
import { useEditorStore, useWorkspaceId } from '../editor-context';
import { useAutosaveApi } from '../use-autosave';
import { useExportState } from './export-context';

// The export dialog (PRD §6.7, docs/DECISIONS.md D-007, D-049). It saves the draft first, builds
// the file in the browser, downloads or copies it, then records the same bytes as a version.

const REBUILD_MS = 300;

type Phase = { kind: 'saving' } | { kind: 'blocked'; reason: string } | { kind: 'ready' };

interface Built {
  build: ExportBuild;
  doc: PageDocument;
  options: ExportOptions;
  draftRevision: number;
}

type Recording =
  | { kind: 'idle' }
  | { kind: 'recording' }
  | { kind: 'recorded'; sha256: string }
  | { kind: 'failed'; message: string; action: 'download' | 'copy'; built: Built };

export function ExportDialog({
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
          <DialogTitle>Export page</DialogTitle>
        </DialogHeader>
        {open ? <ExportPanel /> : null}
      </DialogContent>
    </Dialog>
  );
}

function ExportPanel() {
  const store = useEditorStore();
  const { autosave } = useAutosaveApi();
  const workspaceId = useWorkspaceId();
  const { pageId, slug, setSlug, setLatest } = useExportState();
  const [phase, setPhase] = useState<Phase>({ kind: 'saving' });
  const [options, setOptions] = useState<ExportOptions>(DEFAULT_EXPORT_OPTIONS);
  const [built, setBuilt] = useState<Built | null>(null);
  const [building, setBuilding] = useState(false);
  const [recording, setRecording] = useState<Recording>({ kind: 'idle' });
  const [fileName, setFileName] = useState(slug);
  const [fileError, setFileError] = useState<string | null>(null);
  const images = useRef(new Map<string, Promise<FetchedImage>>());
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);

  // Images are fetched once per dialog, whatever options change.
  const deps = useMemo<BuildDeps>(
    () => ({
      fetchImage: (url) => {
        let image = images.current.get(url);
        if (!image) {
          image = browserExportDeps.fetchImage(url);
          images.current.set(url, image);
        }
        return image;
      },
      rasterizeFavicon: browserExportDeps.rasterizeFavicon,
    }),
    [],
  );

  const prepare = async () => {
    setPhase({ kind: 'saving' });
    await autosave.flush();
    const reason = unsavedReason(autosave.store.getState());
    setPhase(reason ? { kind: 'blocked', reason } : { kind: 'ready' });
  };

  // A version must match a draft the server holds, so the dialog saves first.
  useEffect(() => {
    let cancelled = false;
    void autosave.flush().then(() => {
      if (cancelled) return;
      const reason = unsavedReason(autosave.store.getState());
      setPhase(reason ? { kind: 'blocked', reason } : { kind: 'ready' });
    });
    return () => {
      cancelled = true;
    };
  }, [autosave]);

  useEffect(() => {
    if (phase.kind !== 'ready') return;
    let cancelled = false;
    const timer = setTimeout(() => {
      setBuilding(true);
      const doc = store.getState().doc;
      const draftRevision = autosave.store.getState().revision;
      void buildExport(doc, options, deps).then((build) => {
        if (cancelled) return;
        setBuilt({ build, doc, options, draftRevision });
        setBuilding(false);
      });
    }, REBUILD_MS);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [phase, options, deps, store, autosave]);

  const record = async (action: 'download' | 'copy', from: Built) => {
    setRecording({ kind: 'recording' });
    const result = await recordExport(
      {
        workspaceId,
        pageId,
        doc: from.doc,
        build: from.build,
        options: from.options,
        draftRevision: from.draftRevision,
      },
      supabaseRecordDeps(supabase),
    );
    if (result.ok) {
      setLatest(result.latest);
      setRecording({ kind: 'recorded', sha256: from.build.sha256 });
    } else {
      setRecording({ kind: 'failed', message: result.message, action, built: from });
    }
  };

  const saveName = async () => {
    const next = fileName.trim();
    if (next === slug) {
      setFileError(null);
      return;
    }
    const result = await updatePageSlug(pageId, next);
    if (result.ok) {
      setSlug(result.slug);
      setFileName(result.slug);
      setFileError(null);
    } else {
      setFileError(result.error);
    }
  };

  const ready = phase.kind === 'ready' && built !== null && !building;
  const busy = recording.kind === 'recording';
  const build = built?.build ?? null;

  return (
    <div className="grid gap-4">
      {phase.kind === 'saving' ? (
        <p className="text-muted-foreground">Saving the page before export…</p>
      ) : null}
      {phase.kind === 'blocked' ? (
        <div role="alert" className="grid gap-2 rounded-md bg-amber-50 p-3 text-amber-950">
          <p>Save the page before exporting: {phase.reason}</p>
          <Button size="sm" variant="outline" className="justify-self-start" onClick={prepare}>
            Try again
          </Button>
        </div>
      ) : null}

      <fieldset className="grid gap-2">
        <legend className="mb-1 font-medium">Images</legend>
        {(
          [
            ['portable', 'Portable', 'Images inside the file; works offline'],
            ['hosted', 'Hosted', "Images load from LaunchPad's storage; lighter file"],
          ] as const
        ).map(([value, label, hint]) => (
          <label key={value} className="flex items-start gap-2">
            <input
              type="radio"
              name="export-images"
              value={value}
              checked={options.images === value}
              onChange={() => setOptions((o) => ({ ...o, images: value }))}
              className="mt-1"
            />
            <span>
              {label}
              <span className="block text-xs text-muted-foreground">{hint}</span>
            </span>
          </label>
        ))}
      </fieldset>
      <div className="flex flex-wrap gap-4">
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={options.minify}
            onChange={(event) => setOptions((o) => ({ ...o, minify: event.target.checked }))}
          />
          Minify HTML
        </label>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={options.tracking}
            onChange={(event) => setOptions((o) => ({ ...o, tracking: event.target.checked }))}
          />
          Include tracking
        </label>
      </div>
      <div className="grid gap-1">
        <Label htmlFor="export-file-name">File name</Label>
        <div className="flex items-center gap-1">
          <Input
            id="export-file-name"
            value={fileName}
            maxLength={80}
            aria-invalid={fileError ? true : undefined}
            aria-describedby={fileError ? 'export-file-name-error' : undefined}
            onChange={(event) => setFileName(event.target.value)}
            onBlur={() => void saveName()}
          />
          <span className="text-muted-foreground">.html</span>
        </div>
        {fileError ? (
          <p id="export-file-name-error" className="text-xs text-destructive">
            {fileError}
          </p>
        ) : null}
      </div>

      {build ? (
        <div className="grid gap-2">
          <p
            data-testid="export-size"
            className={cn(
              'font-medium',
              build.bytes > SIZE_HARD_BYTES && 'text-destructive',
              build.bytes > SIZE_WARN_BYTES && build.bytes <= SIZE_HARD_BYTES && 'text-amber-700',
            )}
          >
            File size: {formatBytes(build.bytes)}
            {building ? (
              <span className="ml-2 text-xs text-muted-foreground">Updating…</span>
            ) : null}
          </p>
          <details>
            <summary className="cursor-pointer text-xs text-muted-foreground">
              Size by block
            </summary>
            <ul className="mt-1 grid gap-0.5 text-xs">
              {[...build.report.rows]
                .sort((a, b) => b.bytes - a.bytes)
                .slice(0, 8)
                .map((row) => (
                  <li key={row.key} className="flex justify-between gap-2">
                    <span>{row.label}</span>
                    <span className="tabular-nums">{formatBytes(row.bytes)}</span>
                  </li>
                ))}
            </ul>
          </details>
          <section aria-labelledby="export-checklist" className="grid gap-1">
            <h3 id="export-checklist" className="font-medium">
              Before you export
            </h3>
            {build.checklist.length === 0 ? (
              <p className="text-xs text-muted-foreground">Nothing to fix.</p>
            ) : (
              <ul className="grid gap-1 text-xs" data-testid="export-checklist">
                {build.checklist.map((item) => (
                  <li
                    key={item.id}
                    className={item.level === 'hard' ? 'text-destructive' : 'text-amber-800'}
                  >
                    {item.message}
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      ) : phase.kind === 'ready' ? (
        <p className="text-muted-foreground">Building the file…</p>
      ) : null}

      <div className="flex flex-wrap items-center gap-2">
        <Button
          disabled={!ready || busy}
          onClick={() => {
            if (!built) return;
            saveFile(built.build.html, `${slug}.html`);
            void record('download', built);
          }}
        >
          Download HTML
        </Button>
        <Button
          variant="outline"
          disabled={!ready || busy}
          onClick={() => {
            if (!built) return;
            void navigator.clipboard.writeText(built.build.html).then(() => record('copy', built));
          }}
        >
          Copy HTML
        </Button>
      </div>
      <div role="status" className="text-xs">
        {recording.kind === 'recording' ? 'Recording this export…' : null}
        {recording.kind === 'recorded'
          ? `Recorded · sha256 ${recording.sha256.slice(0, 12)}`
          : null}
      </div>
      {recording.kind === 'failed' ? (
        <div role="alert" className="flex flex-wrap items-center gap-2 text-xs text-destructive">
          <p>
            {recording.action === 'download' ? 'Downloaded' : 'Copied'}, but this export wasn&apos;t
            recorded: {recording.message}
          </p>
          <Button
            size="sm"
            variant="outline"
            onClick={() => void record(recording.action, recording.built)}
          >
            Retry
          </Button>
        </div>
      ) : null}
    </div>
  );
}
