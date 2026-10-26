import { z } from 'zod';

// Template categories (docs/DECISIONS.md D-055). The list lives here, not in the database, which
// only checks the slug shape; a saved template with an unknown category shows as "Other".

export const TEMPLATE_CATEGORIES = [
  { id: 'herbal', label: 'Herbal & health' },
  { id: 'fashion', label: 'Fashion' },
  { id: 'beauty', label: 'Beauty & skincare' },
  { id: 'food', label: 'Food & drink' },
  { id: 'home', label: 'Home & living' },
  { id: 'gadget', label: 'Gadgets & electronics' },
  { id: 'digital', label: 'Courses & digital' },
  { id: 'other', label: 'Other' },
] as const;

export type TemplateCategory = (typeof TEMPLATE_CATEGORIES)[number]['id'];

export const TemplateCategorySchema = z.enum(
  TEMPLATE_CATEGORIES.map((category) => category.id) as [TemplateCategory, ...TemplateCategory[]],
);

export function parseCategory(value: unknown): TemplateCategory | null {
  const result = TemplateCategorySchema.safeParse(value);
  return result.success ? result.data : null;
}

/** A known category, or 'other' for anything else. */
export function normalizeCategory(value: string): TemplateCategory {
  return parseCategory(value) ?? 'other';
}

export function categoryLabel(id: string): string {
  const category = normalizeCategory(id);
  return TEMPLATE_CATEGORIES.find((entry) => entry.id === category)!.label;
}
