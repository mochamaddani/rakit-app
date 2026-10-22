import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { defineBlock } from '@/lib/blocks/types';
import { html } from '@/lib/renderer/html';
import { IdSchema } from '@/lib/schema/ids';
import { CtaSchema, ImageSchema, LinkSchema, text } from '@/lib/schema/primitives';
import { HOSTILE_TEXT, HOSTILE_URL, poisonProps } from './poison';

// A synthetic block whose defaults leave out optional fields, use a non-url link kind and an
// empty list: exactly what future blocks will do with their riskiest fields.
const probe = defineBlock({
  type: 'probe',
  category: 'content',
  label: 'Probe',
  description: 'Synthetic block used to test the poison helper.',
  icon: 'flask',
  schema: z.object({
    title: text(80, 1),
    primary: CtaSchema,
    secondary: CtaSchema.optional(),
    image: ImageSchema.optional(),
    items: z.array(z.object({ id: IdSchema, label: text(40, 1), link: LinkSchema })).default([]),
    layout: z.enum(['a', 'b']).default('a'),
  }),
  defaultProps: () => ({
    title: 'Hi',
    primary: { label: 'Go', link: { kind: 'default' as const }, variant: 'primary' as const },
    items: [],
    layout: 'a' as const,
  }),
  css: { min: '', src: '' },
  render: () => html``,
});

describe('poisonProps', () => {
  type Link = Record<string, unknown>;
  const poisoned = poisonProps(probe) as {
    title: string;
    primary: { label: string; link: Link; variant: string };
    secondary: { label: string; link: Link };
    image: Record<string, unknown>;
    items: Array<{ id: string; label: string; link: Link }>;
    layout: string;
  };

  it('poisons text fields that the defaults fill', () => {
    expect(poisoned.title).toBe(HOSTILE_TEXT);
    expect(poisoned.primary.label).toBe(HOSTILE_TEXT);
  });
  it('turns every link into a hostile url link, even when the default is another kind', () => {
    expect(poisoned.primary.link).toMatchObject({ kind: 'url', url: HOSTILE_URL });
  });
  it('fills optional objects that the defaults leave out', () => {
    expect(poisoned.secondary).toMatchObject({
      label: HOSTILE_TEXT,
      link: { kind: 'url', url: HOSTILE_URL },
    });
    expect(poisoned.image).toMatchObject({ src: HOSTILE_URL, alt: HOSTILE_TEXT });
  });
  it('adds one hostile element to empty lists, with a valid id', () => {
    expect(poisoned.items).toHaveLength(1);
    expect(poisoned.items[0]).toMatchObject({
      label: HOSTILE_TEXT,
      link: { kind: 'url', url: HOSTILE_URL },
    });
    expect(IdSchema.safeParse(poisoned.items[0]?.id).success).toBe(true);
  });
  it('keeps enum values valid', () => {
    expect(poisoned.layout).toBe('a');
    expect(poisoned.primary.variant).toBe('primary');
  });
});
