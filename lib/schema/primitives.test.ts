import { describe, expect, it } from 'vitest';
import {
  BlockStyleSchema,
  HexColorSchema,
  ImageSchema,
  LinkSchema,
  SectionStyleSchema,
  rich,
  text,
} from '@/lib/schema/primitives';

describe('primitives', () => {
  it('LinkSchema accepts the three link kinds and defaults newTab to false', () => {
    expect(LinkSchema.parse({ kind: 'url', url: 'https://wa.me/62812' })).toEqual({
      kind: 'url',
      url: 'https://wa.me/62812',
      newTab: false,
    });
    expect(LinkSchema.parse({ kind: 'section', sectionId: 'order' })).toEqual({
      kind: 'section',
      sectionId: 'order',
    });
    expect(LinkSchema.parse({ kind: 'default' })).toEqual({ kind: 'default' });
  });
  it('ImageSchema turns a missing image into an empty src and alt', () => {
    expect(ImageSchema.parse({})).toEqual({ src: '', alt: '' });
  });
  it('HexColorSchema only accepts #RRGGBB', () => {
    expect(HexColorSchema.safeParse('#2563EB').success).toBe(true);
    for (const bad of ['#fff', 'red', '#2563EB;x', '2563EB'])
      expect(HexColorSchema.safeParse(bad).success).toBe(false);
  });
  it('text() and rich() enforce length limits', () => {
    expect(text(5).safeParse('123456').success).toBe(false);
    expect(text(10, 1).safeParse('').success).toBe(false);
    expect(rich(10).safeParse('**ok**').success).toBe(true);
  });
  it('style schemas fill their defaults', () => {
    expect(BlockStyleSchema.parse({})).toEqual({ hideOn: 'none', spaceAbove: 'none' });
    expect(SectionStyleSchema.parse({})).toEqual({ tone: 'base', padY: 'md', width: 'normal' });
  });
});
