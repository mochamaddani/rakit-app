import { applyPatches, enablePatches, type Patch } from 'immer';
import type { PageDocument } from '@/lib/schema/document';
import { selectionExists, type Selection } from './structure';

// Undo history as Immer patches (docs/DECISIONS.md D-038). Undo and redo apply patches and never
// re-run commands, so ids a command generated survive a redo.
enablePatches();

export const HISTORY_LIMIT = 200;
export const COALESCE_MS = 1000;

export interface HistoryEntry {
  label: string;
  patches: Patch[];
  inversePatches: Patch[];
  at: number;
  coalesceKey?: string;
  selectionBefore: Selection | null;
  selectionAfter: Selection | null;
}

export interface History {
  past: HistoryEntry[];
  future: HistoryEntry[];
}

export const emptyHistory: History = { past: [], future: [] };

const singleReplace = (patches: Patch[]) =>
  patches.length === 1 && patches[0]!.op === 'replace' ? patches[0]! : null;

const samePath = (a: Patch, b: Patch) =>
  a.path.length === b.path.length && a.path.every((key, i) => key === b.path[i]);

function merge(earlier: HistoryEntry, later: HistoryEntry): HistoryEntry {
  const a = singleReplace(earlier.patches);
  const b = singleReplace(later.patches);
  // Typing into one field: keep the latest value and the value from before the first keystroke.
  const compact = a !== null && b !== null && samePath(a, b);
  return {
    ...earlier,
    patches: compact ? later.patches : [...earlier.patches, ...later.patches],
    inversePatches: compact
      ? earlier.inversePatches
      : [...later.inversePatches, ...earlier.inversePatches],
    at: later.at,
    selectionAfter: later.selectionAfter,
  };
}

/** Clears `future`; merges same-key edits within COALESCE_MS of each other; caps the past. */
export function record(history: History, entry: HistoryEntry): History {
  const last = history.past.at(-1);
  if (
    last &&
    entry.coalesceKey !== undefined &&
    last.coalesceKey === entry.coalesceKey &&
    entry.at - last.at <= COALESCE_MS
  ) {
    return { past: [...history.past.slice(0, -1), merge(last, entry)], future: [] };
  }
  const past = [...history.past, entry];
  return { past: past.length > HISTORY_LIMIT ? past.slice(-HISTORY_LIMIT) : past, future: [] };
}

/** The last entry stops accepting merges (field blur, undo, redo). */
export function breakCoalescing(history: History): History {
  const last = history.past.at(-1);
  if (!last || last.coalesceKey === undefined) return history;
  const { coalesceKey: _ended, ...closed } = last;
  return { ...history, past: [...history.past.slice(0, -1), closed] };
}

export interface HistoryStep {
  history: History;
  doc: PageDocument;
  selection: Selection | null;
}

export function undo(history: History, doc: PageDocument): HistoryStep | null {
  const entry = history.past.at(-1);
  if (!entry) return null;
  const next = applyPatches(doc, entry.inversePatches);
  return {
    history: { past: history.past.slice(0, -1), future: [...history.future, entry] },
    doc: next,
    selection: selectionExists(next, entry.selectionBefore) ? entry.selectionBefore : null,
  };
}

export function redo(history: History, doc: PageDocument): HistoryStep | null {
  const entry = history.future.at(-1);
  if (!entry) return null;
  const next = applyPatches(doc, entry.patches);
  return {
    history: { past: [...history.past, entry], future: history.future.slice(0, -1) },
    doc: next,
    selection: selectionExists(next, entry.selectionAfter) ? entry.selectionAfter : null,
  };
}
