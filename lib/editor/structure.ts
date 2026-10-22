import { getBlockDefinition } from '@/lib/blocks/registry';
import { LIMITS, type PageDocument } from '@/lib/schema/document';
import type { IdFactory } from '@/lib/schema/ids';

// Read-only helpers over a PageDocument, shared by commands, the store and the editor UI.

export type Selection =
  { kind: 'block'; blockId: string } | { kind: 'section'; sectionId: string } | { kind: 'page' };

export type PropPath = readonly (string | number)[];
export type Direction = 'up' | 'down';

export interface BlockLocation {
  sectionIndex: number;
  blockIndex: number;
}

export function findBlock(doc: PageDocument, blockId: string): BlockLocation | null {
  for (let sectionIndex = 0; sectionIndex < doc.sections.length; sectionIndex += 1) {
    const blockIndex = doc.sections[sectionIndex]!.blocks.findIndex((b) => b.id === blockId);
    if (blockIndex >= 0) return { sectionIndex, blockIndex };
  }
  return null;
}

/** -1 when missing. */
export function findSection(doc: PageDocument, sectionId: string): number {
  return doc.sections.findIndex((section) => section.id === sectionId);
}

export function canMoveSection(
  doc: PageDocument,
  sectionId: string,
  direction: Direction,
): boolean {
  const index = findSection(doc, sectionId);
  if (index < 0) return false;
  const target = direction === 'up' ? index - 1 : index + 1;
  return target >= 0 && target < doc.sections.length;
}

/** Mirrors moveBlock (D-037): a lone block moves its section; a shared one moves or leaves it. */
export function canMoveBlock(doc: PageDocument, blockId: string, direction: Direction): boolean {
  const at = findBlock(doc, blockId);
  if (!at) return false;
  const section = doc.sections[at.sectionIndex]!;
  if (section.blocks.length === 1) return canMoveSection(doc, section.id, direction);
  const atEdge =
    direction === 'up' ? at.blockIndex === 0 : at.blockIndex === section.blocks.length - 1;
  return !atEdge || doc.sections.length < LIMITS.sections;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** The value at `path`, or undefined when any step is missing. Own properties only. */
export function getAtPath(value: unknown, path: PropPath): unknown {
  let current = value;
  for (const key of path) {
    if (typeof key === 'number') {
      if (!Array.isArray(current)) return undefined;
      current = current[key];
    } else {
      if (!isRecord(current) || !Object.hasOwn(current, key)) return undefined;
      current = current[key];
    }
  }
  return current;
}

/** Deep copy in which every object with a string `id` gets newId(). */
export function withFreshIds<T>(value: T, newId: IdFactory): T {
  const copy = (current: unknown): unknown => {
    if (Array.isArray(current)) return current.map(copy);
    if (!isRecord(current)) return current;
    const out: Record<string, unknown> = {};
    for (const [key, child] of Object.entries(current)) {
      out[key] = key === 'id' && typeof child === 'string' ? newId() : copy(child);
    }
    return out;
  };
  return copy(value) as T;
}

export function selectionExists(doc: PageDocument, selection: Selection | null): boolean {
  if (!selection) return false;
  if (selection.kind === 'block') return findBlock(doc, selection.blockId) !== null;
  if (selection.kind === 'section') return findSection(doc, selection.sectionId) >= 0;
  return true;
}

/** The registry label ("Product Carousel"), or the type itself when unknown. */
export function blockTypeLabel(type: string): string {
  return getBlockDefinition(type)?.label ?? type;
}
