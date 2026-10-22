'use client';

import { createContext, useContext, useState, type ReactNode } from 'react';
import { useStore } from 'zustand';
import { createDraftSender } from '@/lib/editor/draft-sender';
import {
  createEditorSession,
  createSessionRegistry,
  type EditorSession,
  type SessionInput,
  type SessionRegistry,
} from '@/lib/editor/session';
import type { EditorActions, EditorState, EditorStore } from '@/lib/editor/store';

const EditorSessionContext = createContext<EditorSession | null>(null);

let registry: SessionRegistry | undefined;

function openSession(input: SessionInput): EditorSession {
  // Server rendering gets a throwaway session: the registry is per tab, so browser-only.
  if (typeof window === 'undefined') {
    return createEditorSession(input, { send: createDraftSender(input.pageId) });
  }
  registry ??= createSessionRegistry({ createSend: createDraftSender, target: window });
  return registry.open(input);
}

/** Opens the page's editor session (docs/DECISIONS.md D-042) for the editor below. */
export function EditorProvider({
  pageId,
  initialDoc,
  initialRevision,
  children,
}: SessionInput & { children: ReactNode }) {
  const [session] = useState(() => openSession({ pageId, initialDoc, initialRevision }));
  return <EditorSessionContext.Provider value={session}>{children}</EditorSessionContext.Provider>;
}

export function useEditorSession(): EditorSession {
  const session = useContext(EditorSessionContext);
  if (!session) throw new Error('useEditorSession must be used inside <EditorProvider>');
  return session;
}

export function useEditorStore(): EditorStore {
  return useEditorSession().store;
}

/** Subscribes to a slice of the editor state; wrap object-returning selectors in useShallow. */
export function useEditor<T>(selector: (state: EditorState & EditorActions) => T): T {
  return useStore(useEditorStore(), selector);
}
