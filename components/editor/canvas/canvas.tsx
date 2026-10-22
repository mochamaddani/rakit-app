'use client';

import { useCallback, useEffect, useLayoutEffect, useRef, useState, type RefObject } from 'react';
import type { KeyInput } from '@/lib/editor/canvas/constants';
import {
  envelope,
  parseCanvasEvent,
  type CanvasCommand,
  type CanvasEvent,
} from '@/lib/editor/canvas/protocol';
import { createBlockHtmlCache, type BlockHtmlCache } from '@/lib/editor/canvas/render-cache';
import { buildSrcdoc } from '@/lib/editor/canvas/srcdoc';
import { canvasState, diffCanvas, type CanvasState } from '@/lib/editor/canvas/sync';
import { VIEWPORT_WIDTHS } from '@/lib/editor/store';
import { applyInlineEdit, finishInlineEdit } from '@/lib/editor/inline-edit';
import { findBlock, findSection } from '@/lib/editor/structure';
import { createId } from '@/lib/schema/ids';
import { useDragState } from '../dnd/drag-context';
import { useEditor, useEditorStore } from '../editor-context';
import type { CanvasHandle } from './canvas-handle';
import { Overlay, type CanvasGeometry } from './overlay';

declare global {
  interface Window {
    /** Development only: canvas timings read by the performance e2e test. */
    __lpCanvasMetrics?: { syncLatencies: number[]; readyMs: number | null };
  }
}

const READY_TIMEOUT_MS = 5000;
const PADDING = 16;

interface Frame {
  channel: string;
  srcdoc: string;
}

/** Mutable sync bookkeeping; kept out of React state so per-frame updates never re-render. */
interface SyncState {
  cache: BlockHtmlCache;
  /** What the iframe shows now, as last sent. */
  sent: CanvasState | null;
  channel: string | null;
  ready: boolean;
  rev: number;
  raf: number;
  /** When the oldest change not yet sent was made (for the latency metric). */
  changedAt: number | null;
  pending: { rev: number; at: number }[];
  pendingScroll: string | null;
  selectedFromCanvas: string | null;
  startedAt: number;
}

const newSyncState = (): SyncState => ({
  cache: createBlockHtmlCache(),
  sent: null,
  channel: null,
  ready: false,
  rev: 0,
  raf: 0,
  changedAt: null,
  pending: [],
  pendingScroll: null,
  selectedFromCanvas: null,
  startedAt: 0,
});

function metrics() {
  if (process.env.NODE_ENV === 'production') return null;
  window.__lpCanvasMetrics ??= { syncLatencies: [], readyMs: null };
  return window.__lpCanvasMetrics;
}

/**
 * The live canvas: a sandboxed srcdoc iframe running the preview runtime (D-039). Document
 * changes are diffed against what the iframe shows and sent once per animation frame.
 */
