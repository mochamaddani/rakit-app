// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { applyCommand } from '../commands';
import { deps, editorDoc } from '../test-fixtures';
import { CANVAS_SOURCE } from './constants';
import { createBlockHtmlCache } from './render-cache';
import { startPreviewRuntime } from './runtime';
import { canvasState, diffCanvas } from './sync';

const CH = 'abcdefghij';
const posts: Record<string, unknown>[] = [];
const scripts: string[] = [];
let dispose: () => void;

function load(doc = editorDoc()) {
  const s = canvasState(doc, createBlockHtmlCache());
  const body = s.skeleton.replace(/<div data-lp-slot="([^"]+)"><\/div>/g, (_, id: string) =>
    s.blocks.get(id)!,
  );
  document.head.innerHTML = `<style>${s.css}</style>`;
  document.body.innerHTML = `${body}<script>/*page*/</script>`;
  dispose = startPreviewRuntime({
    win: window,
    channel: CH,
    post: (m) => posts.push(m),
    isFromParent: () => true,
    runScript: (code) => scripts.push(code),
  });
  return s;
}
const send = (data: Record<string, unknown>) =>
  window.dispatchEvent(
    new MessageEvent('message', { data: { source: CANVAS_SOURCE, channel: CH, ...data } }),
  );
const frame = () => new Promise((resolve) => setTimeout(resolve, 30));
const types = () =>
  [...document.querySelectorAll('[data-lp-block]')].map((el) => el.getAttribute('data-lp-block'));

beforeEach(() => {
  posts.length = 0;
  scripts.length = 0;
});
afterEach(() => dispose());

