import { enablePatches, produceWithPatches, type Draft, type Patch } from 'immer';
import { z } from 'zod';
import { getBlockDefinition } from '@/lib/blocks/registry';
import type { AnyBlockDefinition } from '@/lib/blocks/types';
import { footerStart } from '@/lib/renderer/page';
import {
  LIMITS,
  SECTION_ANCHOR_PATTERN,
  type BlockInstance,
  type PageDocument,
  type Section,
} from '@/lib/schema/document';
import type { IdFactory } from '@/lib/schema/ids';
import { BlockStyleSchema, SectionStyleSchema } from '@/lib/schema/primitives';
import { PageSettingsSchema } from '@/lib/schema/settings';
import { schemaAt, unwrapSchema } from './schema-path';
import {
  blockTypeLabel,
  findBlock,
  findSection,
  getAtPath,
  withFreshIds,
  type BlockLocation,
  type Direction,
  type PropPath,
  type Selection,
} from './structure';

// Every editor change is one of these commands, applied with Immer patches so undo and redo are
// exact. A command that would leave the document invalid changes nothing (docs/DECISIONS.md D-037).
enablePatches();

export type EditorCommand =
  | { type: 'addBlock'; blockType: string }
  | { type: 'moveBlock'; blockId: string; direction: Direction }
  | { type: 'duplicateBlock'; blockId: string }
  | { type: 'removeBlock'; blockId: string }
  /** `value: undefined` deletes an optional key. */
  | { type: 'setBlockProp'; blockId: string; path: PropPath; value: unknown }
  | { type: 'setBlockStyle'; blockId: string; path: PropPath; value: unknown }
  | { type: 'moveSection'; sectionId: string; direction: Direction }
  | { type: 'duplicateSection'; sectionId: string }
  | { type: 'removeSection'; sectionId: string }
  | { type: 'setSectionStyle'; sectionId: string; path: PropPath; value: unknown }
  | { type: 'setSectionAnchor'; sectionId: string; anchor: string | undefined }
  | { type: 'setSetting'; path: PropPath; value: unknown }
  | { type: 'listInsert'; blockId: string; path: PropPath; index: number; item: unknown }
  | { type: 'listMove'; blockId: string; path: PropPath; from: number; to: number }
  | { type: 'listRemove'; blockId: string; path: PropPath; index: number }
  | { type: 'listDuplicate'; blockId: string; path: PropPath; index: number };

export interface CommandDeps {
  newId: IdFactory;
}

export interface CommandFailure {
  ok: false;
  code: 'not_found' | 'noop' | 'limit' | 'invalid';
  reason: string;
}

export interface CommandSuccess {
  ok: true;
  doc: PageDocument;
  patches: Patch[];
  inversePatches: Patch[];
  label: string;
  selection: Selection | null;
  announcement: string;
}

export type CommandResult = CommandSuccess | CommandFailure;

interface Meta {
  label: string;
  selection: Selection | null;
  announcement: string;
}

const fail = (code: CommandFailure['code'], reason: string): CommandFailure => ({
  ok: false,
  code,
  reason,
});

