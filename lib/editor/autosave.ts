import { createStore, type StoreApi } from 'zustand/vanilla';
import type { PageDocument } from '@/lib/schema/document';

// Saves the draft in the background (docs/DECISIONS.md D-035): debounced, never more than one
// request in flight, retried with backoff when offline, and stopped on a conflict until the user
// decides. Time comes from the global timers, so tests drive it with fake timers.

export type SaveStatus = 'saved' | 'dirty' | 'saving' | 'offline' | 'error' | 'conflict';

export interface AutosaveState {
  status: SaveStatus;
  revision: number;
  /** The document version the server holds. */
  savedVersion: number;
  error: string | null;
  conflictRevision: number | null;
}

export interface SaveRequest {
  doc: PageDocument;
  baseRevision: number;
  keepalive: boolean;
}

export type SaveResponse =
  | { kind: 'ok'; revision: number }
  | { kind: 'conflict'; revision: number }
  /** 4xx other than 409. */
  | { kind: 'rejected'; status: number; message: string }
  /** fetch threw, or 5xx. */
  | { kind: 'network' };

export interface AutosaveOptions {
  initialRevision: number;
  getSnapshot(): { doc: PageDocument; version: number };
  send(request: SaveRequest): Promise<SaveResponse>;
  debounceMs?: number;
  maxWaitMs?: number;
  /** The last delay repeats. */
  retryDelaysMs?: readonly number[];
  now?(): number;
}

export interface Autosave {
  readonly store: StoreApi<AutosaveState>;
  changed(version: number): void;
  /** Saves now when unsaved changes exist; resolves after the in-flight save settles. */
  flush(options?: { unloading?: boolean }): Promise<void>;
  /** After a conflict: saves the local document over the server copy. */
  overwrite(): Promise<void>;
  retry(): void;
  dispose(): void;
}

export function createAutosave(options: AutosaveOptions): Autosave {
  const debounceMs = options.debounceMs ?? 800;
  const maxWaitMs = options.maxWaitMs ?? 5000;
  const retryDelays = options.retryDelaysMs ?? [2000, 4000, 8000, 16000, 30000];
  const now = options.now ?? (() => Date.now());

  const store = createStore<AutosaveState>()(() => ({
    status: 'saved',
    revision: options.initialRevision,
    savedVersion: 0,
    error: null,
    conflictRevision: null,
  }));
  const state = () => store.getState();

  let timer: ReturnType<typeof setTimeout> | undefined;
  let inFlight: Promise<void> | null = null;
  /** When the oldest change that no request has carried yet was made. */
  let firstUnsentAt: number | null = null;
  let retries = 0;
  let disposed = false;

  const clearTimer = () => {
    if (timer !== undefined) clearTimeout(timer);
    timer = undefined;
  };
  const unsaved = () => options.getSnapshot().version > state().savedVersion;

  const scheduleDebounced = () => {
    clearTimer();
    const waited = firstUnsentAt === null ? 0 : now() - firstUnsentAt;
    timer = setTimeout(
      () => void save(false),
      Math.max(0, Math.min(debounceMs, maxWaitMs - waited)),
    );
  };

  const scheduleRetry = () => {
    clearTimer();
    const delay = retryDelays[Math.min(retries, retryDelays.length - 1)] ?? 30000;
    retries += 1;
    timer = setTimeout(() => void save(false), delay);
  };

  function settle(response: SaveResponse, sentVersion: number) {
    switch (response.kind) {
      case 'ok':
        retries = 0;
        store.setState({ revision: response.revision, savedVersion: sentVersion, error: null });
        if (unsaved()) {
          store.setState({ status: 'dirty' });
          scheduleDebounced();
        } else {
          store.setState({ status: 'saved' });
        }
        return;
      case 'conflict':
        clearTimer();
        store.setState({ status: 'conflict', conflictRevision: response.revision });
        return;
      case 'network':
        store.setState({ status: 'offline' });
        scheduleRetry();
        return;
      case 'rejected':
        store.setState({ status: 'error', error: response.message });
        return;
    }
  }

  async function save(keepalive: boolean): Promise<void> {
    clearTimer();
    if (disposed) return;
    if (inFlight) {
      await inFlight;
      return;
    }
    const { doc, version } = options.getSnapshot();
    if (version <= state().savedVersion || state().status === 'conflict') return;
    firstUnsentAt = null;
    store.setState({ status: 'saving' });
    inFlight = options
      .send({ doc, baseRevision: state().revision, keepalive })
      .then((response) => {
        if (!disposed) settle(response, version);
      })
      .finally(() => {
        inFlight = null;
      });
    await inFlight;
  }

  return {
    store,

    changed() {
      if (disposed) return;
      const { status } = state();
      // A conflict waits for the user; offline retries pick up the latest snapshot on their own.
      if (status === 'conflict') return;
      if (firstUnsentAt === null) firstUnsentAt = now();
      if (status === 'saving' || status === 'offline') return;
      store.setState({ status: 'dirty', error: null });
      scheduleDebounced();
    },

    async flush({ unloading = false } = {}) {
      if (inFlight) await inFlight;
      if (unsaved()) await save(unloading);
    },

    async overwrite() {
      const { status, conflictRevision } = state();
      if (status !== 'conflict' || conflictRevision === null) return;
      store.setState({ status: 'dirty', revision: conflictRevision, conflictRevision: null });
      await save(false);
    },

    retry() {
      if (state().status === 'conflict') return;
      retries = 0;
      void save(false);
    },

    dispose() {
      disposed = true;
      clearTimer();
    },
  };
}
