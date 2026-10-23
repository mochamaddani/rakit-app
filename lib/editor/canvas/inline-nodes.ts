// Reads an edited canvas field back as inline nodes (docs/DECISIONS.md D-009, D-044): only what
// the inline markup can express survives, everything else becomes text. Runs inside the canvas
// iframe, so it is zod-free and checks node types instead of using instanceof.

export type InlineNode =
  | { t: 'text'; v: string }
  | { t: 'strong' | 'em' | 'mark'; v: string }
  | { t: 'br' }
  | { t: 'link'; href: string; label: InlineNode[] };

type Mark = 'strong' | 'em' | 'mark';

const MARK_TAGS: Record<string, 'strong' | 'em'> = {
  STRONG: 'strong',
  B: 'strong',
  EM: 'em',
  I: 'em',
};
/** Marks never nest in the markup: where they nest in the DOM, the higher rank holds the text. */
const RANK: Record<Mark, number> = { em: 1, strong: 2, mark: 3 };

function push(out: InlineNode[], node: InlineNode): void {
  if (node.t !== 'br' && node.t !== 'link' && !node.v) return;
  const last = out[out.length - 1];
  // Neighbouring runs of one kind are one run (a mark split over several text nodes).
  if (last && last.t === node.t && 'v' in last && 'v' in node) last.v += node.v;
  else out.push(node);
}

/** Chrome keeps a trailing <br> as a placeholder in an otherwise empty line. */
function dropTrailingBreak(nodes: InlineNode[]): InlineNode[] {
  if (nodes[nodes.length - 1]?.t === 'br') nodes.pop();
  return nodes;
}

/**
 * A mark applies to each text node inside it, so links and line breaks within a mark survive:
 * a link's label carries the mark, and a break splits the mark around it.
 */
function walk(parent: Node, out: InlineNode[], inLink: boolean, mark: Mark | null): void {
  for (const node of Array.from(parent.childNodes)) {
    if (node.nodeType === 3) {
      push(out, { t: mark ?? 'text', v: node.nodeValue ?? '' });
      continue;
    }
    if (node.nodeType !== 1) continue;
    const el = node as Element;
    const tag = el.tagName.toUpperCase();
    // A highlighted [REPLACE: …] placeholder is plain text in the markup.
    const own =
      MARK_TAGS[tag] ?? (tag === 'MARK' && el.classList.contains('lp-hl') ? 'mark' : null);
    if (own) {
      walk(el, out, inLink, mark && RANK[mark] > RANK[own] ? mark : own);
    } else if (tag === 'BR') {
      push(out, inLink ? { t: mark ?? 'text', v: ' ' } : { t: 'br' });
    } else if (tag === 'A' && !inLink && el.hasAttribute('href')) {
      const label: InlineNode[] = [];
      walk(el, label, true, mark);
      push(out, { t: 'link', href: el.getAttribute('href') ?? '', label });
    } else if ((tag === 'DIV' || tag === 'P') && !inLink) {
      // Each new line in a contenteditable is a wrapper element.
      if (out.length > 0) push(out, { t: 'br' });
      const line: InlineNode[] = [];
      walk(el, line, false, mark);
      for (const part of dropTrailingBreak(line)) push(out, part);
    } else {
      walk(el, out, inLink, mark);
    }
  }
}

export function readInlineNodes(root: Element): InlineNode[] {
  const out: InlineNode[] = [];
  walk(root, out, false, null);
  return dropTrailingBreak(out);
}