describe('preview runtime', () => {
  const headlineOf = (id = 'b1') =>
    document.querySelector<HTMLElement>(`[data-lp-block="${id}"] [data-lp-field="headline"]`)!;
  const startEditing = (el: HTMLElement) =>
    el.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
  const key = (el: HTMLElement, init: KeyboardEventInit) =>
    el.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, cancelable: true, ...init }));

  it('dblclick makes the field editable and input posts edit nodes', async () => {
    load();
    const headline = headlineOf();
    startEditing(headline);
    expect(headline.getAttribute('contenteditable')).toBe('true');
    expect(headline.hasAttribute('data-lp-editing')).toBe(true);
    headline.innerHTML = 'Baru <b>tebal</b>';
    headline.dispatchEvent(new Event('input', { bubbles: true }));
    await frame();
    expect(posts.find((p) => p.type === 'edit')).toMatchObject({
      blockId: 'b1',
      path: 'headline',
      nodes: [
        { t: 'text', v: 'Baru ' },
        { t: 'strong', v: 'tebal' },
      ],
    });
  });

  it('patches for the block being edited wait until editing ends', async () => {
    const before = load();
    const headline = headlineOf();
    startEditing(headline);
    const r = applyCommand(
      editorDoc(),
      { type: 'setBlockProp', blockId: 'b1', path: ['headline'], value: 'Dari dokumen' },
      null,
      deps(),
    );
    if (!r.ok) throw new Error(r.reason);
    const patch = diffCanvas(before, canvasState(r.doc, createBlockHtmlCache()))!;
    send({ type: 'sync', rev: 1, ...patch });
    await frame();
    expect(headlineOf()).toBe(headline);
    key(headline, { key: 'Escape' });
    expect(posts.filter((p) => p.type === 'editEnd')).toEqual([
      expect.objectContaining({ blockId: 'b1', path: 'headline' }),
    ]);
    expect(headline.hasAttribute('contenteditable')).toBe(false);
    send({ type: 'sync', rev: 2, ...patch });
    await frame();
    expect(headlineOf()).not.toBe(headline);
    expect(headlineOf().textContent).toBe('Dari dokumen');
  });

  it('Backspace is not forwarded while editing; Mod+Z ends editing and is', () => {
    load();
    const headline = headlineOf();
    startEditing(headline);
    key(headline, { key: 'Backspace' });
    key(headline, { key: 'd', ctrlKey: true });
    expect(posts.filter((p) => p.type === 'key')).toEqual([]);
    key(headline, { key: 'z', ctrlKey: true });
    expect(posts.map((p) => p.type).filter((t) => t === 'editEnd' || t === 'key')).toEqual([
      'editEnd',
      'key',
    ]);
    expect(headline.hasAttribute('data-lp-editing')).toBe(false);
  });

  it('scrollBy scrolls the canvas and reports rects even at the edge', async () => {
    load();
    await frame();
    posts.length = 0;
    send({ type: 'scrollBy', dy: -50 });
    await frame();
    expect(posts.filter((p) => p.type === 'rects')).toHaveLength(1);
  });
  it('posts ready and rects on start, and ready again on hello', async () => {
    load();
    await frame();
    expect(posts.map((p) => p.type)).toEqual(expect.arrayContaining(['ready', 'rects']));
    send({ type: 'hello' });
    expect(posts.filter((p) => p.type === 'ready')).toHaveLength(2);
  });
  it('moves existing block elements into a new skeleton instead of re-creating them', async () => {
    const before = load();
    const carousel = document.querySelector('[data-lp-block="b4"]');
    const r = applyCommand(
      editorDoc(),
      { type: 'moveBlock', blockId: 'b4', direction: 'up' },
      null,
      deps(),
    );
    if (!r.ok) throw new Error(r.reason);
    send({
      type: 'sync',
      rev: 1,
      ...diffCanvas(before, canvasState(r.doc, createBlockHtmlCache()))!,
    });
    await frame();
    expect(types()).toEqual(['b1', 'b4', 'b2', 'b3', 'b5']);
    expect(document.querySelector('[data-lp-block="b4"]')).toBe(carousel);
    expect(posts.some((p) => p.type === 'synced' && p.rev === 1)).toBe(true);
    expect(scripts).toHaveLength(1);
  });
  it('replaces only the changed block and keeps scroll offsets and user-opened details', async () => {
    load();
    const track = document.querySelector<HTMLElement>('[data-lp-block="b4"] .lp-carousel__track')!;
    track.scrollLeft = 120;
    const details = document.querySelector<HTMLDetailsElement>('[data-lp-block="b3"] details')!;
    details.open = true;
    details.dispatchEvent(new Event('toggle'));
    const hero = document.querySelector('[data-lp-block="b1"]');
    send({
      type: 'sync',
      rev: 2,
      blocks: [
        { id: 'b4', html: document.querySelector('[data-lp-block="b4"]')!.outerHTML },
        {
          id: 'b3',
          html: document.querySelector('[data-lp-block="b3"]')!.outerHTML.replace(' open=""', ''),
        },
      ],
    });
    await frame();
    expect(document.querySelector('[data-lp-block="b1"]')).toBe(hero);
    expect(
      document.querySelector<HTMLElement>('[data-lp-block="b4"] .lp-carousel__track')!.scrollLeft,
    ).toBe(120);
    expect(document.querySelector<HTMLDetailsElement>('[data-lp-block="b3"] details')!.open).toBe(
      true,
    );
  });
  it('replaces the stylesheet text and the page language', () => {
    load();
    send({ type: 'sync', rev: 3, css: ':root{--lp-primary:#000000}', lang: 'en', blocks: [] });
    expect(document.querySelector('style')!.textContent).toBe(':root{--lp-primary:#000000}');
    expect(document.documentElement.lang).toBe('en');
  });
  it('clicking a link selects its block without navigating', () => {
    load();
    const link = document.querySelector<HTMLAnchorElement>('[data-lp-block="b1"] a[href]')!;
    const click = new MouseEvent('click', { bubbles: true, cancelable: true });
    link.dispatchEvent(click);
    expect(click.defaultPrevented).toBe(true);
    expect(posts).toContainEqual(
      expect.objectContaining({ type: 'select', target: { kind: 'block', blockId: 'b1' } }),
    );
  });
  it('clicking section padding selects the section', () => {
    load();
    document
      .querySelector('[data-lp-section="s2"]')!
      .dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(posts).toContainEqual(
      expect.objectContaining({ type: 'select', target: { kind: 'section', sectionId: 's2' } }),
    );
  });
  it('forwards editor shortcuts and leaves carousel arrow keys alone', () => {
    load();
    const undo = new KeyboardEvent('keydown', {
      key: 'z',
      metaKey: true,
      bubbles: true,
      cancelable: true,
    });
    document.body.dispatchEvent(undo);
    const left = new KeyboardEvent('keydown', {
      key: 'ArrowLeft',
      bubbles: true,
      cancelable: true,
    });
    document.body.dispatchEvent(left);
    expect(undo.defaultPrevented).toBe(true);
    expect(left.defaultPrevented).toBe(false);
    expect(posts.filter((p) => p.type === 'key')).toEqual([
      expect.objectContaining({ input: { key: 'z', mod: true, shift: false, alt: false } }),
    ]);
  });
  it('ignores messages from another channel or with an unknown type', () => {
    load();
    window.dispatchEvent(
      new MessageEvent('message', {
        data: { source: CANVAS_SOURCE, channel: 'zzzzzzzzzz', type: 'hello' },
      }),
    );
    send({ type: 'navigate', url: 'https://evil.example' });
    expect(posts.filter((p) => p.type === 'ready')).toHaveLength(1);
  });
  it('reports an error for a skeleton slot it cannot fill', async () => {
    load();
    send({
      type: 'sync',
      rev: 4,
      skeleton: '<main><div data-lp-slot="ghost"></div></main>',
      blocks: [],
    });
    await frame();
    expect(posts).toContainEqual(expect.objectContaining({ type: 'error' }));
  });
});
