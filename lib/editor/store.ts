import { createStore, type StoreApi } from 'zustand/vanilla';
import type { PageDocument } from '@/lib/schema/document';
import { createId, type IdFactory } from '@/lib/schema/ids';
import { applyCommand, type CommandResult, type EditorCommand } from './commands';
import {
  breakCoalescing,
  emptyHistory,
  record,
  redo as redoStep,
  undo as undoStep,
  type History,
  type HistoryStep,
} from './history';
import type { Selection } from './structure';

// The editor's single source of truth. A vanilla store, so Node tests drive it directly and
// React reads it with `useStore` (components/editor).

export type Viewport = 'mobile' | 'tablet' | 'desktop';

export const VIEWPORT_WIDTHS: Record<Viewport, number> = {
  mobile: 390,
  tablet: 768,
  desktop: 1280,
};

export interface EditorState {
  readonly pageId: string;
  doc: PageDocument;
  /** +1 on every document change: dispatch, undo, redo. */
  version: number;
  selection: Selection | null;
  history: History;
  viewport: Viewport;
  /** Text for the aria-live region; the latest command's announcement. */
  announcement: string;
  /** A visible notice for `limit` failures; cleared by the next successful command. */
  notice: string | null;
}

export interface EditorActions {
  dispatch(command: EditorCommand, options?: { coalesceKey?: string }): CommandResult;
  undo(): boolean;
  redo(): boolean;
  select(selection: Selection | null): void;
  /** Sets the aria-live text without a command (drag start and cancel). */
  announce(text: string): void;
  setViewport(viewport: Viewport): void;
  endCoalescing(): void;
}

export type EditorStore = StoreApi<EditorState & EditorActions>;

export function createEditorStore(
  init: { pageId: string; doc: PageDocument },
  deps: { newId?: IdFactory; now?: () => number } = {},
): EditorStore {
  const newId = deps.newId ?? createId;
  const now = deps.now ?? Date.now;

  return createStore<EditorState & EditorActions>()((set, get) => {
    const step = (result: HistoryStep | null, announcement: string): boolean => {
      if (!result) return false;
      set({
        doc: result.doc,
        // An undo or redo is a boundary: typing afterwards starts a new step.
        history: breakCoalescing(result.history),
        selection: result.selection,
        version: get().version + 1,
        announcement,
        notice: null,
      });
      return true;
    };

    return {
      pageId: init.pageId,
      doc: init.doc,
      version: 0,
      selection: null,
      history: emptyHistory,
      viewport: 'mobile',
      announcement: '',
      notice: null,

      dispatch(command, options = {}) {
        const state = get();
        const result = applyCommand(state.doc, command, state.selection, { newId });
        if (!result.ok) {
          if (result.code === 'limit') set({ notice: result.reason, announcement: result.reason });
          return result;
        }
        set({
          doc: result.doc,
          version: state.version + 1,
          selection: result.selection,
          history: record(state.history, {
            label: result.label,
            patches: result.patches,
            inversePatches: result.inversePatches,
            at: now(),
            coalesceKey: options.coalesceKey,
            selectionBefore: state.selection,
            selectionAfter: result.selection,
          }),
          announcement: result.announcement,
          notice: null,
        });
        return result;
      },

      undo() {
        const { history, doc } = get();
        const label = history.past.at(-1)?.label;
        return step(undoStep(history, doc), label ? `Undid ${label}` : '');
      },

      redo() {
        const { history, doc } = get();
        const label = history.future.at(-1)?.label;
        return step(redoStep(history, doc), label ? `Redid ${label}` : '');
      },

      announce(text) {
        set({ announcement: text });
      },

      select(selection) {
        set({ selection });
      },

      setViewport(viewport) {
        set({ viewport });
      },

      endCoalescing() {
        set({ history: breakCoalescing(get().history) });
      },
    };
  });
}
