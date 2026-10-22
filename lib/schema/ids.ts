import { z } from 'zod';

/**
 * Letters and digits only: DOM ids join ids with '-' ('b-<block>-<item>'), so a '-' inside an id
 * could make two different ids produce the same DOM id (docs/DECISIONS.md D-028).
 */
export const IdSchema = z.string().regex(/^[A-Za-z0-9]{1,32}$/);

export type IdFactory = () => string;

const ID_ALPHABET = 'abcdefghijklmnopqrstuvwxyz0123456789';
const ID_LENGTH = 10;

export const createId: IdFactory = () => {
  const bytes = crypto.getRandomValues(new Uint8Array(ID_LENGTH));
  let id = '';
  for (const byte of bytes) id += ID_ALPHABET.charAt(byte % ID_ALPHABET.length);
  return id;
};

/** Deterministic ids for tests and fixtures: 'id1', 'id2', … */
export function sequentialIds(prefix = 'id'): IdFactory {
  let n = 0;
  return () => `${prefix}${++n}`;
}
