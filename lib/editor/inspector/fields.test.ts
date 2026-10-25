import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { HeroPropsSchema } from '@/lib/blocks/hero/schema';
import { listBlockDefinitions } from '@/lib/blocks/registry';
import { formEmbed } from '@/lib/blocks/form-embed';
import { productCarousel } from '@/lib/blocks/special/product-carousel';
import { ProductItemSchema } from '@/lib/blocks/special/product-carousel/schema';
import { sequentialIds } from '@/lib/schema/ids';
import {
  BlockStyleSchema,
  code,
  datetime,
  SectionStyleSchema,
  text,
  when,
} from '@/lib/schema/primitives';
import { PageSettingsSchema } from '@/lib/schema/settings';
import {
  describeFields,
  fieldError,
  fieldSpecAt,
  initialValueAt,
  isFieldShown,
  listItemSummary,
  parseFieldPath,
  seedValue,
  type FieldSpec,
  type ListSpec,
} from './fields';

const shape = (fields: FieldSpec[]): unknown[] =>
  fields.map((f) =>
    f.kind === 'group' || f.kind === 'list'
      ? [f.key, f.kind, shape(f.kind === 'list' ? f.item.fields : f.fields)]
      : [f.key, f.kind, f.optional],
  );

describe('describeFields', () => {
  it('describes the hero', () => {
    expect(shape(describeFields(HeroPropsSchema))).toEqual([
      ['eyebrow', 'text', false],
      ['headline', 'rich', false],
      ['subheadline', 'rich', false],
      [
        'primaryCta',
        'group',
        [
          ['label', 'text', false],
          ['link', 'link', false],
          ['variant', 'choice', false],
          ['event', 'choice', false],
        ],
      ],
      [
        'secondaryCta',
        'group',
        [
          ['label', 'text', false],
          ['link', 'link', false],
          ['variant', 'choice', false],
          ['event', 'choice', false],
        ],
      ],
      ['trustLine', 'text', false],
      ['image', 'image', true],
      [
        'video',
        'group',
        [
          ['url', 'text', false],
          ['title', 'text', false],
          ['poster', 'image', false],
          ['ratio', 'choice', false],
        ],
      ],
      ['layout', 'choice', false],
      ['align', 'choice', false],
    ]);
    const cta = describeFields(HeroPropsSchema).find((f) => f.key === 'primaryCta')!;
    expect(cta).toMatchObject({ label: 'Primary button', optional: true });
  });
  it('describes lists with their item fields and maximum', () => {
    const items = describeFields(productCarousel.schema).find((f) => f.key === 'items') as ListSpec;
    expect(items).toMatchObject({ kind: 'list', max: 50, label: 'Items' });
    expect(items.item.fields.map((f) => f.key)).not.toContain('id');
  });
  it('code fields describe as code', () => {
    const [field] = describeFields(z.object({ snippet: code(500) }));
    expect(field).toMatchObject({ kind: 'code', max: 500, label: 'Snippet' });
  });
  it('the settings walker covers tracking', () => {
    const tracking = describeFields(PageSettingsSchema).find((f) => f.key === 'tracking');
    expect(tracking?.kind).toBe('group');
    const fields = tracking?.kind === 'group' ? tracking.fields : [];
    expect(fields.map((f) => [f.key, f.kind])).toEqual([
      ['metaPixelId', 'text'],
      ['ga4Id', 'text'],
      ['googleAdsId', 'text'],
      ['googleAdsLeadLabel', 'text'],
      ['gtmId', 'text'],
      ['headCode', 'code'],
      ['bodyCode', 'code'],
    ]);
    expect(fields[0]!.label).toBe('Meta Pixel ID');
    expect(fieldError(fields[0]!, 'abc')).toBe('Meta Pixel IDs are 10–20 digits');
  });
  it('describes every registered block, the style schemas and the page settings without throwing', () => {
    for (const d of listBlockDefinitions())
      expect(() => describeFields(d.schema), d.type).not.toThrow();
    for (const s of [BlockStyleSchema, SectionStyleSchema, PageSettingsSchema])
      expect(() => describeFields(s)).not.toThrow();
  });
  it('turns enums, literal unions and enum+literal unions into choices with labels', () => {
    const settings = describeFields(PageSettingsSchema);
    expect(settings.find((f) => f.key === 'lang')).toMatchObject({
      kind: 'choice',
      options: [
        { value: 'id', label: 'Indonesian' },
        { value: 'en', label: 'English' },
      ],
    });
  });
});

