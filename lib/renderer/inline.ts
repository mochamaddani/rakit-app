import { html, type SafeHtml } from './html';
import { sanitizeUrl } from './url';

// Inline markup for rich text fields (docs/DECISIONS.md D-009). The raw text is tokenized first and
// each token is emitted through the escaping `html` tag; nothing is ever re-parsed as HTML.

export interface InlineOptions {
  highlightPlaceholders: boolean;
}

export const PLACEHOLDER_PATTERN = /\[REPLACE:[^\]]*\]/g;

type MarkKind = 'strong' | 'em' | 'mark';

type Token =
  | { kind: 'text'; text: string }
  | { kind: MarkKind; text: string }
  | { kind: 'br' }
  | { kind: 'placeholder'; text: string }
  | { kind: 'link'; label: Token[]; url: string };

const ESCAPABLE = new Set(['*', '=', '[', ']', '\\']);
const PLACEHOLDER_AT = /^\[REPLACE:[^\]]*\]/;
const LINK_AT = /^\[([^\]\n]+)\]\(([^)\s]+)\)/;
// Markers must touch the enclosed text; content never spans a line break.
const MARKS: ReadonlyArray<[MarkKind, RegExp]> = [
  ['strong', /^\*\*(?=\S)([^\n]*?\S)\*\*/],
  ['mark', /^==(?=\S)([^\n]*?\S)==/],
  ['em', /^\*(?=[^\s*])((?:[^*\n]*[^\s*])?)\*/],
];

function tokenize(source: string, allowLinks: boolean): Token[] {
  const tokens: Token[] = [];
  let pending = '';
  const flush = () => {
    if (pending) tokens.push({ kind: 'text', text: pending });
    pending = '';
  };

  let i = 0;
  while (i < source.length) {
    const rest = source.slice(i);
    const ch = source.charAt(i);

    if (ch === '\\' && ESCAPABLE.has(source.charAt(i + 1))) {
      pending += source.charAt(i + 1);
      i += 2;
      continue;
    }
    if (ch === '\n') {
      flush();
      tokens.push({ kind: 'br' });
      i += 1;
      continue;
    }
    if (allowLinks && ch === '[') {
      const placeholder = PLACEHOLDER_AT.exec(rest);
      if (placeholder) {
        flush();
        tokens.push({ kind: 'placeholder', text: placeholder[0] });
        i += placeholder[0].length;
        continue;
      }
      const link = LINK_AT.exec(rest);
      if (link) {
        flush();
        tokens.push({ kind: 'link', label: tokenize(link[1] ?? '', false), url: link[2] ?? '' });
        i += link[0].length;
        continue;
      }
    }
    if (ch === '*' || ch === '=') {
      const mark = MARKS.map(([kind, re]) => [kind, re.exec(rest)] as const).find(([, m]) => m);
      if (mark?.[1]) {
        flush();
        tokens.push({ kind: mark[0], text: mark[1][1] ?? '' });
        i += mark[1][0].length;
        continue;
      }
    }
    pending += ch;
    i += 1;
  }
  flush();
  return tokens;
}

function emit(tokens: Token[], opts: InlineOptions): SafeHtml {
  return html`${tokens.map((token) => {
    switch (token.kind) {
      case 'text':
        return token.text;
      case 'strong':
        return html`<strong>${token.text}</strong>`;
      case 'em':
        return html`<em>${token.text}</em>`;
      case 'mark':
        return html`<mark class="lp-hl">${token.text}</mark>`;
      case 'br':
        return html`<br>`;
      case 'placeholder':
        return opts.highlightPlaceholders
          ? html`<mark class="lp-replace">${token.text}</mark>`
          : token.text;
      case 'link': {
        const href = sanitizeUrl(token.url, 'link');
        const label = emit(token.label, opts);
        return href === null ? label : html`<a href="${href}">${label}</a>`;
      }
    }
  })}`;
}

export function renderInline(text: string, opts: InlineOptions): SafeHtml {
  return emit(tokenize(text, true), opts);
}

/** Plain text: escaped and never interpreted, apart from placeholder highlighting. */
export function renderText(text: string, opts: InlineOptions): SafeHtml {
  if (!opts.highlightPlaceholders) return html`${text}`;
  const parts: SafeHtml[] = [];
  let last = 0;
  for (const match of text.matchAll(PLACEHOLDER_PATTERN)) {
    parts.push(html`${text.slice(last, match.index)}<mark class="lp-replace">${match[0]}</mark>`);
    last = match.index + match[0].length;
  }
  parts.push(html`${text.slice(last)}`);
  return html`${parts}`;
}

function plain(tokens: Token[]): string {
  return tokens
    .map((token) => {
      if (token.kind === 'br') return ' ';
      if (token.kind === 'link') return plain(token.label);
      return token.text;
    })
    .join('');
}

/** For aria-labels, titles and other attribute text derived from rich fields. */
export function toPlainText(text: string): string {
  return plain(tokenize(text, true));
}

export function findPlaceholders(text: string): string[] {
  return text.match(PLACEHOLDER_PATTERN) ?? [];
}
