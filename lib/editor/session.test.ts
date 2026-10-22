import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createEmptyDocument, type PageDocument } from '@/lib/schema/document';
import type { SaveRequest, SaveResponse } from './autosave';
import { createSessionRegistry, type EditorSession, type SessionWindow } from './session';
import { editorDoc } from './test-fixtures';

let sends: SaveRequest[];
let respond: (request: SaveRequest) => Promise<SaveResponse>;
let target: SessionWindow & { document: { visibilityState: DocumentVisibilityState } };

const registry = () =>
  createSessionRegistry({
    target,
    createSend: () => (request) => {
      sends.push(request);
      return respond(request);
    },
  });
const input = (initialRevision: number, initialDoc: PageDocument = createEmptyDocument()) => ({
  pageId: 'p1',
  initialDoc,
  initialRevision,
});
const addHero = (session: EditorSession) =>
  session.store.getState().dispatch({ type: 'addBlock', blockType: 'hero' });
const types = (session: EditorSession) =>
  session.store.getState().doc.sections.flatMap((s) => s.blocks.map((b) => b.type));
const autosaved = (session: EditorSession) => session.autosave.store.getState();
/** True when a listener asks the browser to warn before unloading. */
const warnsOnUnload = () => {
  const event = new Event('beforeunload', { cancelable: true });
  target.dispatchEvent(event);
  return event.defaultPrevented;
};

beforeEach(() => {
  vi.useFakeTimers();
  sends = [];
  respond = async (request) => ({ kind: 'ok', revision: request.baseRevision + 1 });
  target = Object.assign(new EventTarget(), {
    document: Object.assign(new EventTarget(), {
      visibilityState: 'visible' as DocumentVisibilityState,
    }),
  });
});
afterEach(() => vi.useRealTimers());

describe('editor sessions', () => {
  it('reopening a page keeps the latest document when the server payload is stale', async () => {
    const sessions = registry();
    const first = sessions.open(input(0));
    addHero(first);
    await vi.advanceTimersByTimeAsync(800);
    expect(autosaved(first)).toMatchObject({ status: 'saved', revision: 1 });
    // Browser back/forward hands the editor the first load's payload again (revision 0).
    const again = sessions.open(input(0));
    expect(again).toBe(first);
    expect(types(again)).toEqual(['hero']);
  });

  it('a saved session gives way to a newer copy from the server', async () => {
    const sessions = registry();
    const first = sessions.open(input(0));
    const again = sessions.open(input(3, editorDoc()));
    expect(again).not.toBe(first);
    expect(autosaved(again).revision).toBe(3);
    expect(types(again)).toEqual(['hero', 'benefits', 'faq', 'product-carousel', 'footer']);
    // The replaced session stops saving and listening.
    addHero(first);
    await vi.advanceTimersByTimeAsync(5000);
    expect(sends).toEqual([]);
    expect(warnsOnUnload()).toBe(false);
  });

  it('unsaved changes keep their session even when the server copy is newer', async () => {
    respond = async () => ({ kind: 'network' });
    const sessions = registry();
    const first = sessions.open(input(0));
    addHero(first);
    await vi.advanceTimersByTimeAsync(800);
    expect(autosaved(first).status).toBe('offline');
    expect(sessions.open(input(5))).toBe(first);
  });

  it('warns before unloading while changes are unsaved, with or without a mounted editor', async () => {
    const session = registry().open(input(0));
    expect(warnsOnUnload()).toBe(false);
    addHero(session);
    expect(warnsOnUnload()).toBe(true);
    await vi.advanceTimersByTimeAsync(800);
    expect(warnsOnUnload()).toBe(false);
  });

  it('discarding local changes stops the unload warning', () => {
    const session = registry().open(input(0));
    addHero(session);
    session.discard();
    expect(warnsOnUnload()).toBe(false);
  });

  it('hiding the page flushes pending changes with keepalive', async () => {
    const session = registry().open(input(0));
    addHero(session);
    target.document.visibilityState = 'hidden';
    target.document.dispatchEvent(new Event('visibilitychange'));
    await vi.advanceTimersByTimeAsync(0);
    addHero(session);
    target.dispatchEvent(new Event('pagehide'));
    await vi.advanceTimersByTimeAsync(0);
    expect(sends.map((s) => s.keepalive)).toEqual([true, true]);
  });

  it('window blur saves without waiting for the debounce; coming online retries at once', async () => {
    const session = registry().open(input(0));
    respond = async () => ({ kind: 'network' });
    addHero(session);
    target.dispatchEvent(new Event('blur'));
    await vi.advanceTimersByTimeAsync(0);
    expect(sends.map((s) => s.keepalive)).toEqual([false]);
    expect(autosaved(session).status).toBe('offline');
    respond = async (request) => ({ kind: 'ok', revision: request.baseRevision + 1 });
    target.dispatchEvent(new Event('online'));
    await vi.advanceTimersByTimeAsync(0);
    expect(autosaved(session).status).toBe('saved');
  });
});
