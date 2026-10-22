import { applyPatches } from 'immer';
import { describe, expect, it } from 'vitest';
import { PageDocumentSchema, parseDocument } from '@/lib/schema/document';
import { applyCommand, type CommandSuccess, type EditorCommand } from './commands';
import { deps, editorDoc, everyCommand, order } from './test-fixtures';

const run = (
  command: EditorCommand,
  doc = editorDoc(),
  selection: Parameters<typeof applyCommand>[2] = null,
) => applyCommand(doc, command, selection, deps());
const ok = (result: ReturnType<typeof run>) => {
  if (!result.ok) throw new Error(result.reason);
  return result;
};

describe('addBlock', () => {
  it('inserts a new default section before trailing footers and selects the block', () => {
    const r = ok(run({ type: 'addBlock', blockType: 'hero' }));
    expect(order(r.doc)).toEqual(['s1:b1', 's2:b2,b3', 's3:b4', 'n1:n2', 's4:b5']);
    expect(r.doc.sections[3]!.style).toEqual({ tone: 'base', padY: 'md', width: 'normal' });
    expect(r.selection).toEqual({ kind: 'block', blockId: 'n2' });
    expect(r.announcement).toBe('Added Hero');
  });
  it('inserts after the selected block’s section, and footers always go last', () => {
    expect(
      order(
        ok(
          run({ type: 'addBlock', blockType: 'faq' }, editorDoc(), {
            kind: 'block',
            blockId: 'b2',
          }),
        ).doc,
      ),
    ).toEqual(['s1:b1', 's2:b2,b3', 'n1:n2', 's3:b4', 's4:b5']);
    expect(
      order(
        ok(
          run({ type: 'addBlock', blockType: 'footer' }, editorDoc(), {
            kind: 'block',
            blockId: 'b1',
          }),
        ).doc,
      ).at(-1),
    ).toBe('n1:n2');
  });
  it('refuses a 61st section', () => {
    const many = parseDocument({
      schemaVersion: 1,
      sections: Array.from({ length: 60 }, (_, i) => ({ id: `x${i}`, blocks: [] })),
    });
    expect(run({ type: 'addBlock', blockType: 'faq' }, many)).toMatchObject({
      ok: false,
      code: 'limit',
    });
  });
});

describe('moveBlock', () => {
  it('moves a block that is alone in its section together with the section', () => {
    const r = ok(run({ type: 'moveBlock', blockId: 'b4', direction: 'up' }));
    expect(order(r.doc)).toEqual(['s1:b1', 's3:b4', 's2:b2,b3', 's4:b5']);
    expect(r.announcement).toBe('Moved Product Carousel up, now section 2 of 4');
  });
  it('is a noop at the page edges', () => {
    expect(run({ type: 'moveBlock', blockId: 'b1', direction: 'up' })).toMatchObject({
      ok: false,
      code: 'noop',
    });
    expect(run({ type: 'moveBlock', blockId: 'b5', direction: 'down' })).toMatchObject({
      ok: false,
      code: 'noop',
    });
  });
  it('swaps neighbours inside a shared section', () => {
    const r = ok(run({ type: 'moveBlock', blockId: 'b3', direction: 'up' }));
    expect(order(r.doc)).toEqual(['s1:b1', 's2:b3,b2', 's3:b4', 's4:b5']);
    expect(r.announcement).toBe('Moved FAQ up, now block 1 of 2 in its section');
  });
  it('leaves a shared section at its edge into a new section with the same style', () => {
    const up = ok(run({ type: 'moveBlock', blockId: 'b2', direction: 'up' }));
    expect(order(up.doc)).toEqual(['s1:b1', 'n1:b2', 's2:b3', 's3:b4', 's4:b5']);
    expect(up.doc.sections[1]!.style.tone).toBe('muted');
    expect(up.announcement).toBe('Moved Benefits up into its own section');
    expect(order(ok(run({ type: 'moveBlock', blockId: 'b3', direction: 'down' })).doc)).toEqual([
      's1:b1',
      's2:b2',
      'n1:b3',
      's3:b4',
      's4:b5',
    ]);
  });
});

describe('duplicate and remove', () => {
  it('duplicates a lone block as a section and a shared block in place', () => {
    const lone = ok(run({ type: 'duplicateBlock', blockId: 'b1' }));
    expect(order(lone.doc)).toEqual(['s1:b1', 'n1:n2', 's2:b2,b3', 's3:b4', 's4:b5']);
    expect(lone.doc.sections[1]!.blocks[0]!.props).toEqual(lone.doc.sections[0]!.blocks[0]!.props);
    const shared = ok(run({ type: 'duplicateBlock', blockId: 'b2' }));
    expect(order(shared.doc)).toEqual(['s1:b1', 's2:b2,n1,b3', 's3:b4', 's4:b5']);
    expect(shared.selection).toEqual({ kind: 'block', blockId: 'n1' });
  });
  it('removes emptied sections and selects the next block, else the previous one', () => {
    const first = ok(run({ type: 'removeBlock', blockId: 'b1' }));
    expect(order(first.doc)).toEqual(['s2:b2,b3', 's3:b4', 's4:b5']);
    expect(first.selection).toEqual({ kind: 'block', blockId: 'b2' });
    expect(ok(run({ type: 'removeBlock', blockId: 'b5' })).selection).toEqual({
      kind: 'block',
      blockId: 'b4',
    });
  });
});