function commit(
  doc: PageDocument,
  recipe: (draft: Draft<PageDocument>) => void,
  meta: Meta,
): CommandSuccess {
  const [next, patches, inversePatches] = produceWithPatches(doc, recipe);
  return { ok: true, doc: next, patches, inversePatches, ...meta };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

const totalBlocks = (doc: PageDocument) =>
  doc.sections.reduce((sum, section) => sum + section.blocks.length, 0);

/** The first issue of a whole-object check; an over-long list is a limit, not invalid input. */
function checkWhole(schema: z.ZodType, value: unknown): CommandFailure | null {
  const result = z.safeParse(schema, value);
  if (result.success) return null;
  const issue = result.error.issues[0]!;
  if (issue.code === 'too_big' && issue.origin === 'array') {
    return fail('limit', `This list holds at most ${issue.maximum} items`);
  }
  return fail('invalid', issue.message);
}

type Edit = (target: unknown) => void;

/** Parses `value` with the schema declared at `path` and returns how to write it into a draft. */
function planEdit(
  root: z.ZodType,
  current: unknown,
  path: PropPath,
  value: unknown,
): Edit | CommandFailure {
  const key = path.at(-1);
  if (key === undefined) return fail('invalid', 'Nothing to edit');
  const parentPath = path.slice(0, -1);
  const parent = getAtPath(current, parentPath);
  const parentExists =
    typeof key === 'number'
      ? Array.isArray(parent) && Number.isInteger(key) && key >= 0 && key < parent.length
      : isRecord(parent);
  if (!parentExists) return fail('invalid', `Nothing to edit at ${path.join('.')}`);
  const declared = schemaAt(root, path, current);
  if (!declared) return fail('invalid', `Unknown field ${path.join('.')}`);

  if (value === undefined) {
    if (!(declared instanceof z.ZodOptional)) return fail('invalid', 'This field is required');
    return (target) => {
      delete (getAtPath(target, parentPath) as Record<string, unknown>)[String(key)];
    };
  }
  const parsed = z.safeParse(declared, value);
  if (!parsed.success) return fail('invalid', parsed.error.issues[0]?.message ?? 'Invalid value');
  return (target) => {
    (getAtPath(target, parentPath) as Record<string | number, unknown>)[key] = parsed.data;
  };
}

interface FoundBlock extends BlockLocation {
  block: BlockInstance;
  definition: AnyBlockDefinition;
  label: string;
}

function locateBlock(doc: PageDocument, blockId: string): FoundBlock | null {
  const at = findBlock(doc, blockId);
  if (!at) return null;
  const block = doc.sections[at.sectionIndex]!.blocks[at.blockIndex]!;
  const definition = getBlockDefinition(block.type);
  if (!definition) return null;
  return { ...at, block, definition, label: blockTypeLabel(block.type) };
}

const draftBlock = (draft: Draft<PageDocument>, at: BlockLocation) =>
  draft.sections[at.sectionIndex]!.blocks[at.blockIndex]!;
const blockAt = (doc: PageDocument, at: BlockLocation) =>
  doc.sections[at.sectionIndex]!.blocks[at.blockIndex]!;

const BLOCK_GONE = 'That block no longer exists';
const SECTION_GONE = 'That section no longer exists';

/** A copy of a section with a new section id, new block ids and no anchor (anchors are unique). */
function copySection(section: Section, newId: IdFactory): Section {
  const id = newId();
  return {
    id,
    style: { ...section.style },
    blocks: section.blocks.map((block) => ({ ...structuredClone(block), id: newId() })),
  };
}

export function applyCommand(
  doc: PageDocument,
  command: EditorCommand,
  selection: Selection | null,
  deps: CommandDeps,
): CommandResult {
  switch (command.type) {
    case 'addBlock':
      return addBlock(doc, command.blockType, selection, deps);
    case 'moveBlock':
      return moveBlock(doc, command.blockId, command.direction, selection, deps);
    case 'duplicateBlock':
      return duplicateBlock(doc, command.blockId, deps);
    case 'removeBlock':
      return removeBlock(doc, command.blockId);
    case 'setBlockProp':
    case 'setBlockStyle': {
      const found = locateBlock(doc, command.blockId);
      if (!found) return fail('not_found', BLOCK_GONE);
      const isProp = command.type === 'setBlockProp';
      const schema = isProp ? found.definition.schema : BlockStyleSchema;
      const current = isProp ? found.block.props : found.block.style;
      const edit = planEdit(schema, current, command.path, command.value);
      if (typeof edit !== 'function') return edit;
      const result = commit(
        doc,
        (draft) => {
          const target = draftBlock(draft, found);
          edit(isProp ? target.props : target.style);
        },
        {
          label: isProp ? `Edit ${found.label}` : `Edit ${found.label} style`,
          selection,
          announcement: '',
        },
      );
      const next = blockAt(result.doc, found);
      return checkWhole(schema, isProp ? next.props : next.style) ?? result;
    }
    case 'moveSection':
      return moveSection(doc, command.sectionId, command.direction, selection);
    case 'duplicateSection': {
      const index = findSection(doc, command.sectionId);
      if (index < 0) return fail('not_found', SECTION_GONE);
      const section = doc.sections[index]!;
      const limit = roomFor(doc, section.blocks.length);
      if (limit) return limit;
      const copy = copySection(section, deps.newId);
      return commit(doc, (draft) => void draft.sections.splice(index + 1, 0, copy), {
        label: 'Duplicate section',
        selection: { kind: 'section', sectionId: copy.id },
        announcement: 'Duplicated section',
      });
    }
    case 'removeSection': {
      const index = findSection(doc, command.sectionId);
      if (index < 0) return fail('not_found', SECTION_GONE);
      const neighbour = doc.sections[index + 1] ?? doc.sections[index - 1];
      return commit(doc, (draft) => void draft.sections.splice(index, 1), {
        label: 'Delete section',
        selection: neighbour ? { kind: 'section', sectionId: neighbour.id } : null,
        announcement: 'Deleted section',
      });
    }
    case 'setSectionStyle': {
      const index = findSection(doc, command.sectionId);
      if (index < 0) return fail('not_found', SECTION_GONE);
      const edit = planEdit(
        SectionStyleSchema,
        doc.sections[index]!.style,
        command.path,
        command.value,
      );
      if (typeof edit !== 'function') return edit;
      const result = commit(doc, (draft) => edit(draft.sections[index]!.style), {
        label: 'Edit section style',
        selection,
        announcement: '',
      });
      return checkWhole(SectionStyleSchema, result.doc.sections[index]!.style) ?? result;
    }
    case 'setSectionAnchor':
      return setSectionAnchor(doc, command.sectionId, command.anchor, selection);
    case 'setSetting': {
      const edit = planEdit(PageSettingsSchema, doc.settings, command.path, command.value);
      if (typeof edit !== 'function') return edit;
      const result = commit(doc, (draft) => edit(draft.settings), {
        label: 'Edit page settings',
        selection,
        announcement: '',
      });
      return checkWhole(PageSettingsSchema, result.doc.settings) ?? result;
    }
    case 'listInsert':
    case 'listMove':
    case 'listRemove':
    case 'listDuplicate':
      return editList(doc, command, selection, deps);
  }
}

/** A limit failure when the page cannot take one more section holding `blocks` blocks. */
function roomFor(doc: PageDocument, blocks: number): CommandFailure | null {
  if (doc.sections.length >= LIMITS.sections) {
    return fail('limit', `A page holds at most ${LIMITS.sections} sections`);
  }
  if (totalBlocks(doc) + blocks > LIMITS.totalBlocks) {
    return fail('limit', `A page holds at most ${LIMITS.totalBlocks} blocks`);
  }
  return null;
}

function addBlock(
  doc: PageDocument,
  blockType: string,
  selection: Selection | null,
  deps: CommandDeps,
): CommandResult {
  const definition = getBlockDefinition(blockType);
  if (!definition) return fail('not_found', `Unknown block type "${blockType}"`);
  const limit = roomFor(doc, 1);
  if (limit) return limit;

  const end = footerStart(doc);
  let index: number;
  if (definition.landmark === 'footer') {
    index = doc.sections.length;
  } else {
    const selected =
      selection?.kind === 'block'
        ? (findBlock(doc, selection.blockId)?.sectionIndex ?? -1)
        : selection?.kind === 'section'
          ? findSection(doc, selection.sectionId)
          : -1;
    index = selected >= 0 ? Math.min(selected + 1, end) : end;
  }
  // Ids in a fixed order: section, block, then the block's own items.
  const sectionId = deps.newId();
  const blockId = deps.newId();
  const block = {
    id: blockId,
    type: definition.type,
    props: definition.defaultProps(deps.newId),
    style: BlockStyleSchema.parse({}),
  } as BlockInstance;
  const section: Section = { id: sectionId, style: SectionStyleSchema.parse({}), blocks: [block] };
  const label = definition.label;
  return commit(doc, (draft) => void draft.sections.splice(index, 0, section), {
    label: `Add ${label}`,
    selection: { kind: 'block', blockId },
    announcement: `Added ${label}`,
  });
}

function moveBlock(
  doc: PageDocument,
  blockId: string,
  direction: Direction,
  selection: Selection | null,
  deps: CommandDeps,
): CommandResult {
  const found = locateBlock(doc, blockId);
  if (!found) return fail('not_found', BLOCK_GONE);
  const { sectionIndex, blockIndex, label } = found;
  const section = doc.sections[sectionIndex]!;
  const step = direction === 'up' ? -1 : 1;
  const meta = (announcement: string): Meta => ({
    label: `Move ${label} ${direction}`,
    selection,
    announcement,
  });

  // Alone in its section: the block and its band move together.
  if (section.blocks.length === 1) {
    const target = sectionIndex + step;
    if (target < 0 || target >= doc.sections.length) {
      return fail('noop', `${label} is already at the ${direction === 'up' ? 'top' : 'bottom'}`);
    }
    return commit(
      doc,
      (draft) => {
        const [moved] = draft.sections.splice(sectionIndex, 1);
        draft.sections.splice(target, 0, moved!);
      },
      meta(`Moved ${label} ${direction}, now section ${target + 1} of ${doc.sections.length}`),
    );
  }

  const target = blockIndex + step;
  if (target >= 0 && target < section.blocks.length) {
    return commit(
      doc,
      (draft) => {
        const blocks = draft.sections[sectionIndex]!.blocks;
        const [moved] = blocks.splice(blockIndex, 1);
        blocks.splice(target, 0, moved!);
      },
      meta(
        `Moved ${label} ${direction}, now block ${target + 1} of ${section.blocks.length} in its section`,
      ),
    );
  }

  // At the edge of a shared section: leave into a new band with the same style (never merge).
  if (doc.sections.length >= LIMITS.sections) {
    return fail('limit', `A page holds at most ${LIMITS.sections} sections`);
  }
  const newSectionId = deps.newId();
  const insertAt = direction === 'up' ? sectionIndex : sectionIndex + 1;
  return commit(
    doc,
    (draft) => {
      const [moved] = draft.sections[sectionIndex]!.blocks.splice(blockIndex, 1);
      draft.sections.splice(insertAt, 0, {
        id: newSectionId,
        style: { ...section.style },
        blocks: [moved!],
      });
    },
    meta(`Moved ${label} ${direction} into its own section`),
  );
}

function duplicateBlock(doc: PageDocument, blockId: string, deps: CommandDeps): CommandResult {
  const found = locateBlock(doc, blockId);
  if (!found) return fail('not_found', BLOCK_GONE);
  const { sectionIndex, blockIndex, label } = found;
  const section = doc.sections[sectionIndex]!;
  const meta = (copyId: string): Meta => ({
    label: `Duplicate ${label}`,
    selection: { kind: 'block', blockId: copyId },
    announcement: `Duplicated ${label}`,
  });

  if (section.blocks.length === 1) {
    const limit = roomFor(doc, 1);
    if (limit) return limit;
    const copy = copySection(section, deps.newId);
    return commit(
      doc,
      (draft) => void draft.sections.splice(sectionIndex + 1, 0, copy),
      meta(copy.blocks[0]!.id),
    );
  }
  if (section.blocks.length >= LIMITS.blocksPerSection) {
    return fail('limit', `A section holds at most ${LIMITS.blocksPerSection} blocks`);
  }
  if (totalBlocks(doc) >= LIMITS.totalBlocks) {
    return fail('limit', `A page holds at most ${LIMITS.totalBlocks} blocks`);
  }
  const copy = { ...structuredClone(found.block), id: deps.newId() };
  return commit(
    doc,
    (draft) => void draft.sections[sectionIndex]!.blocks.splice(blockIndex + 1, 0, copy),
    meta(copy.id),
  );
}

function removeBlock(doc: PageDocument, blockId: string): CommandResult {
  const found = locateBlock(doc, blockId);
  if (!found) return fail('not_found', BLOCK_GONE);
  const { sectionIndex, blockIndex, label } = found;
  const reading = doc.sections.flatMap((section) => section.blocks.map((block) => block.id));
  const position = reading.indexOf(blockId);
  const neighbour = reading[position + 1] ?? reading[position - 1];
  return commit(
    doc,
    (draft) => {
      const blocks = draft.sections[sectionIndex]!.blocks;
      blocks.splice(blockIndex, 1);
      if (blocks.length === 0) draft.sections.splice(sectionIndex, 1);
    },
    {
      label: `Delete ${label}`,
      selection: neighbour ? { kind: 'block', blockId: neighbour } : null,
      announcement: `Deleted ${label}`,
    },
  );
}

function moveSection(
  doc: PageDocument,
  sectionId: string,
  direction: Direction,
  selection: Selection | null,
): CommandResult {
  const index = findSection(doc, sectionId);
  if (index < 0) return fail('not_found', SECTION_GONE);
  const target = direction === 'up' ? index - 1 : index + 1;
  if (target < 0 || target >= doc.sections.length) {
    return fail('noop', `The section is already at the ${direction === 'up' ? 'top' : 'bottom'}`);
  }
  return commit(
    doc,
    (draft) => {
      const [moved] = draft.sections.splice(index, 1);
      draft.sections.splice(target, 0, moved!);
    },
    {
      label: `Move section ${direction}`,
      selection,
      announcement: `Moved section ${direction}, now ${target + 1} of ${doc.sections.length}`,
    },
  );
}

function setSectionAnchor(
  doc: PageDocument,
  sectionId: string,
  anchor: string | undefined,
  selection: Selection | null,
): CommandResult {
  const index = findSection(doc, sectionId);
  if (index < 0) return fail('not_found', SECTION_GONE);
  if (anchor !== undefined) {
    if (!SECTION_ANCHOR_PATTERN.test(anchor)) {
      return fail(
        'invalid',
        'Use lowercase letters, digits and dashes, starting with a letter (b- and s- are reserved)',
      );
    }
    if (doc.sections.some((section, i) => i !== index && section.anchor === anchor)) {
      return fail('invalid', `Another section already uses #${anchor}`);
    }
  }
  return commit(
    doc,
    (draft) => {
      const section = draft.sections[index]!;
      if (anchor === undefined) delete section.anchor;
      else section.anchor = anchor;
    },
    { label: 'Edit section anchor', selection, announcement: '' },
  );
}

type ListCommand = Extract<
  EditorCommand,
  { type: 'listInsert' | 'listMove' | 'listRemove' | 'listDuplicate' }
>;

function editList(
  doc: PageDocument,
  command: ListCommand,
  selection: Selection | null,
  deps: CommandDeps,
): CommandResult {
  const found = locateBlock(doc, command.blockId);
  if (!found) return fail('not_found', BLOCK_GONE);
  const list = getAtPath(found.block.props, command.path);
  const declared = schemaAt(found.definition.schema, command.path, found.block.props);
  const array = declared && unwrapSchema(declared);
  if (!Array.isArray(list) || !(array instanceof z.ZodArray)) return fail('invalid', 'Not a list');
  const inRange = (i: number, max = list.length - 1) => Number.isInteger(i) && i >= 0 && i <= max;
  const draftList = (draft: Draft<PageDocument>) =>
    getAtPath(draftBlock(draft, found).props, command.path) as unknown[];
  const meta = (label: string, announcement: string): Meta => ({ label, selection, announcement });

  let result: CommandSuccess;
  switch (command.type) {
    case 'listInsert': {
      if (!inRange(command.index, list.length)) return fail('invalid', 'No such position');
      const parsed = z.safeParse(array.element, command.item);
      if (!parsed.success) {
        return fail('invalid', parsed.error.issues[0]?.message ?? 'Invalid item');
      }
      result = commit(
        doc,
        (draft) => void draftList(draft).splice(command.index, 0, parsed.data),
        meta('Add item', `Added item ${command.index + 1}`),
      );
      break;
    }
    case 'listMove': {
      if (!inRange(command.from) || !inRange(command.to)) return fail('invalid', 'No such item');
      if (command.from === command.to) return fail('noop', 'The item is already there');
      result = commit(
        doc,
        (draft) => {
          const items = draftList(draft);
          const [moved] = items.splice(command.from, 1);
          items.splice(command.to, 0, moved);
        },
        meta('Move item', `Moved item to position ${command.to + 1}`),
      );
      break;
    }
    case 'listRemove': {
      if (!inRange(command.index)) return fail('invalid', 'No such item');
      result = commit(
        doc,
        (draft) => void draftList(draft).splice(command.index, 1),
        meta('Delete item', 'Deleted item'),
      );
      break;
    }
    case 'listDuplicate': {
      if (!inRange(command.index)) return fail('invalid', 'No such item');
      const copy = withFreshIds(list[command.index], deps.newId);
      result = commit(
        doc,
        (draft) => void draftList(draft).splice(command.index + 1, 0, copy),
        meta('Duplicate item', `Duplicated item ${command.index + 1}`),
      );
      break;
    }
  }
  return checkWhole(found.definition.schema, blockAt(result.doc, found).props) ?? result;
}
