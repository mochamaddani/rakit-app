import type { ReactNode } from 'react';
import type { AnyBlockDefinition } from '@/lib/blocks/types';
import type { CommandResult } from '@/lib/editor/commands';
import type { FieldSpec } from '@/lib/editor/inspector/fields';
import type { PropPath } from '@/lib/editor/structure';
import type { PageDocument } from '@/lib/schema/document';

/** What a panel lets its fields do; every write is a store command, so undo covers it. */
export interface FieldActions {
  /** The panel adds the coalescing key `<target>:<path>`, so typing is one undo step. */
  set(path: PropPath, value: unknown): CommandResult;
  /** Ends the typing run (blur). */
  endEdit(): void;
  listInsert(path: PropPath, index: number, item: unknown): CommandResult;
  /** Bulk paste: every item in one undo step. */
  listInsertMany(path: PropPath, index: number, items: unknown[]): CommandResult;
  listMove(path: PropPath, from: number, to: number): CommandResult;
  listRemove(path: PropPath, index: number): CommandResult;
  listDuplicate(path: PropPath, index: number): CommandResult;
}

export interface FieldContext {
  doc: PageDocument;
  /** The block being edited, for sample values (null for section and page settings). */
  definition: AnyBlockDefinition | null;
  /** Prefix for element ids, unique per panel. */
  idPrefix: string;
  /** Extra content under a field (the page panel's contrast hints). */
  renderExtra?(spec: FieldSpec, path: PropPath): ReactNode;
}

export interface ControlProps<S extends FieldSpec = FieldSpec> {
  spec: S;
  value: unknown;
  path: PropPath;
  actions: FieldActions;
  context: FieldContext;
}

export const fieldId = (context: FieldContext, path: PropPath) =>
  `${context.idPrefix}-${path.join('-') || 'root'}`;
