'use client';

import { useRef } from 'react';
import type { PageDocument } from '@/lib/schema/document';
import { Canvas } from './canvas/canvas';
import type { CanvasHandle } from './canvas/canvas-handle';
import { DragProvider } from './dnd/drag-context';
import { EditorProvider, useEditor, useEditorSession } from './editor-context';
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
    <EditorProvider pageId={page.id} initialDoc={initialDoc} initialRevision={initialRevision}>
      <EditorShell page={page} />
    </EditorProvider>
  );
}

function EditorShell({ page }: { page: EditorProps['page'] }) {
  const session = useEditorSession();
  const autosave = useAutosave(session);
  const onCanvasKey = useShortcuts(session.store);
  const canvas = useRef<CanvasHandle | null>(null);
  const announcement = useEditor((s) => s.announcement);

  return (
    <AutosaveContext.Provider value={autosave}>
      <div className="flex h-dvh flex-col">
        <TopBar name={page.name} />
        <SaveBanner />
        <DragProvider canvas={canvas}>
          <div className="flex min-h-0 flex-1">
            <aside className="w-60 shrink-0 overflow-y-auto border-r bg-background">
              <Palette />
            </aside>
            <Canvas onKey={onCanvasKey} handleRef={canvas} />
            <aside
              aria-label="Inspector"
              className="w-[340px] shrink-0 overflow-y-auto border-l bg-background"
            >
              <Inspector />
            </aside>
          </div>
        </DragProvider>
      </div>
      <div role="status" aria-live="polite" className="sr-only" data-testid="announcer">
        {announcement}
      </div>
    </AutosaveContext.Provider>
  );
}
