import { describe, expect, it } from 'vitest';
import { DEFAULT_THEME } from '@/lib/schema/theme';
import { BUILTIN_TEMPLATES } from './builtin';
import {
  builtinSummaries,
  filterTemplates,
  loadTemplateDocument,
  parseTemplateRef,
  summarizeDocument,
  type TemplateSummary,
} from './catalog';
import { categoryLabel, parseCategory, TEMPLATE_CATEGORIES } from './categories';

describe('categories', () => {
  it('lists the categories in their display order', () => {
    expect(TEMPLATE_CATEGORIES.map((c) => [c.id, c.label])).toEqual([
      ['herbal', 'Herbal & health'],
      ['fashion', 'Fashion'],
      ['beauty', 'Beauty & skincare'],
      ['food', 'Food & drink'],
      ['home', 'Home & living'],
      ['gadget', 'Gadgets & electronics'],
      ['digital', 'Courses & digital'],
      ['other', 'Other'],
    ]);
  });
  it('parses only known categories', () => {
    expect(parseCategory('herbal')).toBe('herbal');
    for (const value of ['nope', '<script>', 'Herbal', '', undefined, null, 3])
      expect(parseCategory(value)).toBeNull();
  });
  it('labels an unknown category as Other', () => {
    expect(categoryLabel('fashion')).toBe('Fashion');
    expect(categoryLabel('discontinued')).toBe('Other');
  });
});

describe('parseTemplateRef', () => {
  const uuid = '3f2c1a9e-5b7d-4c1e-9a2b-1234567890ab';
  it('reads a UUID as a saved template and a known id as a built-in', () => {
    expect(parseTemplateRef(uuid)).toEqual({ kind: 'saved', id: uuid });
    expect(parseTemplateRef('teh-herbal')).toEqual({ kind: 'builtin', id: 'teh-herbal' });
  });
  it('rejects anything else', () => {
    for (const value of ['builtin:teh-herbal', '', '../x', 'unknown-template', undefined, 7])
      expect(parseTemplateRef(value)).toBeNull();
  });
});

describe('summaries', () => {
  it('summarizes every built-in from its document', () => {
    const summaries = builtinSummaries();
    expect(summaries.map((s) => s.ref)).toEqual(BUILTIN_TEMPLATES.map((t) => t.id));
    const [first] = summaries;
    const doc = BUILTIN_TEMPLATES[0]!.document() as {
      sections: unknown[];
      settings: { theme: { colors: { primary: string } } };
    };
    expect(first).toMatchObject({ kind: 'builtin', sectionCount: doc.sections.length });
    expect(first!.colors.primary).toBe(doc.settings.theme.colors.primary);
  });
  it('falls back to the default theme and no sections for a broken document', () => {
    expect(summarizeDocument({ schemaVersion: 99 })).toEqual({
      sectionCount: 0,
      colors: {
        primary: DEFAULT_THEME.colors.primary,
        accent: DEFAULT_THEME.colors.accent,
        surface: DEFAULT_THEME.colors.surface,
      },
    });
  });
});

describe('filterTemplates', () => {
  const summary = (ref: string, category: string): TemplateSummary => ({
    ref,
    kind: 'saved',
    name: ref,
    category,
    description: '',
    sectionCount: 0,
    colors: { primary: '#000000', accent: '#000000', surface: '#000000' },
  });
  const list = [summary('a', 'herbal'), summary('b', 'fashion'), summary('c', 'gone')];
  it('keeps one category, or everything for null', () => {
    expect(filterTemplates(list, 'herbal').map((s) => s.ref)).toEqual(['a']);
    expect(filterTemplates(list, null).map((s) => s.ref)).toEqual(['a', 'b', 'c']);
  });
  it('files unknown categories under other', () => {
    expect(filterTemplates(list, 'other').map((s) => s.ref)).toEqual(['c']);
  });
});

describe('loadTemplateDocument', () => {
  it('parses a valid document and refuses a broken one', () => {
    expect(loadTemplateDocument(BUILTIN_TEMPLATES[0]!.document()).ok).toBe(true);
    expect(loadTemplateDocument({ schemaVersion: 99 })).toEqual({ ok: false });
    expect(loadTemplateDocument(null)).toEqual({ ok: false });
  });
});
