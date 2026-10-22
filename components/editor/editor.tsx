'use client';

import type { PageDocument } from '@/lib/schema/document';
import { Canvas } from './canvas/canvas';
import { EditorProvider, useEditor, useEditorStore } from './editor-context';
import { Inspector } from './inspector/inspector';
import { Palette } from './palette';
import { SaveBanner } from './save-banner';
import { TopBar } from './top-bar';
import { AutosaveContext, useAutosave } from './use-autosave';
import { useShortcuts } from './use-shortcuts';

export interface EditorProps {
  page: { id: string; name: string };
  initialDoc: PageDocument;
  initialRevision: number;
}

/** Three panes: block palette, live canvas, inspector. */
export function Editor({ page, initialDoc, initialRevision }: EditorProps) {
  return (
    <EditorProvider pageId={page.id} initialDoc={initialDoc}>
      <EditorShell page={page} initialRevision={initialRevision} />
    </EditorProvider>
  );
}

function EditorShell({
  page,
  initialRevision,
}: {
  page: EditorProps['page'];
  initialRevision: number;
}) {
  const store = useEditorStore();
  const autosave = useAutosave(store, page.id, initialRevision);
  const onCanvasKey = useShortcuts(store);
  const announcement = useEditor((s) => s.announcement);

  return (
    <AutosaveContext.Provider value={autosave}>
      <div className="flex h-dvh flex-col">
        <TopBar name={page.name} />
        <SaveBanner />
        <div className="flex min-h-0 flex-1">
          <aside className="w-60 shrink-0 overflow-y-auto border-r bg-background">
            <Palette />
          </aside>
          <Canvas onKey={onCanvasKey} />
          <aside
            aria-label="Inspector"
            className="w-[340px] shrink-0 overflow-y-auto border-l bg-background"
          >
            <Inspector />
          </aside>
        </div>
      </div>
      <div role="status" aria-live="polite" className="sr-only" data-testid="announcer">
        {announcement}
      </div>
    </AutosaveContext.Provider>
  );
}
