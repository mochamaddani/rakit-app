import { describe, expect, it } from 'vitest';
import { getBlockDefinition } from '@/lib/blocks/registry';
import { renderPage } from '@/lib/renderer/page';
import { AA_TEXT_RATIO, contrastRatio, THEME_CONTRAST_PAIRS } from '@/lib/schema/contrast';
import { parseDocument, type BlockInstance } from '@/lib/schema/document';
import { findImages } from '@/lib/schema/images';
import { hasTrackingIds } from '@/lib/schema/settings';
import { validateHtml } from '@/tests/helpers/validate-html';
import { TEMPLATE_CATEGORIES } from '../categories';
import { BUILTIN_TEMPLATES } from '.';

const blocksOf = (template: (typeof BUILTIN_TEMPLATES)[number]): BlockInstance[] =>
  parseDocument(template.document()).sections.flatMap((section) => section.blocks);

describe('built-in templates', () => {
  it('have unique, slug-shaped ids and cover every category but Other', () => {
    const ids = BUILTIN_TEMPLATES.map((template) => template.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(id).toMatch(/^[a-z][a-z0-9-]{0,40}$/);
    const covered = new Set(BUILTIN_TEMPLATES.map((template) => template.category));
    for (const { id } of TEMPLATE_CATEGORIES.filter((category) => category.id !== 'other'))
      expect(covered, id).toContain(id);
  });

  describe.each(BUILTIN_TEMPLATES.map((template) => [template.id, template] as const))(
    '%s',
    (_id, template) => {
      const doc = parseDocument(template.document());
      const blocks = blocksOf(template);
      const json = JSON.stringify(template.document());

      it('has a name, a description and a known category', () => {
        expect(template.name.length).toBeGreaterThan(0);
        expect(template.name.length).toBeLessThanOrEqual(120);
        expect(template.description.length).toBeGreaterThan(0);
        expect(template.description.length).toBeLessThanOrEqual(300);
        expect(TEMPLATE_CATEGORIES.map((category) => category.id)).toContain(template.category);
      });

      it('renders valid HTML in export and preview', async () => {
        for (const mode of ['export', 'preview'] as const) {
          const result = renderPage(doc, { mode });
          expect(result.warnings).toEqual([]);
          expect(await validateHtml(result.html)).toEqual([]);
        }
      });

      it('is an Indonesian page whose buttons all go to its order section', () => {
        expect(doc.settings.lang).toBe('id');
        expect(doc.settings.seo.title.length).toBeGreaterThan(0);
        const target = doc.settings.defaultCta;
        expect(target?.kind).toBe('section');
        const ids = doc.sections.map((section) => section.id);
        if (target?.kind === 'section') expect(ids).toContain(target.sectionId);
        expect(json).not.toMatch(/"kind":"url"/);
      });

      it('meets AA contrast on every theme pair', () => {
        const { colors } = doc.settings.theme;
        for (const [fg, bg] of THEME_CONTRAST_PAIRS)
          expect(contrastRatio(colors[fg], colors[bg]), `${fg} on ${bg}`).toBeGreaterThanOrEqual(
            AA_TEXT_RATIO,
          );
      });

      it('carries no tracking ids, owner code, contacts or links', () => {
        expect(hasTrackingIds(doc.settings.tracking)).toBe(false);
        expect(doc.settings.tracking.headCode + doc.settings.tracking.bodyCode).toBe('');
        expect(blocks.some((block) => block.type === 'custom-html')).toBe(false);
        for (const block of blocks.filter((b) => b.type === 'form-embed')) {
          const props = block.props as { code: string; url: string };
          expect(props.code + props.url).toBe('');
        }
        expect(json).not.toMatch(/https?:|wa\.me|www\./i);
        expect(json).not.toMatch(/[\w.+-]+@[\w-]+\.[a-z]{2,}/i);
        expect(json).not.toMatch(/\d{8,}/);
      });

      it('leaves every image as a described placeholder', () => {
        for (const block of blocks) {
          const schema = getBlockDefinition(block.type)!.schema;
          for (const image of findImages(schema, block.props)) {
            expect(image.src).toBe('');
            expect(image.alt.length).toBeGreaterThan(0);
          }
        }
      });

      it('never invents social proof', () => {
        for (const block of blocks) {
          if (block.type === 'testimonials') {
            for (const item of block.props.items) {
              expect(item.name).toContain('[REPLACE:');
              expect(item.quote).toContain('[REPLACE:');
              expect(item.rating).toBeUndefined();
            }
          }
          if (block.type === 'product-carousel') {
            for (const item of block.props.items) {
              expect(item.rating).toBeUndefined();
              expect(item.reviewCount).toBeUndefined();
            }
          }
          if (block.type === 'pricing') {
            for (const offer of block.props.offers) {
              expect(offer.price).toBeUndefined();
              expect(offer.compareAtPrice).toBeUndefined();
            }
          }
        }
      });

      it('makes no cure or treatment claims', () => {
        expect(json).not.toMatch(/menyembuhkan|mengobati|\bobat\b|sembuh/i);
      });
    },
  );
});
