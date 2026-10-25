import { html as parse5Html, parseFragment, serialize, type DefaultTreeAdapterTypes } from 'parse5';
import { escapeInlineStyle } from '@/lib/renderer/html';
import { sanitizeUrl } from '@/lib/renderer/url';

// Default-deny HTML sanitizer (docs/DECISIONS.md D-053): parses with parse5 (nothing ever runs),
// keeps only listed tags and attributes, and serializes. Pure and deterministic, so it runs in the
// renderer on both server and browser. Used by Custom HTML in export and, later, by HTML import.

type Node = DefaultTreeAdapterTypes.ChildNode;
type Element = DefaultTreeAdapterTypes.Element;
type ParentNode = DefaultTreeAdapterTypes.ParentNode;

export interface SanitizeReport {
  /** Tags removed with their content (script, iframe, form, svg…), in first-seen order. */
  removedTags: string[];
  /** Unknown tags dropped while their content was kept (marquee, center…). */
  unwrappedTags: string[];
  removedAttributes: number;
  /** href/src/srcset values dropped as unsafe (javascript:, …). */
  removedUrls: number;
  hadScripts: boolean;
}

const ALLOWED = new Set(
  (
    'a abbr article aside b blockquote br caption cite code col colgroup dd del details dfn div ' +
    'dl dt em figcaption figure footer h1 h2 h3 h4 h5 h6 header hr i img ins kbd li mark ol p ' +
    'picture pre q s section small source span strong style sub summary sup table tbody td tfoot ' +
    'th thead time tr u ul'
  ).split(' '),
);

/** Removed together with everything inside them. */
const DROPPED = new Set(
  (
    'script template iframe object embed frame frameset noscript form input button ' +
    'select textarea link meta base svg math'
  ).split(' '),
);

const PER_TAG: Record<string, readonly string[]> = {
  a: ['href', 'target'],
  img: ['src', 'srcset', 'alt', 'width', 'height', 'loading', 'decoding', 'sizes'],
  source: ['src', 'srcset', 'sizes', 'media', 'type'],
  td: ['colspan', 'rowspan', 'scope'],
  th: ['colspan', 'rowspan', 'scope'],
  ol: ['start', 'reversed'],
  time: ['datetime'],
  details: ['open'],
};
const GLOBAL = new Set(['class', 'id', 'title', 'lang', 'dir', 'role', 'style']);
const RESERVED_ID = /^[bs]-/;
const UNSAFE_CSS = /url\s*\(|expression\s*\(|@import|javascript:|\\/i;

/** "a.webp 1x, b.webp 2x" with every URL checked; null when any is unsafe. */
function cleanSrcset(value: string): string | null {
  const parts = value.split(',').map((part) => part.trim().split(/\s+/));
  for (const [url] of parts) if (!url || sanitizeUrl(url, 'image') === null) return null;
  return parts.map((part) => part.join(' ')).join(', ');
}

/**
 * Drops @import rules and declarations that load URLs (except data images), use expression() or
 * hide anything behind an escape. Works chunk by chunk between `;`, `{` and `}`, so it stays linear
 * on long values (a 40 KB data URI) and a rule split around another one can't rejoin.
 */
function cleanCss(css: string): string {
  return css
    .split(/([;{}])/)
    .map((chunk) =>
      /@import|expression\s*\(|\\/i.test(chunk) || /url\s*\(\s*(?!['"]?data:image\/)/i.test(chunk)
        ? ''
        : chunk,
    )
    .join('');
}

function cleanAttributes(el: Element, report: SanitizeReport): void {
  const tag = el.tagName;
  const allowed = PER_TAG[tag] ?? [];
  const kept: Element['attrs'] = [];
  for (const attr of el.attrs) {
    const name = attr.name.toLowerCase();
    let value: string | null = attr.value;
    if (name.startsWith('on')) report.hadScripts = true;
    if (name.startsWith('data-')) {
      if (name.startsWith('data-lp-')) value = null;
    } else if (name.startsWith('aria-')) {
      // kept
    } else if (GLOBAL.has(name)) {
      if (name === 'id' && RESERVED_ID.test(attr.value)) value = null;
      if (name === 'style' && UNSAFE_CSS.test(attr.value)) value = null;
    } else if (allowed.includes(name)) {
      if (name === 'href') value = sanitizeUrl(attr.value, 'link');
      else if (name === 'src') value = sanitizeUrl(attr.value, 'image');
      else if (name === 'srcset') value = cleanSrcset(attr.value);
      else if (name === 'target') value = attr.value === '_blank' ? '_blank' : null;
    } else {
      value = null;
    }
    if (value === null) {
      report.removedAttributes += 1;
      if (name === 'href' || name === 'src' || name === 'srcset') report.removedUrls += 1;
    } else kept.push({ name, value });
  }
  // A new tab never gets a handle on this page.
  if (tag === 'a' && kept.some((attr) => attr.name === 'target')) {
    kept.push({ name: 'rel', value: 'noopener' });
  }
  el.attrs = kept;
}

function note(list: string[], tag: string): void {
  if (!list.includes(tag)) list.push(tag);
}

/** The sanitized replacement for `node`: itself, its children (unwrapped), or nothing. */
function sanitizeNode(node: Node, report: SanitizeReport): Node[] {
  if (node.nodeName === '#text') return [node];
  if (!('tagName' in node)) return []; // comments, doctypes
  const el = node;
  const tag = el.tagName;
  const foreign = el.namespaceURI !== parse5Html.NS.HTML;
  if (foreign || DROPPED.has(tag)) {
    report.hadScripts ||= hasHandlers(el);
    note(report.removedTags, tag);
    return [];
  }
  if (!ALLOWED.has(tag)) {
    note(report.unwrappedTags, tag);
    return sanitizeChildren(el, report);
  }
  cleanAttributes(el, report);
  if (tag === 'style') {
    const text = el.childNodes.map((child) => ('value' in child ? child.value : '')).join('');
    const cleaned: DefaultTreeAdapterTypes.TextNode = {
      nodeName: '#text',
      value: escapeInlineStyle(cleanCss(text)),
      parentNode: el,
    };
    el.childNodes = [cleaned];
    return [el];
  }
  el.childNodes = sanitizeChildren(el, report);
  return [el];
}

function sanitizeChildren(parent: ParentNode, report: SanitizeReport): Node[] {
  const out = parent.childNodes.flatMap((child) => sanitizeNode(child, report));
  for (const child of out) child.parentNode = parent;
  return out;
}

function hasHandlers(node: Node): boolean {
  if (!('tagName' in node)) return false;
  if (node.tagName === 'script') return true;
  if (node.attrs.some((attr) => attr.name.toLowerCase().startsWith('on'))) return true;
  const children =
    node.nodeName === 'template'
      ? (node as DefaultTreeAdapterTypes.Template).content.childNodes
      : node.childNodes;
  return children.some(hasHandlers);
}

/** Parses with parse5 (never executes), keeps only allowed tags/attributes, serializes. Pure. */
export function sanitizeHtml(input: string): { html: string; report: SanitizeReport } {
  const report: SanitizeReport = {
    removedTags: [],
    unwrappedTags: [],
    removedAttributes: 0,
    removedUrls: 0,
    hadScripts: false,
  };
  const fragment = parseFragment(input);
  fragment.childNodes = sanitizeChildren(fragment, report);
  return { html: serialize(fragment), report };
}

/** True when the code holds a <script> element or an on* attribute (for the checklist). */
export function hasScripts(input: string): boolean {
  return parseFragment(input).childNodes.some(hasHandlers);
}
