'use client';

import type { PageDocument } from '@/lib/schema/document';
import { Canvas } from './canvas/canvas';
import { EditorProvider } from './editor-context';
import { TopBar } from './top-bar';

export interface EditorProps {
  page: { id: string; name: string };
  initialDoc: PageDocument;
  initialRevision: number;
}

/** Three panes: block palette, live canvas, inspector. */
export function Editor({ page, initialDoc }: EditorProps) {
  return (
    <EditorProvider pageId={page.id} initialDoc={initialDoc}>
      <div className="flex h-dvh flex-col">
        <TopBar name={page.name} />
        <div className="flex min-h-0 flex-1">
          <aside className="w-60 shrink-0 overflow-y-auto border-r bg-background" />
          <Canvas />
          <aside className="w-[340px] shrink-0 overflow-y-auto border-l bg-background" />
        </div>
      </div>
    </EditorProvider>
  );
}
