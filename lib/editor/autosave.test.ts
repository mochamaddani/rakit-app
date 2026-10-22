import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createEmptyDocument } from '@/lib/schema/document';
import { createAutosave, type SaveRequest, type SaveResponse } from './autosave';

let version = 0;
let sends: SaveRequest[] = [];
let respond: (req: SaveRequest) => Promise<SaveResponse>;
const doc = createEmptyDocument();
const make = () =>
  createAutosave({
    initialRevision: 4,
    getSnapshot: () => ({ doc, version }),
    send: (req) => {
      sends.push(req);
      return respond(req);
    },
  });
const edit = (a: ReturnType<typeof make>) => a.changed(++version);
const status = (a: ReturnType<typeof make>) => a.store.getState().status;

beforeEach(() => {
  vi.useFakeTimers();
  version = 0;
  sends = [];
  respond = async (req) => ({ kind: 'ok', revision: req.baseRevision + 1 });
});
afterEach(() => vi.useRealTimers());

describe('autosave', () => {
  it('debounces 800 ms after the last change', async () => {
    const a = make();
    edit(a);
    await vi.advanceTimersByTimeAsync(500);
    edit(a);
    await vi.advanceTimersByTimeAsync(799);
    expect(sends).toHaveLength(0);
    await vi.advanceTimersByTimeAsync(1);
    expect(sends).toHaveLength(1);
    expect(sends[0]!.baseRevision).toBe(4);
    expect(a.store.getState()).toMatchObject({ status: 'saved', revision: 5, savedVersion: 2 });
  });
  it('saves at most every 5 s during continuous typing', async () => {
    const a = make();
    for (let t = 0; t < 5200; t += 200) {
      edit(a);
      await vi.advanceTimersByTimeAsync(200);
    }
    expect(sends.length).toBeGreaterThanOrEqual(1);
  });
  it('keeps one request in flight and saves later changes afterwards', async () => {
    let release!: () => void;
    respond = (req) =>
      new Promise((r) => {
        release = () => r({ kind: 'ok', revision: req.baseRevision + 1 });
      });
    const a = make();
    edit(a);
    await vi.advanceTimersByTimeAsync(800);
    expect(status(a)).toBe('saving');
    edit(a);
    await vi.advanceTimersByTimeAsync(2000);
    expect(sends).toHaveLength(1);
    release();
    await vi.advanceTimersByTimeAsync(800);
    expect(sends).toHaveLength(2);
    expect(sends[1]!.baseRevision).toBe(5);
  });
  it('stops on a conflict until overwrite() saves on top of the server revision', async () => {
    respond = async () => ({ kind: 'conflict', revision: 9, saveId: null });
    const a = make();
    edit(a);
    await vi.advanceTimersByTimeAsync(800);
    expect(a.store.getState()).toMatchObject({ status: 'conflict', conflictRevision: 9 });
    edit(a);
    await vi.advanceTimersByTimeAsync(5000);
    expect(sends).toHaveLength(1);
    respond = async (req) => ({ kind: 'ok', revision: req.baseRevision + 1 });
    await a.overwrite();
    expect(sends[1]!.baseRevision).toBe(9);
    expect(a.store.getState()).toMatchObject({ status: 'saved', revision: 10 });
  });
  it('a save that landed but lost its response is recognized by its id: the retry rebases', async () => {
    // The server commits the first save, then the response is lost on the way back.
    let revision = 4;
    let saveId: string | null = null;
    let drop = true;
    respond = async (req) => {
      if (req.baseRevision !== revision) return { kind: 'conflict', revision, saveId };
      revision += 1;
      saveId = req.saveId;
      if (!drop) return { kind: 'ok', revision };
      drop = false;
      return { kind: 'network' };
    };
    const a = make();
    edit(a);
    await vi.advanceTimersByTimeAsync(800);
    expect(status(a)).toBe('offline');
    edit(a);
    await vi.advanceTimersByTimeAsync(2000); // the retry gets a 409 that names the first save
    await vi.runOnlyPendingTimersAsync(); // and the rebased save goes out right away
    expect(sends.map((s) => s.baseRevision)).toEqual([4, 4, 5]);
    expect(new Set(sends.map((s) => s.saveId)).size).toBe(3);
    expect(a.store.getState()).toMatchObject({ status: 'saved', revision: 6 });
  });
  it('a conflict naming a save this tab never sent stays a conflict', async () => {
    respond = async () => ({ kind: 'network' });
    const a = make();
    edit(a);
    await vi.advanceTimersByTimeAsync(800);
    respond = async () => ({ kind: 'conflict', revision: 7, saveId: 'from-another-tab' });
    await vi.advanceTimersByTimeAsync(2000);
    expect(a.store.getState()).toMatchObject({ status: 'conflict', conflictRevision: 7 });
  });
  it('network errors retry with backoff and recover', async () => {
    respond = async () => ({ kind: 'network' });
    const a = make();
    edit(a);
    await vi.advanceTimersByTimeAsync(800);
    expect(status(a)).toBe('offline');
    await vi.advanceTimersByTimeAsync(2000);
    expect(sends).toHaveLength(2);
    await vi.advanceTimersByTimeAsync(4000);
    expect(sends).toHaveLength(3);
    respond = async (req) => ({ kind: 'ok', revision: req.baseRevision + 1 });
    await vi.advanceTimersByTimeAsync(8000);
    expect(status(a)).toBe('saved');
  });
  it('retry() saves immediately', async () => {
    respond = async () => ({ kind: 'network' });
    const a = make();
    edit(a);
    await vi.advanceTimersByTimeAsync(800);
    respond = async (req) => ({ kind: 'ok', revision: req.baseRevision + 1 });
    a.retry();
    await vi.advanceTimersByTimeAsync(0);
    expect(status(a)).toBe('saved');
  });
  it('a rejected save shows its message and waits for the next change', async () => {
    respond = async () => ({ kind: 'rejected', status: 413, message: 'too large' });
    const a = make();
    edit(a);
    await vi.advanceTimersByTimeAsync(800);
    expect(a.store.getState()).toMatchObject({ status: 'error', error: 'too large' });
    await vi.advanceTimersByTimeAsync(60_000);
    expect(sends).toHaveLength(1);
  });
  it('flush while unloading sends keepalive without waiting for the debounce', async () => {
    const a = make();
    edit(a);
    await a.flush({ unloading: true });
    expect(sends).toHaveLength(1);
    expect(sends[0]!.keepalive).toBe(true);
  });
  it('flush is a no-op when everything is saved', async () => {
    const a = make();
    await a.flush();
    expect(sends).toHaveLength(0);
  });
  it('dispose cancels pending saves', async () => {
    const a = make();
    edit(a);
    a.dispose();
    await vi.advanceTimersByTimeAsync(10_000);
    expect(sends).toHaveLength(0);
  });
});
