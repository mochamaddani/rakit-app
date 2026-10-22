'use client';

import { useState } from 'react';

/**
 * Local state for one control. It follows `committed` when that changes from outside (undo, redo,
 * another control), keeps an invalid draft and its error while the user is editing, and returns
 * to `committed` on blur.
 */
export function useFieldDraft<T>(committed: T, validate: (draft: T) => string | null) {
  const [state, setState] = useState({
    draft: committed,
    error: null as string | null,
    base: committed,
  });
  if (!Object.is(state.base, committed)) {
    // Adjusting state while rendering (React's documented pattern for "follow a prop").
    setState({ draft: committed, error: null, base: committed });
  }

  return {
    draft: Object.is(state.base, committed) ? state.draft : committed,
    error: Object.is(state.base, committed) ? state.error : null,
    change(next: T, commit: (valid: T) => void) {
      const error = validate(next);
      setState((current) => ({ ...current, draft: next, error }));
      if (error === null) commit(next);
    },
    blur() {
      setState((current) =>
        current.error ? { ...current, draft: current.base, error: null } : current,
      );
    },
  };
}