describe('props, styles, anchors and settings', () => {
  it('sets nested and list paths and deletes optional keys', () => {
    const doc = ok(
      run({ type: 'setBlockProp', blockId: 'b1', path: ['primaryCta', 'label'], value: 'Pesan' }),
    ).doc;
    expect(doc.sections[0]!.blocks[0]!.props).toMatchObject({ primaryCta: { label: 'Pesan' } });
    const noImage = ok(
      run({ type: 'setBlockProp', blockId: 'b1', path: ['image'], value: undefined }),
    ).doc;
    expect('image' in noImage.sections[0]!.blocks[0]!.props).toBe(false);
    const title = ok(
      run({ type: 'setBlockProp', blockId: 'b4', path: ['items', 1, 'title'], value: 'Botol' }),
    ).doc;
    expect(
      (title.sections[2]!.blocks[0]!.props as { items: { title: string }[] }).items[1]!.title,
    ).toBe('Botol');
  });
  it('rejects invalid values and leaves the document untouched', () => {
    const doc = editorDoc();
    expect(
      run({ type: 'setBlockProp', blockId: 'b1', path: ['headline'], value: '' }, doc),
    ).toMatchObject({ ok: false, code: 'invalid' });
    expect(
      run(
        { type: 'setBlockProp', blockId: 'b1', path: ['secondaryCta', 'label'], value: 'x' },
        doc,
      ),
    ).toMatchObject({ ok: false, code: 'invalid' });
    expect(
      run({ type: 'setBlockStyle', blockId: 'b1', path: ['hideOn'], value: 'tablet' }, doc),
    ).toMatchObject({ ok: false });
    expect(
      run({ type: 'setSectionStyle', sectionId: 's2', path: ['tone'], value: 'neon' }, doc),
    ).toMatchObject({ ok: false });
    expect(
      run({ type: 'setSetting', path: ['theme', 'colors', 'primary'], value: 'blue' }, doc),
    ).toMatchObject({ ok: false });
    expect(doc).toEqual(editorDoc());
  });
  it('normalizes inserted items with schema defaults', () => {
    const r = ok(
      run({
        type: 'listInsert',
        blockId: 'b4',
        path: ['items'],
        index: 0,
        item: { id: 'x1', title: 'Baru' },
      }),
    );
    expect((r.doc.sections[2]!.blocks[0]!.props as { items: unknown[] }).items[0]).toMatchObject({
      id: 'x1',
      title: 'Baru',
      description: '',
      badge: '',
      showDiscount: false,
      image: { src: '', alt: '' },
      cta: { label: '', link: { kind: 'default' } },
    });
  });
  it('validates anchors: pattern, reserved prefixes and uniqueness', () => {
    expect(
      ok(run({ type: 'setSectionAnchor', sectionId: 's3', anchor: 'pesan' })).doc.sections[2]!
        .anchor,
    ).toBe('pesan');
    for (const bad of ['b-x', 'Pesan', '9x'])
      expect(run({ type: 'setSectionAnchor', sectionId: 's3', anchor: bad })).toMatchObject({
        ok: false,
        code: 'invalid',
      });
    const taken = ok(run({ type: 'setSectionAnchor', sectionId: 's1', anchor: 'pesan' })).doc;
    expect(
      run({ type: 'setSectionAnchor', sectionId: 's3', anchor: 'pesan' }, taken),
    ).toMatchObject({ ok: false });
  });
});

describe('lists', () => {
  const ids = (r: CommandSuccess) =>
    (r.doc.sections[2]!.blocks[0]!.props as { items: { id: string }[] }).items.map((i) => i.id);
  it('moves, duplicates and removes items', () => {
    expect(
      ids(ok(run({ type: 'listMove', blockId: 'b4', path: ['items'], from: 2, to: 0 }))),
    ).toEqual(['i8', 'i6', 'i7']);
    expect(
      ids(ok(run({ type: 'listDuplicate', blockId: 'b4', path: ['items'], index: 0 }))),
    ).toEqual(['i6', 'n1', 'i7', 'i8']);
    expect(ids(ok(run({ type: 'listRemove', blockId: 'b4', path: ['items'], index: 1 })))).toEqual([
      'i6',
      'i8',
    ]);
  });
  it('rejects out-of-range indices and lists at their maximum', () => {
    expect(run({ type: 'listMove', blockId: 'b4', path: ['items'], from: 0, to: 9 })).toMatchObject(
      { ok: false, code: 'invalid' },
    );
    const full = parseDocument({
      schemaVersion: 1,
      sections: [
        {
          id: 's1',
          blocks: [
            {
              id: 'f',
              type: 'faq',
              props: {
                items: Array.from({ length: 30 }, (_, i) => ({
                  id: `q${i}`,
                  question: 'Q?',
                  answer: 'A.',
                })),
              },
            },
          ],
        },
      ],
    });
    expect(
      run(
        {
          type: 'listInsert',
          blockId: 'f',
          path: ['items'],
          index: 0,
          item: { id: 'q99', question: 'Q?', answer: 'A.' },
        },
        full,
      ),
    ).toMatchObject({ ok: false, code: 'limit' });
  });
});

it('every command keeps the document valid and its inverse restores it', () => {
  let doc = editorDoc();
  const d = deps();
  let selection: Parameters<typeof applyCommand>[2] = null;
  for (const command of everyCommand()) {
    const result = applyCommand(doc, command, selection, d);
    if (!result.ok) throw new Error(`${command.type}: ${result.reason}`);
    expect(PageDocumentSchema.safeParse(result.doc).success, command.type).toBe(true);
    expect(applyPatches(result.doc, result.inversePatches), command.type).toEqual(doc);
    expect(applyPatches(doc, result.patches), command.type).toEqual(result.doc);
    doc = result.doc;
    selection = result.selection;
  }
});

it('never mutates the input document', () => {
  const doc = editorDoc();
  const before = structuredClone(doc);
  for (const command of everyCommand()) applyCommand(doc, command, null, deps());
  expect(doc).toEqual(before);
});
