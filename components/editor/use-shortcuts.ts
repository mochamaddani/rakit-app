'use client';

import { useCallback, useEffect } from 'react';
import type { KeyInput } from '@/lib/editor/canvas/constants';
import { performIntent, resolveShortcut } from '@/lib/editor/shortcuts';
import type { EditorStore } from '@/lib/editor/store';

function isEditingText(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName);
}

/**
 * Editor shortcuts from the window, plus a handler for keys the canvas forwards (the canvas has
 * no editable text in M2a). Returns that handler for `<Canvas onKey>`.
 */
export function useShortcuts(store: EditorStore): (input: KeyInput) => void {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const input = {
        key: event.key,
        mod: event.metaKey || event.ctrlKey,
        shift: event.shiftKey,
        alt: event.altKey,
      };
      const intent = resolveShortcut(input, { editingText: isEditingText(event.target) });
      if (!intent) return;
      event.preventDefault();
      performIntent(store, intent);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [store]);

  return useCallback(
    (input: KeyInput) => {
      const intent = resolveShortcut(input, { editingText: false });
      if (intent) performIntent(store, intent);
    },
    [store],
  );
}
