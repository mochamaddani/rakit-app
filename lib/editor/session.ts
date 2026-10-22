import type { PageDocument } from '@/lib/schema/document';
import { createAutosave, type Autosave, type SaveRequest, type SaveResponse } from './autosave';
import { createEditorStore, type EditorStore } from './store';

// An editor session is one page's store and autosave. It lives as long as the tab, not as long as
// a React mount (docs/DECISIONS.md D-042): Next.js hands a remounted editor the first load's
// server payload again on browser back/forward, and unsaved changes must keep saving, and keep
// the leave warning, after the editor unmounts.

/** The window events a session listens to; a plain EventTarget in tests. */
export type SessionWindow = EventTarget & {
  document: EventTarget & { readonly visibilityState: DocumentVisibilityState };
};

export interface SessionInput {
  pageId: string;
  initialDoc: PageDocument;
  initialRevision: number;
}

export interface EditorSession {
  readonly store: EditorStore;
  readonly autosave: Autosave;
  /** The user is throwing local changes away (Reload latest), so leaving must not warn. */
  discard(): void;
  /** Stops saving and listening. */
  close(): void;
}

type Send = (request: SaveRequest) => Promise<SaveResponse>;

/** Flushes when the page hides or loses focus, retries when back online, guards the unload. */
function listen(target: SessionWindow, autosave: Autosave, discarded: () => boolean): () => void {
  const onVisibility = () => {
    if (target.document.visibilityState === 'hidden') void autosave.flush({ unloading: true });
  };
  const onPageHide = () => void autosave.flush({ unloading: true });
  const onBlur = () => void autosave.flush();
  const onOnline = () => autosave.retry();
  const onBeforeUnload = (event: Event) => {
    if (discarded() || autosave.store.getState().status === 'saved') return;
    event.preventDefault();
    // Older browsers show the warning only when returnValue is set.
    (event as BeforeUnloadEvent).returnValue = '';
  };
  target.document.addEventListener('visibilitychange', onVisibility);
  target.addEventListener('pagehide', onPageHide);
  target.addEventListener('blur', onBlur);
  target.addEventListener('online', onOnline);
  target.addEventListener('beforeunload', onBeforeUnload);
  return () => {
    target.document.removeEventListener('visibilitychange', onVisibility);
    target.removeEventListener('pagehide', onPageHide);
    target.removeEventListener('blur', onBlur);
    target.removeEventListener('online', onOnline);
    target.removeEventListener('beforeunload', onBeforeUnload);
  };
}

/** A session on its own; without a target (server rendering) it listens to nothing. */
export function createEditorSession(
  input: SessionInput,
  options: { send: Send; target?: SessionWindow },
): EditorSession {
  const store = createEditorStore({ pageId: input.pageId, doc: input.initialDoc });
  const autosave = createAutosave({
    initialRevision: input.initialRevision,
    getSnapshot: () => {
      const { doc, version } = store.getState();
      return { doc, version };
    },
    send: options.send,
  });
  let discarded = false;
  const unsubscribe = store.subscribe((state, previous) => {
    if (state.version !== previous.version) autosave.changed(state.version);
  });
  const unlisten = options.target ? listen(options.target, autosave, () => discarded) : () => {};
  return {
    store,
    autosave,
    discard() {
      discarded = true;
    },
    close() {
      unsubscribe();
      unlisten();
      autosave.dispose();
    },
  };
}

export interface SessionRegistry {
  /** The page's session: the one this tab already has, unless the server holds a newer copy. */
  open(input: SessionInput): EditorSession;
}

/** One session per page for the life of the tab. */
export function createSessionRegistry(options: {
  createSend(pageId: string): Send;
  target: SessionWindow;
}): SessionRegistry {
  const sessions = new Map<string, EditorSession>();
  return {
    open(input) {
      const existing = sessions.get(input.pageId);
      if (existing) {
        const { status, revision } = existing.autosave.store.getState();
        // Unsaved changes stay (a newer server copy then surfaces as a conflict on save), and a
        // session at least as new as the payload beats a stale back/forward replay.
        if (status !== 'saved' || revision >= input.initialRevision) return existing;
        existing.close();
      }
      const session = createEditorSession(input, {
        send: options.createSend(input.pageId),
        target: options.target,
      });
      sessions.set(input.pageId, session);
      return session;
    },
  };
}
