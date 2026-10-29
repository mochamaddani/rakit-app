import { CANVAS_SOURCE, isForwardedShortcut, type CanvasRect } from './constants';
import { readInlineNodes } from './inline-nodes';

// Runs inside the sandboxed canvas iframe (docs/DECISIONS.md D-039). It reports geometry,
// pointer and key events to the editor and applies the editor's patches in place. Import only
// zod-free modules here: everything imported is bundled into the iframe (≤ 10 KB, D-044).

export interface RuntimeOptions {
  win: Window;
  channel: string;
  /** The bundle passes m => win.parent.postMessage(m, '*'). */
  post(message: Record<string, unknown>): void;
  /** The bundle passes e => e.source === win.parent. */
  isFromParent(event: MessageEvent): boolean;
  /** The bundle inserts a fresh <script> element before the runtime's own. */
  runScript(code: string): void;
}

const ID = /^[A-Za-z0-9]{1,32}$/;
const USER_TOGGLED = 'data-lp-user-toggled';
const OPEN_DEFAULT = 'data-lp-open-default';
const EDITING = 'data-lp-editing';

interface SavedNode {
  path: number[];
  tag: string;
  scrollLeft: number;
  scrollTop: number;
  open: boolean | null;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

// Node types rather than instanceof: the runtime must not depend on which realm built a node.
const asElement = (target: EventTarget | null): Element | null =>
  (target as Node | null)?.nodeType === 1 ? (target as Element) : null;

/** Scroll offsets and user-toggled <details>, by child-index path from the block root. */
function captureState(root: Element): SavedNode[] {
  const saved: SavedNode[] = [];
  const walk = (el: Element, path: number[]) => {
    const open =
      el.tagName === 'DETAILS' && el.hasAttribute(USER_TOGGLED)
        ? (el as HTMLDetailsElement).open
        : null;
    if (el.scrollLeft || el.scrollTop || open !== null) {
      saved.push({
        path,
        tag: el.tagName,
        scrollLeft: el.scrollLeft,
        scrollTop: el.scrollTop,
        open,
      });
    }
    Array.from(el.children).forEach((child, i) => walk(child, [...path, i]));
  };
  walk(root, []);
  return saved;
}

function restoreState(root: Element, saved: readonly SavedNode[]) {
  for (const node of saved) {
    let el: Element | undefined = root;
    for (const i of node.path) el = el?.children[i];
    if (!el || el.tagName !== node.tag) continue;
    if (node.open !== null) {
      (el as HTMLDetailsElement).open = node.open;
      el.setAttribute(USER_TOGGLED, '');
    }
    if (node.scrollLeft) el.scrollLeft = node.scrollLeft;
    if (node.scrollTop) el.scrollTop = node.scrollTop;
  }
}

/** Remembers each <details>'s open state from the markup, so only real user toggles carry over. */
function recordDetailsDefaults(root: ParentNode) {
  for (const details of Array.from(root.querySelectorAll('details'))) {
    if (!details.hasAttribute(OPEN_DEFAULT)) {
      details.setAttribute(OPEN_DEFAULT, details.open ? '1' : '0');
    }
  }
}

export function startPreviewRuntime(options: RuntimeOptions): () => void {
  const { win, channel } = options;
  const doc = win.document;
  const post = (message: Record<string, unknown>) =>
    options.post({ source: CANVAS_SOURCE, channel, ...message });

  let rev = 0;
  let frame = 0;
  let hovered: string | null = null;
  /** The field being edited in place (docs/DECISIONS.md D-044). */
  let editing: { el: HTMLElement; blockId: string; path: string; frame: number } | null = null;
  const pageScript = Array.from(doc.body.querySelectorAll('script')).find(
    (script) => !script.hasAttribute('data-lp-channel'),
  );
  let latestJs = pageScript?.textContent ?? '';

  const blockElement = (id: string) =>
    ID.test(id) ? doc.querySelector(`[data-lp-block="${id}"]`) : null;

  const rectOf = (el: Element, id: string): CanvasRect => {
    let r = el.getBoundingClientRect();
    // A fixed bar (Sticky CTA) leaves its wrapper with no height; use the bar.
    if (r.height === 0 && el.firstElementChild) r = el.firstElementChild.getBoundingClientRect();
    return { id, top: r.top, left: r.left, width: r.width, height: r.height };
  };

  const reportRects = () => {
    frame = 0;
    const collect = (attribute: string) =>
      Array.from(doc.querySelectorAll(`[${attribute}]`)).map((el) =>
        rectOf(el, el.getAttribute(attribute) ?? ''),
      );
    post({
      type: 'rects',
      rev,
      scrollY: win.scrollY,
      viewportWidth: win.innerWidth,
      viewportHeight: win.innerHeight,
      docHeight: doc.documentElement.scrollHeight,
      sections: collect('data-lp-section'),
      blocks: collect('data-lp-block'),
    });
  };
  const scheduleRects = () => {
    if (!frame) frame = win.requestAnimationFrame(reportRects);
  };

  const parseBlock = (id: string, markup: string): Element => {
    const template = doc.createElement('template');
    template.innerHTML = markup;
    const el = template.content.firstElementChild;
    if (!el || el.getAttribute('data-lp-block') !== id) throw new Error(`Bad markup for ${id}`);
    recordDetailsDefaults(el);
    return el;
  };

  function applySync(message: Record<string, unknown>) {
    if (typeof message.css === 'string') {
      const style =
        doc.head.querySelector('style') ?? doc.head.appendChild(doc.createElement('style'));
      style.textContent = message.css;
    }
    if (typeof message.lang === 'string') doc.documentElement.lang = message.lang;

    const fresh = new Map<string, string>();
    for (const entry of Array.isArray(message.blocks) ? message.blocks : []) {
      if (!isRecord(entry) || typeof entry.id !== 'string' || !ID.test(entry.id)) {
        throw new Error('Bad block patch');
      }
      // The block being edited keeps its element until editing ends, so the caret stays put.
      if (entry.id !== editing?.blockId) fresh.set(entry.id, String(entry.html));
    }

    let changed = fresh.size > 0;
    if (typeof message.skeleton === 'string') {
      const template = doc.createElement('template');
      template.innerHTML = message.skeleton;
      const slots = Array.from(template.content.querySelectorAll('[data-lp-slot]'));
      const existing = new Map<string, Element>();
      // Check every slot before touching the live page, so a bad sync leaves it intact.
      for (const slot of slots) {
        const id = slot.getAttribute('data-lp-slot') ?? '';
        const current = blockElement(id);
        if (!fresh.has(id) && !current) throw new Error(`No block for slot ${id}`);
        if (current) existing.set(id, current);
      }
      // Detaching an element resets its scroll, so state is saved for moved blocks too.
      const saved = new Map([...existing].map(([id, el]) => [id, captureState(el)]));
      for (const slot of slots) {
        const id = slot.getAttribute('data-lp-slot') ?? '';
        const markup = fresh.get(id);
        slot.replaceWith(markup === undefined ? existing.get(id)! : parseBlock(id, markup));
      }
      for (const child of Array.from(doc.body.childNodes)) {
        if (child.nodeName !== 'SCRIPT') child.remove();
      }
      doc.body.insertBefore(template.content, doc.body.querySelector('script'));
      for (const [id, state] of saved) {
        const el = blockElement(id);
        if (el) restoreState(el, state);
      }
      changed = true;
    } else {
      for (const [id, markup] of fresh) {
        const current = blockElement(id);
        if (!current) throw new Error(`No block ${id}`);
        const state = captureState(current);
        const next = parseBlock(id, markup);
        current.replaceWith(next);
        restoreState(next, state);
      }
    }

    if (typeof message.js === 'string') latestJs = message.js;
    // Snippets are idempotent per root (data-lp-ready): only new roots initialize.
    if ((typeof message.js === 'string' || changed) && latestJs) options.runScript(latestJs);
  }

  // Custom HTML frames (D-053) report their content height; nothing else from a child frame counts.
  const frameHeights = new Map<HTMLElement, number>();
  let heightFrame = 0;
  const resizeCustomFrame = (event: MessageEvent): boolean => {
    const data: unknown = event.data;
    if (!event.source || !isRecord(data) || typeof data.lpHeight !== 'number') return false;
    if (!Number.isFinite(data.lpHeight)) return true;
    // Only the renderer emits this attribute (the sanitizer drops every data-lp-* one).
    const frameEl = Array.from(doc.querySelectorAll('[data-lp-custom-frame]')).find(
      (el) => (el as HTMLIFrameElement).contentWindow === event.source,
    ) as HTMLIFrameElement | undefined;
    if (!frameEl) return false;
    frameHeights.set(frameEl, Math.max(20, Math.min(4000, Math.ceil(data.lpHeight))));
    if (!heightFrame) {
      heightFrame = win.requestAnimationFrame(() => {
        heightFrame = 0;
        frameHeights.forEach((height, el) => (el.style.height = `${height}px`));
        frameHeights.clear();
        scheduleRects();
      });
    }
    return true;
  };

  const onMessage = (event: MessageEvent) => {
    if (resizeCustomFrame(event)) return;
    if (!options.isFromParent(event)) return;
    const message: unknown = event.data;
    if (!isRecord(message) || message.source !== CANVAS_SOURCE || message.channel !== channel) {
      return;
    }
    if (message.type === 'hello') {
      post({ type: 'ready' });
    } else if (message.type === 'sync') {
      try {
        applySync(message);
        if (Number.isInteger(message.rev)) rev = message.rev as number;
        post({ type: 'synced', rev });
        scheduleRects();
      } catch (error) {
        post({
          type: 'error',
          message: String(error instanceof Error ? error.message : error).slice(0, 500),
        });
      }
    } else if (message.type === 'scrollTo' && typeof message.blockId === 'string') {
      blockElement(message.blockId)?.scrollIntoView({ block: 'start', behavior: 'smooth' });
    } else if (message.type === 'scrollBy' && Number.isFinite(message.dy)) {
      win.scrollBy(0, Math.max(-2000, Math.min(2000, message.dy as number)));
      // At the scroll edge nothing scrolls, but the drag layer still waits for rects.
      scheduleRects();
    }
  };

  const closestId = (target: EventTarget | null, attribute: string): string | null => {
    const el = asElement(target)?.closest(`[${attribute}]`);
    return el?.getAttribute(attribute) ?? null;
  };

  const inField = (target: EventTarget | null) =>
    editing !== null && target !== null && editing.el.contains(target as Node);

  const postEdit = () => {
    if (!editing) return;
    editing.frame = 0;
    post({
      type: 'edit',
      blockId: editing.blockId,
      path: editing.path,
      nodes: readInlineNodes(editing.el),
    });
  };

  const endEditing = () => {
    const current = editing;
    if (!current) return;
    if (current.frame) {
      win.cancelAnimationFrame(current.frame);
      postEdit();
    }
    editing = null;
    current.el.removeAttribute('contenteditable');
    current.el.removeAttribute(EDITING);
    post({ type: 'editEnd', blockId: current.blockId, path: current.path });
  };

  /** Selects the word under a point, or puts the caret there between words. */
  const selectWordAt = (el: HTMLElement, x: number, y: number) => {
    const d = doc as Partial<Pick<Document, 'caretPositionFromPoint' | 'caretRangeFromPoint'>>;
    const at = d.caretPositionFromPoint?.(x, y);
    const legacy = at ? null : d.caretRangeFromPoint?.(x, y);
    const node = at ? at.offsetNode : legacy?.startContainer;
    const offset = at ? at.offset : (legacy?.startOffset ?? 0);
    const selection = win.getSelection();
    if (!node || !selection || !el.contains(node)) return;
    const text = node.nodeType === 3 ? (node.nodeValue ?? '') : '';
    let start = offset;
    let end = offset;
    while (start > 0 && /\S/.test(text.charAt(start - 1))) start--;
    while (end < text.length && /\S/.test(text.charAt(end))) end++;
    const range = doc.createRange();
    range.setStart(node, start);
    range.setEnd(node, end);
    selection.removeAllRanges();
    selection.addRange(range);
  };

  const startEditing = (field: Element, x: number, y: number) => {
    const blockId = closestId(field, 'data-lp-block');
    const path = field.getAttribute('data-lp-field');
    if (!blockId || !path || editing?.el === field) return;
    endEditing();
    const el = field as HTMLElement;
    el.setAttribute('contenteditable', el.hasAttribute('data-lp-rich') ? 'true' : 'plaintext-only');
    el.setAttribute(EDITING, '');
    editing = { el, blockId, path, frame: 0 };
    // A double-click selects its word, and editing keeps it; in a link Chrome selects nothing.
    const selection = win.getSelection();
    const selected = !!selection && !selection.isCollapsed && el.contains(selection.anchorNode);
    el.focus();
    if (!selected) selectWordAt(el, x, y);
  };

  const onDoubleClick = (event: Event) => {
    const field = asElement(event.target)?.closest('[data-lp-field]');
    const { clientX, clientY } = event as MouseEvent;
    if (field?.closest('[data-lp-block]')) startEditing(field, clientX, clientY);
  };

  const onInput = (event: Event) => {
    if (editing && inField(event.target) && !editing.frame) {
      editing.frame = win.requestAnimationFrame(postEdit);
    }
  };

  /** Paste and drop bring plain text only; text fields keep to one line. */
  const insertPlain = (event: Event, text: string) => {
    event.preventDefault();
    if (!editing) return;
    if (!editing.el.hasAttribute('data-lp-rich')) {
      doc.execCommand('insertText', false, text.replace(/\s*\n\s*/g, ' '));
      return;
    }
    text.split(/\r?\n/).forEach((line, i) => {
      if (i > 0) doc.execCommand('insertLineBreak');
      if (line) doc.execCommand('insertText', false, line);
    });
  };
  const onPaste = (event: Event) => {
    if (inField(event.target)) {
      insertPlain(event, (event as ClipboardEvent).clipboardData?.getData('text/plain') ?? '');
    }
  };
  const onDrop = (event: Event) => {
    if (inField(event.target)) {
      insertPlain(event, (event as DragEvent).dataTransfer?.getData('text/plain') ?? '');
    }
  };
  const onFocusOut = (event: Event) => {
    if (editing && event.target === editing.el) endEditing();
  };

  const onPointerOver = (event: Event) => {
    const id = closestId(event.target, 'data-lp-block');
    if (id !== hovered) {
      hovered = id;
      post({ type: 'hover', blockId: id });
    }
  };
  const onPointerLeave = () => {
    if (hovered === null) return;
    hovered = null;
    post({ type: 'hover', blockId: null });
  };

  const onClick = (event: Event) => {
    // Inside the edited field a click only places the caret: no link, no <details> toggle.
    if (inField(event.target)) {
      event.preventDefault();
      return;
    }
    const target = asElement(event.target);
    // The canvas never navigates: links select their block instead.
    if (target?.closest('a[href]')) event.preventDefault();
    const blockId = closestId(target, 'data-lp-block');
    if (blockId) {
      post({ type: 'select', target: { kind: 'block', blockId } });
      return;
    }
    const sectionId = closestId(target, 'data-lp-section');
    if (sectionId) post({ type: 'select', target: { kind: 'section', sectionId } });
  };
  const onSubmit = (event: Event) => event.preventDefault();

  const onKeyDown = (event: Event) => {
    const key = event as KeyboardEvent;
    const input = {
      key: key.key,
      mod: key.metaKey || key.ctrlKey,
      shift: key.shiftKey,
      alt: key.altKey,
    };
    if (editing) {
      // Keys stay in the field; only undo and redo reach the editor, after editing ends. Block
      // scripts never see them either: the carousel would take the arrows to scroll its cards.
      if (inField(key.target)) key.stopPropagation();
      const letter = key.key.toLowerCase();
      if (key.key === 'Escape') {
        key.preventDefault();
        endEditing();
      } else if (key.key === 'Enter') {
        key.preventDefault();
        if (editing.el.hasAttribute('data-lp-rich')) doc.execCommand('insertLineBreak');
        else endEditing();
      } else if (input.mod && !input.alt && (letter === 'z' || letter === 'y')) {
        key.preventDefault();
        endEditing();
        post({ type: 'key', input });
      } else if (input.mod && (letter === 'd' || letter === 'u')) {
        key.preventDefault();
      } else if (key.key === ' ' && !input.mod && editing.el.closest('summary')) {
        // A <summary> takes Space as its toggle and would swallow the character.
        key.preventDefault();
        doc.execCommand('insertText', false, ' ');
      }
      return;
    }
    if (!isForwardedShortcut(input)) return;
    key.preventDefault();
    post({ type: 'key', input });
  };

  const onToggle = (event: Event) => {
    const details = asElement(event.target);
    if (details?.nodeName === 'DETAILS') {
      const byDefault = details.getAttribute(OPEN_DEFAULT) === '1';
      if ((details as HTMLDetailsElement).open === byDefault) details.removeAttribute(USER_TOGGLED);
      else details.setAttribute(USER_TOGGLED, '');
    }
    scheduleRects();
  };

  recordDetailsDefaults(doc);
  win.addEventListener('message', onMessage);
  win.addEventListener('scroll', scheduleRects, { passive: true });
  win.addEventListener('resize', scheduleRects);
  doc.addEventListener('pointerover', onPointerOver);
  doc.documentElement.addEventListener('pointerleave', onPointerLeave);
  doc.addEventListener('click', onClick, true);
  doc.addEventListener('submit', onSubmit, true);
  doc.addEventListener('keydown', onKeyDown, true);
  doc.addEventListener('toggle', onToggle, true);
  doc.addEventListener('load', scheduleRects, true);
  doc.addEventListener('dblclick', onDoubleClick, true);
  doc.addEventListener('input', onInput, true);
  doc.addEventListener('paste', onPaste, true);
  doc.addEventListener('drop', onDrop, true);
  doc.addEventListener('focusout', onFocusOut, true);
  win.addEventListener('blur', endEditing);
  const resizes = typeof ResizeObserver === 'function' ? new ResizeObserver(scheduleRects) : null;
  resizes?.observe(doc.body);

  post({ type: 'ready' });
  scheduleRects();

  return () => {
    win.removeEventListener('message', onMessage);
    win.removeEventListener('scroll', scheduleRects);
    win.removeEventListener('resize', scheduleRects);
    doc.removeEventListener('pointerover', onPointerOver);
    doc.documentElement.removeEventListener('pointerleave', onPointerLeave);
    doc.removeEventListener('click', onClick, true);
    doc.removeEventListener('submit', onSubmit, true);
    doc.removeEventListener('keydown', onKeyDown, true);
    doc.removeEventListener('toggle', onToggle, true);
    doc.removeEventListener('load', scheduleRects, true);
    doc.removeEventListener('dblclick', onDoubleClick, true);
    doc.removeEventListener('input', onInput, true);
    doc.removeEventListener('paste', onPaste, true);
    doc.removeEventListener('drop', onDrop, true);
    doc.removeEventListener('focusout', onFocusOut, true);
    win.removeEventListener('blur', endEditing);
    resizes?.disconnect();
    if (frame) win.cancelAnimationFrame(frame);
  };
}
