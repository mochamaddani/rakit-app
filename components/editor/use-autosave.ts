'use client';

import { createContext, useContext, useState } from 'react';
import { useStore } from 'zustand';
import type { Autosave, AutosaveState } from '@/lib/editor/autosave';
import type { EditorSession } from '@/lib/editor/session';

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
 * The session's autosave (docs/DECISIONS.md D-035, D-042). The session saves, flushes when the
 * tab hides and guards the unload by itself, so it keeps doing so after the editor unmounts.
 */
export function useAutosave(session: EditorSession): AutosaveApi {
  const [api] = useState<AutosaveApi>(() => ({
    autosave: session.autosave,
    reloadLatest: () => {
      session.discard();
      window.location.reload();
    },
  }));
  return api;
}
