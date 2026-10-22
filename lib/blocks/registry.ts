import { benefits } from './benefits';
import { hero } from './hero';
import { testimonials } from './testimonials';
import type { AnyBlockDefinition } from './types';

// Every block type, one line each. Adding a block = its own folder + one line here (PRD §9).
export const BLOCKS = [hero, benefits, testimonials] as const;

export type RegisteredBlock = (typeof BLOCKS)[number];
export type BlockType = RegisteredBlock['type'];

const BY_TYPE: ReadonlyMap<string, AnyBlockDefinition> = new Map(
  BLOCKS.map((definition): [string, AnyBlockDefinition] => [definition.type, definition]),
);

export function getBlockDefinition(type: string): AnyBlockDefinition | undefined {
  return BY_TYPE.get(type);
}

export function listBlockDefinitions(): readonly AnyBlockDefinition[] {
  return BLOCKS;
}
