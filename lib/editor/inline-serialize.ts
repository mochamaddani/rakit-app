import { renderInline } from '@/lib/renderer/inline';
import { sanitizeUrl } from '@/lib/renderer/url';
import type { InlineNode } from './canvas/inline-nodes';

// Inline markup from edited canvas fields (docs/DECISIONS.md D-009, D-044). The output is
// canonical: an escape stays only where removing it would change the rendered HTML.

const ESCAPABLE = /[*=[\]\\]/;
/** Placeholders count as the text they are, so `[REPLACE: …]` never needs escaping. */
const PLAIN = { highlightPlaceholders: false };
const MARKERS = { strong: '**', em: '*', mark: '==' } as const;
/** What a mark may hold so its markers read back as that mark (lib/renderer/inline.ts). */
const MARK_CONTENT: Record<keyof typeof MARKERS, RegExp> = {
  strong: /^(?!.*\*\*)\S(?:.*\S)?$/,
  em: /^[^\s*](?:[^*]*[^\s*])?$/,
  mark: /^(?!.*==)\S(?:.*\S)?$/,
};

interface Draft {
  markup: string;
  /** Positions of the escape backslashes written. */
  escapes: number[];
}

function writeText(draft: Draft, text: string): void {
  for (const ch of text) {
    if (ESCAPABLE.test(ch)) {
      draft.escapes.push(draft.markup.length);
      draft.markup += '\\';
    }
    draft.markup += ch;
  }
}

function write(draft: Draft, nodes: readonly InlineNode[], inLink: boolean): void {
  for (const node of nodes) {
    switch (node.t) {
      case 'text':
        writeText(draft, inLink ? node.v.replace(/\n/g, ' ') : node.v);
        break;
      case 'br':
        if (inLink) writeText(draft, ' ');
        else draft.markup += '\n';
        break;
      case 'strong':
      case 'em':
      case 'mark': {
        const value = node.v.replace(/\n/g, ' ');
        const core = value.trim();
        // Markers must touch the text, so surrounding spaces go outside them.
        if (!MARK_CONTENT[node.t].test(core)) {
          writeText(draft, value);
          break;
        }
        const start = value.indexOf(core);
        writeText(draft, value.slice(0, start));
        draft.markup += `${MARKERS[node.t]}${core}${MARKERS[node.t]}`;
        writeText(draft, value.slice(start + core.length));
        break;
      }
      case 'link': {
        const href = inLink ? null : sanitizeUrl(node.href, 'link');
        if (href === null) {
          write(draft, node.label, true);
          break;
        }
        const start = draft.markup.length;
        const escapes = draft.escapes.length;
        draft.markup += '[';
        write(draft, node.label, true);
        if (draft.markup.length === start + 1) {
          // An empty label cannot be a link.
          draft.markup = draft.markup.slice(0, start);
          draft.escapes.length = escapes;
          break;
        }
        draft.markup += `](${href.replace(/[()\s]/g, encodeURIComponent)})`;
        break;
      }
    }
  }
}

/** Canonical markup (D-009): an escape is kept only where removing it would change the rendered HTML. */
export function serializeInline(nodes: readonly InlineNode[]): string {
  const draft: Draft = { markup: '', escapes: [] };
  write(draft, nodes, false);
  const reference = renderInline(draft.markup, PLAIN).value;
  let markup = draft.markup;
  // Right to left, so a bracket pair like `[REPLACE: …]` can lose both escapes.
  for (let i = draft.escapes.length - 1; i >= 0; i--) {
    const at = draft.escapes[i]!;
    const candidate = markup.slice(0, at) + markup.slice(at + 1);
    if (renderInline(candidate, PLAIN).value === reference) markup = candidate;
  }
  return markup;
}

/** A text field's value: formatting dropped, line breaks become single spaces. */
export function serializeText(nodes: readonly InlineNode[]): string {
  const flat = (list: readonly InlineNode[]): string =>
    list
      .map((node) => (node.t === 'br' ? '\n' : node.t === 'link' ? flat(node.label) : node.v))
      .join('');
  return flat(nodes).replace(/\s*\n\s*/g, ' ');
}
