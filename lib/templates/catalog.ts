import { z } from 'zod';
import { safeParseDocument, type PageDocument } from '@/lib/schema/document';
import { DEFAULT_THEME } from '@/lib/schema/theme';
import { BUILTIN_TEMPLATES } from './builtin';
import { normalizeCategory, type TemplateCategory } from './categories';

// Built-in templates (code) and saved templates (the `templates` table) as one list for the
// gallery (docs/DECISIONS.md D-055). Form values name a template by its built-in id or row UUID.

export type TemplateRef = { kind: 'builtin'; id: string } | { kind: 'saved'; id: string };

export function parseTemplateRef(value: unknown): TemplateRef | null {
  if (z.uuid().safeParse(value).success) return { kind: 'saved', id: value as string };
  if (typeof value === 'string' && BUILTIN_TEMPLATES.some((template) => template.id === value))
    return { kind: 'builtin', id: value };
  return null;
}

export interface TemplateSummary {
  /** The form value: a built-in id or a saved template's UUID. */
  ref: string;
  kind: 'builtin' | 'saved';
  name: string;
  /** As stored; unknown categories are filed under 'other'. */
  category: string;
  description: string;
  sectionCount: number;
  colors: { primary: string; accent: string; surface: string };
}

export function loadTemplateDocument(
  raw: unknown,
): { ok: true; doc: PageDocument } | { ok: false } {
  const result = safeParseDocument(raw);
  return result.ok ? { ok: true, doc: result.doc } : { ok: false };
}

export function summarizeDocument(raw: unknown): Pick<TemplateSummary, 'sectionCount' | 'colors'> {
  const loaded = loadTemplateDocument(raw);
  const doc = loaded.ok ? loaded.doc : null;
  const { primary, accent, surface } = (doc?.settings.theme ?? DEFAULT_THEME).colors;
  return { sectionCount: doc?.sections.length ?? 0, colors: { primary, accent, surface } };
}

export function builtinSummaries(): TemplateSummary[] {
  return BUILTIN_TEMPLATES.map((template) => ({
    ref: template.id,
    kind: 'builtin',
    name: template.name,
    category: template.category,
    description: template.description,
    ...summarizeDocument(template.document()),
  }));
}

/** One category's templates, or all of them for null. */
export function filterTemplates(
  list: readonly TemplateSummary[],
  category: TemplateCategory | null,
): TemplateSummary[] {
  return category === null
    ? [...list]
    : list.filter((template) => normalizeCategory(template.category) === category);
}