describe('seeds and initial values', () => {
  it('seeds a valid product item with placeholders for required text', () => {
    const item = seedValue(ProductItemSchema, sequentialIds('n')) as { id: string; title: string };
    expect(ProductItemSchema.safeParse(item).success).toBe(true);
    expect(item).toMatchObject({ id: 'n1', title: '[REPLACE: Title]' });
  });
  it('a new list item copies the block’s sample with a fresh id', () => {
    const item = initialValueAt(
      productCarousel,
      ['items', 3],
      ProductItemSchema,
      sequentialIds('n'),
    ) as { id: string; title: string; cta: { label: string } };
    expect(item).toMatchObject({ title: 'Product 1', cta: { label: 'Buy now' } });
    expect(item.id).toMatch(/^n\d+$/);
  });
  it('summarizes list items by their first text', () => {
    const items = describeFields(productCarousel.schema).find((f) => f.key === 'items') as ListSpec;
    expect(listItemSummary({ title: '**Botol** biru' }, items, 0)).toBe('Botol biru');
    expect(listItemSummary({ title: '' }, items, 4)).toBe('Item 5');
  });
  it('explains invalid values in plain words', () => {
    const headline = describeFields(HeroPropsSchema).find((f) => f.key === 'headline')!;
    expect(fieldError(headline, '')).toBe('Required');
    expect(fieldError(headline, 'x'.repeat(201))).toBe('At most 200 characters');
    expect(fieldError(headline, 'ok')).toBeNull();
  });
});

describe('field paths', () => {
  it('parseFieldPath reads dotted paths and refuses anything else', () => {
    expect(parseFieldPath('items.2.title')).toEqual(['items', 2, 'title']);
    expect(parseFieldPath('headline')).toEqual(['headline']);
    for (const bad of [
      '',
      'a..b',
      '__proto__.x',
      '1234.x',
      'a.b.c.d.e.f.g',
      'items.-1',
      'a b',
      'a.',
    ]) {
      expect(parseFieldPath(bad), bad).toBeNull();
    }
  });
  it('fieldSpecAt walks groups and list items', () => {
    const hero = describeFields(HeroPropsSchema);
    expect(fieldSpecAt(hero, ['primaryCta', 'label'])?.kind).toBe('text');
    expect(fieldSpecAt(hero, ['headline'])?.kind).toBe('rich');
    const carousel = describeFields(productCarousel.schema);
    expect(fieldSpecAt(carousel, ['items', 0, 'title'])?.kind).toBe('text');
    expect(fieldSpecAt(carousel, ['items', 0, 'nope'])).toBeNull();
    expect(fieldSpecAt(carousel, ['items', 'title'])).toBeNull();
    expect(fieldSpecAt(carousel, ['heading', 'x'])).toBeNull();
    expect(fieldSpecAt(carousel, ['constructor'])).toBeNull();
  });
});

describe('conditional fields', () => {
  const schema = z.object({
    mode: z.enum(['a', 'b']).default('a'),
    before: when(text(10).default(''), 'mode', ['b']),
    after: when(text(10), 'mode', ['b']).default(''),
    maybe: when(text(10).optional(), 'mode', ['a']),
    always: text(10).default(''),
  });
  const field = (key: string) => describeFields(schema).find((f) => f.key === key)!;

  it('showWhen is read through default and optional wrappers', () => {
    for (const key of ['before', 'after']) {
      expect(field(key).showWhen).toEqual({ key: 'mode', in: ['b'] });
    }
    expect(field('maybe').showWhen).toEqual({ key: 'mode', in: ['a'] });
    expect(field('always').showWhen).toBeUndefined();
  });

  it('isFieldShown follows the sibling value', () => {
    expect(isFieldShown(field('before'), { mode: 'a' })).toBe(false);
    expect(isFieldShown(field('before'), { mode: 'b' })).toBe(true);
    expect(isFieldShown(field('always'), { mode: 'a' })).toBe(true);
    expect(isFieldShown(field('always'), undefined)).toBe(true);
  });

  it('form embed hides iframe fields in snippet mode', () => {
    const fields = describeFields(formEmbed.schema);
    const showWhen = (key: string) => fields.find((f) => f.key === key)!.showWhen;
    for (const key of ['url', 'height', 'title']) {
      expect(showWhen(key)).toEqual({ key: 'mode', in: ['iframe'] });
    }
    expect(showWhen('code')).toEqual({ key: 'mode', in: ['snippet'] });
    expect(showWhen('thankYouUrl')).toBeUndefined();
  });
});

it('datetime fields describe as datetime', () => {
  const [field] = describeFields(z.object({ endsAt: datetime().default('') }));
  expect(field).toMatchObject({ key: 'endsAt', kind: 'datetime', optional: false });
});

it('labels a field by its parent first (video.url), then by its own key', () => {
  const schema = z.object({
    url: z.string().default(''),
    video: z.object({ url: z.string().default('') }).prefault({}),
  });
  const [url, group] = describeFields(schema);
  expect(url!.label).toBe('Form address');
  expect(group!.kind === 'group' && group.fields[0]!.label).toBe('Video address');
});