export function Canvas({
  onKey,
  handleRef,
}: {
  onKey?: (input: KeyInput) => void;
  /** Filled with the drag layer's view of the canvas (D-043). */
  handleRef?: RefObject<CanvasHandle | null>;
}) {
  const store = useEditorStore();
  const viewport = useEditor((s) => s.viewport);
  const selection = useEditor((s) => s.selection);
  const isEmpty = useEditor((s) => s.doc.sections.length === 0);
  const paneRef = useRef<HTMLDivElement>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const onKeyRef = useRef(onKey);
  const sync = useRef(newSyncState());
  const geometryRef = useRef<CanvasGeometry | null>(null);
  const built = useRef(false);
  const [pane, setPane] = useState({ width: 0, height: 0 });
  const [frame, setFrame] = useState<Frame | null>(null);
  const [ready, setReady] = useState(false);
  const [geometry, setGeometry] = useState<CanvasGeometry | null>(null);
  const [hover, setHover] = useState<string | null>(null);
  const dragging = useDragState().source !== null;
  const draggingRef = useRef(false);
  const scaleRef = useRef(1);
  const geometryListeners = useRef(new Set<() => void>());

  const post = useCallback((command: CanvasCommand) => {
    const target = iframeRef.current?.contentWindow;
    const { channel } = sync.current;
    // The iframe's origin is opaque, so it cannot be named as the target origin.
    if (target && channel) target.postMessage(envelope(channel, command), '*');
  }, []);

  const flushSync = useCallback(() => {
    const s = sync.current;
    s.raf = 0;
    if (!s.ready || !s.sent) return;
    const next = canvasState(store.getState().doc, s.cache);
    const payload = diffCanvas(s.sent, next);
    s.sent = next;
    if (payload) {
      s.rev += 1;
      if (s.changedAt !== null) s.pending.push({ rev: s.rev, at: s.changedAt });
      post({ type: 'sync', rev: s.rev, ...payload });
    }
    s.changedAt = null;
    if (s.pendingScroll) {
      post({ type: 'scrollTo', blockId: s.pendingScroll });
      s.pendingScroll = null;
    }
  }, [store, post]);

  const buildFrame = useCallback(() => {
    const s = sync.current;
    const doc = store.getState().doc;
    const channel = createId();
    Object.assign(s, {
      channel,
      sent: canvasState(doc, s.cache),
      ready: false,
      rev: 0,
      pending: [],
      changedAt: null,
      startedAt: performance.now(),
    });
    geometryRef.current = null;
    setReady(false);
    setGeometry(null);
    setFrame({ channel, srcdoc: buildSrcdoc(doc, channel) });
  }, [store]);

  useEffect(() => {
    onKeyRef.current = onKey;
  }, [onKey]);

  useEffect(() => {
    draggingRef.current = dragging;
  }, [dragging]);

  useEffect(() => {
    if (!handleRef) return;
    const listeners = geometryListeners.current;
    handleRef.current = {
      frame: () => iframeRef.current,
      scale: () => scaleRef.current,
      geometry: () => geometryRef.current,
      scrollBy: (dy) => post({ type: 'scrollBy', dy }),
      onGeometry: (listener) => {
        listeners.add(listener);
        return () => listeners.delete(listener);
      },
    };
    return () => {
      handleRef.current = null;
    };
  }, [handleRef, post]);

  // The frame is built on the client only, so the server HTML never carries a second copy of
  // the page. The ref guard keeps StrictMode's double effect from building it twice.
  useEffect(() => {
    if (built.current) return;
    built.current = true;
    buildFrame();
  }, [buildFrame]);

  useEffect(() => {
    if (!frame) return;
    const timer = setTimeout(() => {
      if (!sync.current.ready) buildFrame();
    }, READY_TIMEOUT_MS);
    return () => clearTimeout(timer);
  }, [frame, buildFrame]);

  useEffect(() => {
    const handle = (message: CanvasEvent) => {
      const s = sync.current;
      const { doc, select } = store.getState();
      switch (message.type) {
        case 'ready': {
          const m = metrics();
          if (m && !s.ready) m.readyMs = performance.now() - s.startedAt;
          s.ready = true;
          setReady(true);
          flushSync();
          return;
        }
        case 'rects': {
          const next = {
            scrollY: message.scrollY,
            viewportWidth: message.viewportWidth,
            viewportHeight: message.viewportHeight,
            sections: message.sections,
            blocks: message.blocks,
          };
          geometryRef.current = next;
          setGeometry(next);
          for (const listener of geometryListeners.current) listener();
          return;
        }
        case 'hover':
          setHover(
            message.blockId !== null && findBlock(doc, message.blockId) ? message.blockId : null,
          );
          return;
        case 'select': {
          const { target } = message;
          if (target.kind === 'block' && findBlock(doc, target.blockId)) {
            s.selectedFromCanvas = target.blockId;
            select({ kind: 'block', blockId: target.blockId });
          } else if (target.kind === 'section' && findSection(doc, target.sectionId) >= 0) {
            select({ kind: 'section', sectionId: target.sectionId });
          }
          return;
        }
        case 'key':
          // A drag owns the keyboard until it ends.
          if (!draggingRef.current) onKeyRef.current?.(message.input);
          return;
        case 'synced': {
          const m = metrics();
          const now = performance.now();
          s.pending = s.pending.filter((entry) => {
            if (entry.rev > message.rev) return true;
            m?.syncLatencies.push(now - entry.at);
            return false;
          });
          return;
        }
        case 'edit':
          applyInlineEdit(store, message);
          return;
        case 'editEnd': {
          finishInlineEdit(store);
          // The canvas showed what was typed; re-render the block from the document, which also
          // restores a field whose last edit could not be stored.
          if (s.sent) {
            const blocks = new Map(s.sent.blocks);
            blocks.delete(message.blockId);
            s.sent = { ...s.sent, blocks };
          }
          if (!s.raf) s.raf = requestAnimationFrame(flushSync);
          return;
        }
        case 'error':
          buildFrame();
          return;
      }
    };
    // Every message is untrusted: it must come from the current iframe, on its channel, and
    // pass the schema; ids are checked against the document before anything acts on them.
    const onMessage = (event: MessageEvent) => {
      const { channel } = sync.current;
      const iframe = iframeRef.current;
      if (!iframe || !channel || event.source !== iframe.contentWindow) return;
      const message = parseCanvasEvent(event.data, channel);
      if (message) handle(message);
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [store, flushSync, buildFrame]);

  useEffect(() => {
    const s = sync.current;
    const unsubscribe = store.subscribe((state, previous) => {
      if (state.doc === previous.doc) return;
      s.changedAt ??= performance.now();
      if (!s.raf) s.raf = requestAnimationFrame(flushSync);
    });
    return () => {
      unsubscribe();
      cancelAnimationFrame(s.raf);
      s.raf = 0;
    };
  }, [store, flushSync]);

  // Bring a block selected outside the canvas (palette, inspector, keyboard) into view.
  useEffect(() => {
    const s = sync.current;
    if (selection?.kind !== 'block') return;
    const fromCanvas = s.selectedFromCanvas === selection.blockId;
    s.selectedFromCanvas = null;
    if (fromCanvas) return;
    if (s.raf) {
      // A sync is about to go out (e.g. the block was just added): scroll after it.
      s.pendingScroll = selection.blockId;
      return;
    }
    const g = geometryRef.current;
    const rect = g?.blocks.find((b) => b.id === selection.blockId);
    if (!g || !rect || rect.top < 0 || rect.top > g.viewportHeight - 40) {
      post({ type: 'scrollTo', blockId: selection.blockId });
    }
  }, [selection, post]);

  useLayoutEffect(() => {
    const el = paneRef.current;
    if (!el) return;
    // ResizeObserver reports the initial size right after observe().
    const observer = new ResizeObserver(() =>
      setPane({ width: el.clientWidth, height: el.clientHeight }),
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const deviceWidth = VIEWPORT_WIDTHS[viewport];
  const available = Math.max(0, pane.width - PADDING * 2);
  const scale = available > 0 ? Math.min(1, available / deviceWidth) : 1;
  const frameHeight = Math.max(0, pane.height - PADDING * 2) / scale;

  useEffect(() => {
    scaleRef.current = scale;
  }, [scale]);

  return (
    <div ref={paneRef} className="relative min-w-0 flex-1 overflow-hidden bg-muted">
      {frame && pane.width > 0 ? (
        <div
          className="absolute top-4 left-1/2 -translate-x-1/2"
          style={{ width: deviceWidth * scale, height: frameHeight * scale }}
        >
          <iframe
            key={frame.channel}
            ref={iframeRef}
            title="Page preview"
            sandbox="allow-scripts"
            srcDoc={frame.srcdoc}
            data-ready={ready ? 'true' : undefined}
            onLoad={() => post({ type: 'hello' })}
            className="block origin-top-left border-0 bg-white shadow-sm"
            style={{ width: deviceWidth, height: frameHeight, transform: `scale(${scale})` }}
          />
          {/* While dragging, every pointer event stays in the editor (D-034). */}
          {dragging ? <div data-testid="canvas-shield" className="absolute inset-0" /> : null}
          <Overlay geometry={geometry} hover={hover} scale={scale} width={deviceWidth * scale} />
        </div>
      ) : null}
      {isEmpty ? (
        <p className="pointer-events-none absolute inset-0 flex items-center justify-center p-8 text-center text-sm text-muted-foreground">
          This page is empty. Add a block from the panel on the left.
        </p>
      ) : null}
    </div>
  );
}
