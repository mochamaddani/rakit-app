'use client';

import { createContext, useContext, useState, type ReactNode } from 'react';
import { useStore } from 'zustand';
import {
  createEditorStore,
  type EditorActions,
  type EditorState,
  type EditorStore,
} from '@/lib/editor/store';
import type { PageDocument } from '@/lib/schema/document';

const EditorStoreContext = createContext<EditorStore | null>(null);

/** Creates the editor store once for the page being edited. */
export function EditorProvider({
  pageId,
  initialDoc,
  children,
}: {
  pageId: string;
  initialDoc: PageDocument;
  children: ReactNode;
}) {
  const [store] = useState(() => createEditorStore({ pageId, doc: initialDoc }));
  return <EditorStoreContext.Provider value={store}>{children}</EditorStoreContext.Provider>;
}

export function useEditorStore(): EditorStore {
  const store = useContext(EditorStoreContext);
  if (!store) throw new Error('useEditorStore must be used inside <EditorProvider>');
  return store;
}

/** Subscribes to a slice of the editor state; wrap object-returning selectors in useShallow. */
export function useEditor<T>(selector: (state: EditorState & EditorActions) => T): T {
  return useStore(useEditorStore(), selector);
}
