import { DocumentValidationError } from './errors';

export const CURRENT_SCHEMA_VERSION = 2;

export type Migration = (doc: Record<string, unknown>) => Record<string, unknown>;

/**
 * Key n migrates a document from schema version n to n + 1. Only breaking changes need one;
 * additive fields rely on Zod defaults (docs/DECISIONS.md D-029).
 */
export const MIGRATIONS: Readonly<Record<number, Migration>> = {
  1: removeCookieBanners,
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

const isCookieBanner = (block: unknown) => isRecord(block) && block.type === 'cookie-banner';

/**
 * 1 → 2: the Cookie banner block is gone (docs/DECISIONS.md D-057). Its blocks are dropped, and so
 * is a section that held nothing else, so no empty band is left behind.
 */
function removeCookieBanners(doc: Record<string, unknown>): Record<string, unknown> {
  if (!Array.isArray(doc.sections)) return { ...doc, schemaVersion: 2 };
  const sections = doc.sections.flatMap((section: unknown) => {
    if (!isRecord(section) || !Array.isArray(section.blocks)) return [section];
    if (!section.blocks.some(isCookieBanner)) return [section];
    const blocks = section.blocks.filter((block: unknown) => !isCookieBanner(block));
    return blocks.length === 0 ? [] : [{ ...section, blocks }];
  });
  return { ...doc, schemaVersion: 2, sections };
}

/** Upgrades a stored document to `target` without validating it; never mutates `raw`. */
export function migrateDocument(
  raw: unknown,
  migrations: Readonly<Record<number, Migration>> = MIGRATIONS,
  target: number = CURRENT_SCHEMA_VERSION,
): Record<string, unknown> {
  if (!isRecord(raw)) {
    throw new DocumentValidationError('A page document must be a JSON object.', [
      { path: '', message: 'Expected an object' },
    ]);
  }
  const declared = raw.schemaVersion ?? 0;
  if (typeof declared !== 'number' || !Number.isInteger(declared) || declared < 0) {
    throw new DocumentValidationError('schemaVersion must be a non-negative integer.', [
      { path: 'schemaVersion', message: 'Expected a non-negative integer' },
    ]);
  }
  if (declared > target) {
    throw new DocumentValidationError(
      `This document was saved by a newer app version (schema ${declared}); this app reads up to ${target}.`,
      [{ path: 'schemaVersion', message: `Schema ${declared} is newer than ${target}` }],
    );
  }

  let doc = structuredClone(raw);
  for (let version = declared; version < target; version += 1) {
    const step = migrations[version];
    if (!step) {
      throw new DocumentValidationError(`no migration from version ${version} to ${version + 1}`);
    }
    doc = step(doc);
  }
  return doc;
}
