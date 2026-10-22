import type { KeyInput } from './canvas/constants';
import type { EditorStore } from './store';
import { findBlock } from './structure';

export type EditorIntent =
  'undo' | 'redo' | 'delete' | 'duplicate' | 'moveUp' | 'moveDown' | 'escape';

/**
 * Undo and redo work everywhere, text fields included: the store is the source of truth. Every
 * other shortcut is off while the user is typing.
 */
export function resolveShortcut(
  { key, mod, shift, alt }: KeyInput,
  { editingText }: { editingText: boolean },
): EditorIntent | null {
  const letter = key.toLowerCase();
  if (mod && !alt && letter === 'z') return shift ? 'redo' : 'undo';
  if (mod && !alt && letter === 'y') return 'redo';
  if (editingText) return null;
  if (mod && !alt && letter === 'd') return 'duplicate';
  if (alt && !mod && key === 'ArrowUp') return 'moveUp';
  if (alt && !mod && key === 'ArrowDown') return 'moveDown';
  if (!mod && !alt && (key === 'Delete' || key === 'Backspace')) return 'delete';
  if (key === 'Escape') return 'escape';
  return null;
}

/** Applies an intent to the current selection: a block, a section, or (Escape) the next level up. */
export function performIntent(store: EditorStore, intent: EditorIntent): void {
  const state = store.getState();
  if (intent === 'undo') {
    state.undo();
    return;
  }
  if (intent === 'redo') {
    state.redo();
    return;
  }
  const { selection, doc } = state;
  if (intent === 'escape') {
    const at = selection?.kind === 'block' ? findBlock(doc, selection.blockId) : null;
    state.select(at ? { kind: 'section', sectionId: doc.sections[at.sectionIndex]!.id } : null);
    return;
  }
  const direction = intent === 'moveUp' ? 'up' : 'down';
  if (selection?.kind === 'block') {
    const { blockId } = selection;
    if (intent === 'delete') state.dispatch({ type: 'removeBlock', blockId });
    else if (intent === 'duplicate') state.dispatch({ type: 'duplicateBlock', blockId });
    else state.dispatch({ type: 'moveBlock', blockId, direction });
  } else if (selection?.kind === 'section') {
    const { sectionId } = selection;
    if (intent === 'delete') state.dispatch({ type: 'removeSection', sectionId });
    else if (intent === 'duplicate') state.dispatch({ type: 'duplicateSection', sectionId });
    else state.dispatch({ type: 'moveSection', sectionId, direction });
  }
}
