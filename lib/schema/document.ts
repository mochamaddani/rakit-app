import { z } from 'zod';
import { BLOCKS } from '@/lib/blocks/registry';
import type { BlockDefinition } from '@/lib/blocks/types';
import { DocumentValidationError, type DocumentIssue } from './errors';
import { IdSchema } from './ids';
import { CURRENT_SCHEMA_VERSION, migrateDocument } from './migrations';
import {
  BlockStyleSchema,
  SectionStyleSchema,
  type BlockStyle,
  type SectionStyle,
} from './primitives';
import { PageSettingsSchema, type PageSettings } from './settings';

export { CURRENT_SCHEMA_VERSION };

export const LIMITS = { sections: 60, blocksPerSection: 30, totalBlocks: 200 } as const;

// One variant per registered block type; the union's TS type is declared below as BlockInstance.
const blockVariants = BLOCKS.map((definition) =>
  z.object({
    id: IdSchema,
    type: z.literal(definition.type),
    props: definition.schema,
    style: BlockStyleSchema.prefault({}),
  }),
);
type BlockVariant = (typeof blockVariants)[number];
export const BlockInstanceSchema = z.discriminatedUnion(
  'type',
  blockVariants as unknown as [BlockVariant, ...BlockVariant[]],
);

type InstanceOf<D> =
  D extends BlockDefinition<infer T, infer S extends z.ZodType>
    ? { id: string; type: T; props: z.output<S>; style: BlockStyle }
    : never;
export type BlockInstance = InstanceOf<(typeof BLOCKS)[number]>;

/** Anchors are user slugs; `b-` and `s-` are reserved for generated DOM ids (D-028). */
const ANCHOR = /^(?![bs]-)[a-z][a-z0-9-]{0,40}$/;

export const SectionSchema = z.object({
  id: IdSchema,
  anchor: z.string().regex(ANCHOR).optional(),
  style: SectionStyleSchema.prefault({}),
  blocks: z.array(BlockInstanceSchema).max(LIMITS.blocksPerSection),
});

export interface Section {
  id: string;
  anchor?: string;
  style: SectionStyle;
  blocks: BlockInstance[];
}

export interface PageDocument {
  schemaVersion: typeof CURRENT_SCHEMA_VERSION;
  settings: PageSettings;
  sections: Section[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Duplicate ids would collide in DOM ids and carousel scoping: section and block ids must be
 * unique per document, item ids unique within their list. Reports the later occurrence.
 */
export function collectIdIssues(doc: unknown): DocumentIssue[] {
  const issues: DocumentIssue[] = [];
  const claim = (seen: Set<string>, id: unknown, path: string) => {
    if (typeof id !== 'string') return;
    if (seen.has(id)) issues.push({ path, message: `Duplicate id "${id}"` });
    else seen.add(id);
  };
  const walkLists = (value: unknown, path: string) => {
    if (Array.isArray(value)) {
      const seen = new Set<string>();
      value.forEach((item, i) => {
        if (isRecord(item)) claim(seen, item.id, `${path}.${i}.id`);
        walkLists(item, `${path}.${i}`);
      });
    } else if (isRecord(value)) {
      for (const [key, child] of Object.entries(value)) walkLists(child, `${path}.${key}`);
    }
  };

  if (!isRecord(doc) || !Array.isArray(doc.sections)) return issues;
  const sectionIds = new Set<string>();
  const blockIds = new Set<string>();
  doc.sections.forEach((section, si) => {
    if (!isRecord(section)) return;
    claim(sectionIds, section.id, `sections.${si}.id`);
    if (!Array.isArray(section.blocks)) return;
    section.blocks.forEach((block, bi) => {
      if (!isRecord(block)) return;
      claim(blockIds, block.id, `sections.${si}.blocks.${bi}.id`);
      walkLists(block.props, `sections.${si}.blocks.${bi}.props`);
    });
  });
  return issues;
}

const toPath = (dotted: string) => dotted.split('.').map((s) => (/^\d+$/.test(s) ? Number(s) : s));

export const PageDocumentSchema = z
  .object({
    schemaVersion: z.literal(CURRENT_SCHEMA_VERSION),
    settings: PageSettingsSchema.prefault({}),
    sections: z.array(SectionSchema).max(LIMITS.sections),
  })
  .superRefine((doc, ctx) => {
    for (const issue of collectIdIssues(doc)) {
      ctx.addIssue({ code: 'custom', message: issue.message, path: toPath(issue.path) });
    }
    const anchors = new Set<string>();
    doc.sections.forEach((section, i) => {
      if (section.anchor === undefined) return;
      if (anchors.has(section.anchor)) {
        ctx.addIssue({
          code: 'custom',
          message: `Duplicate anchor "${section.anchor}"`,
          path: ['sections', i, 'anchor'],
        });
      }
      anchors.add(section.anchor);
    });
    const total = doc.sections.reduce((sum, section) => sum + section.blocks.length, 0);
    if (total > LIMITS.totalBlocks) {
      ctx.addIssue({
        code: 'custom',
        message: `A page can hold at most ${LIMITS.totalBlocks} blocks`,
        path: ['sections'],
      });
    }
  });

function summarize(issues: readonly DocumentIssue[]): string {
  const [first] = issues;
  if (!first) return 'Invalid page document.';
  const more = issues.length > 1 ? ` (+${issues.length - 1} more)` : '';
  return `Invalid page document: ${first.path || '(root)'}: ${first.message}${more}`;
}

export function safeParseDocument(
  raw: unknown,
): { ok: true; doc: PageDocument } | { ok: false; error: DocumentValidationError } {
  let migrated: Record<string, unknown>;
  try {
    migrated = migrateDocument(raw);
  } catch (error) {
    if (error instanceof DocumentValidationError) return { ok: false, error };
    throw error;
  }
  const result = PageDocumentSchema.safeParse(migrated);
  if (result.success) return { ok: true, doc: result.data as unknown as PageDocument };
  const issues = result.error.issues.map((issue) => ({
    path: issue.path.map(String).join('.'),
    message: issue.message,
  }));
  return { ok: false, error: new DocumentValidationError(summarize(issues), issues) };
}

/** Migrates, then validates; throws DocumentValidationError with every issue. */
export function parseDocument(raw: unknown): PageDocument {
  const result = safeParseDocument(raw);
  if (!result.ok) throw result.error;
  return result.doc;
}

/** A new blank page: no sections and default settings. */
export function createEmptyDocument(): PageDocument {
  return parseDocument({ schemaVersion: CURRENT_SCHEMA_VERSION, sections: [] });
}
