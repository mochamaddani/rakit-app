import { describe, expect, it } from 'vitest';
import { byteLength } from '@/lib/renderer/html';
import { parseDocument } from '@/lib/schema/document';
import { trackingDocument } from '@/tests/fixtures/example-document';
import { buildExport, DEFAULT_EXPORT_OPTIONS, type BuildDeps } from './build';
import { sha256Hex } from './hash';

const raw = structuredClone(trackingDocument);
(raw.sections[0]!.blocks[0]!.props as Record<string, unknown>).image = {
  src: 'https://cdn.example/hero.webp',
  alt: 'Teh',
};
raw.settings.seo.favicon = { src: 'https://cdn.example/f.png', alt: '' };
const doc = parseDocument(raw);

function deps(): BuildDeps & { fetched: string[] } {
  const fetched: string[] = [];
  return {
    fetched,
    fetchImage: async (url) => {
      fetched.push(url);
      return { ok: true, mime: 'image/webp', bytes: new Uint8Array([7, 7, 7]) };
    },
    rasterizeFavicon: async () => 'data:image/png;base64,RkFW',
  };
}

describe('buildExport', () => {
  it('the hash matches the html and the report matches its bytes', async () => {
    const build = await buildExport(doc, DEFAULT_EXPORT_OPTIONS, deps());
    expect(build.sha256).toBe(await sha256Hex(build.html));
    expect(build.bytes).toBe(byteLength(build.html));
    expect(build.report.total).toBe(build.bytes);
    expect(build.html).toContain('src="data:image/webp;base64,BwcH"');
  });

  it('hosted mode fetches nothing for block images; the favicon is inlined in both modes', async () => {
    const d = deps();
    const build = await buildExport(doc, { ...DEFAULT_EXPORT_OPTIONS, images: 'hosted' }, d);
    expect(d.fetched).toEqual(['https://cdn.example/f.png']);
    expect(build.html).toContain('src="https://cdn.example/hero.webp"');
    expect(build.html).toContain('<link rel="icon" href="data:image/png;base64,RkFW">');
    const portable = await buildExport(doc, DEFAULT_EXPORT_OPTIONS, deps());
    expect(portable.html).toContain('<link rel="icon" href="data:image/png;base64,RkFW">');
  });

  it('a favicon that cannot be read is dropped and counted', async () => {
    const d = deps();
    d.rasterizeFavicon = async () => null;
    const build = await buildExport(doc, DEFAULT_EXPORT_OPTIONS, d);
    expect(build.html).not.toContain('rel="icon"');
    expect(build.checklist.map((item) => item.id)).toContain('imagesFailed');
  });

  it('tracking off removes vendor tags from the build', async () => {
    const build = await buildExport(doc, { ...DEFAULT_EXPORT_OPTIONS, tracking: false }, deps());
    expect(build.html).not.toContain('googletagmanager');
    expect(build.checklist.map((item) => item.id)).not.toContain('tracking');
  });

  it('the same document and options give the same hash', async () => {
    const a = await buildExport(doc, DEFAULT_EXPORT_OPTIONS, deps());
    const b = await buildExport(structuredClone(doc), DEFAULT_EXPORT_OPTIONS, deps());
    expect(a.sha256).toBe(b.sha256);
    expect(DEFAULT_EXPORT_OPTIONS).toEqual({ images: 'portable', minify: true, tracking: true });
  });
});
