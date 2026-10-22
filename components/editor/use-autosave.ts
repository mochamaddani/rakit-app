'use client';

import { createContext, useContext, useEffect, useRef, useState } from 'react';
import { useStore } from 'zustand';
import { createAutosave, type Autosave, type AutosaveState } from '@/lib/editor/autosave';
import { createDraftSender } from '@/lib/editor/draft-sender';
import type { EditorStore } from '@/lib/editor/store';

export interface AutosaveApi {
  autosave: Autosave;
  /** Discards local changes and loads the server copy (after a conflict). */
  reloadLatest(): void;
}

export const AutosaveContext = createContext<AutosaveApi | null>(null);

export function useAutosaveApi(): AutosaveApi {
  const api = useContext(AutosaveContext);
  if (!api) throw new Error('useAutosaveApi must be used inside the editor');
  return api;
}

export function useAutosaveState<T>(selector: (state: AutosaveState) => T): T {
  return useStore(useAutosaveApi().autosave.store, selector);
}

/**
 * Saves the draft as the document changes (docs/DECISIONS.md D-035). Pending changes are flushed
 * when the tab hides or the window loses focus, and the browser warns before leaving with
 * unsaved changes.
 */
export function useAutosave(
  store: EditorStore,
  pageId: string,
  initialRevision: number,
): AutosaveApi {
  const discarding = useRef(false);
  const [api] = useState<AutosaveApi>(() => ({
    autosave: createAutosave({
      initialRevision,
      getSnapshot: () => {
        const { doc, version } = store.getState();
        return { doc, version };
      },
      send: createDraftSender(pageId),
    }),
    reloadLatest: () => {
      discarding.current = true;
      window.location.reload();
    },
  }));

  useEffect(() => {
    const { autosave } = api;
    const unsubscribe = store.subscribe((state, previous) => {
      if (state.version !== previous.version) autosave.changed(state.version);
    });
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') void autosave.flush({ unloading: true });
    };
    const onPageHide = () => void autosave.flush({ unloading: true });
    const onBlur = () => void autosave.flush();
    const onOnline = () => autosave.retry();
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      if (discarding.current || autosave.store.getState().status === 'saved') return;
      event.preventDefault();
      event.returnValue = '';
    };
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('pagehide', onPageHide);
    window.addEventListener('blur', onBlur);
    window.addEventListener('online', onOnline);
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => {
      unsubscribe();
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('pagehide', onPageHide);
      window.removeEventListener('blur', onBlur);
      window.removeEventListener('online', onOnline);
      window.removeEventListener('beforeunload', onBeforeUnload);
      // Leaving the editor inside the app saves what is pending. Not dispose(): StrictMode runs
      // this cleanup once in development and then sets the effect up again.
      void autosave.flush();
    };
  }, [api, store]);

  return api;
}
