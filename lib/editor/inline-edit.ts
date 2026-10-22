import { getBlockDefinition } from '@/lib/blocks/registry';
import type { InlineNode } from './canvas/inline-nodes';
import { serializeInline, serializeText } from './inline-serialize';
import { describeFields, fieldError, fieldSpecAt, parseFieldPath } from './inspector/fields';
import type { EditorStore } from './store';
import { findBlock, getAtPath } from './structure';

// Text edited in the canvas (docs/DECISIONS.md D-044). The field path comes from the iframe, so
// it is checked against the block's schema: only text and rich fields that exist can be written,
// and the value goes through the same command as an inspector edit.

/** Validates the block and field, serializes, and dispatches one coalesced setBlockProp ('<blockId>:<path>'). */
export function applyInlineEdit(
  store: EditorStore,
  edit: { blockId: string; path: string; nodes: InlineNode[] },
): void {
  const { doc, dispatch, notify } = store.getState();
  const at = findBlock(doc, edit.blockId);
  const path = parseFieldPath(edit.path);
  if (!at || !path) return;
  const block = doc.sections[at.sectionIndex]!.blocks[at.blockIndex]!;
  const definition = getBlockDefinition(block.type);
  const spec = definition ? fieldSpecAt(describeFields(definition.schema), path) : null;
  if (!spec || (spec.kind !== 'text' && spec.kind !== 'rich')) return;
  if (typeof getAtPath(block.props, path) !== 'string') return;
  const value = spec.kind === 'rich' ? serializeInline(edit.nodes) : serializeText(edit.nodes);
  // The same key as the inspector's, so a typing run is one undo step wherever it happens.
  const result = dispatch(
    { type: 'setBlockProp', blockId: edit.blockId, path, value },
    { coalesceKey: `${edit.blockId}:${path.join('.')}` },
  );
  if (!result.ok && result.code !== 'noop') {
    notify(`${spec.label}: ${fieldError(spec, value) ?? result.reason}`);
  }
}

/** Editing ended in the canvas: the next edit starts a new undo step. */
export function finishInlineEdit(store: EditorStore): void {
  store.getState().endCoalescing();
}
