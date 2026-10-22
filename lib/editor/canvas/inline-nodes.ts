// Reads an edited canvas field back as inline nodes (docs/DECISIONS.md D-009, D-044): only what
// the inline markup can express survives, everything else becomes text. Runs inside the canvas
// iframe, so it is zod-free and checks node types instead of using instanceof.

export type InlineNode =
  | { t: 'text'; v: string }
  | { t: 'strong' | 'em' | 'mark'; v: string }
  | { t: 'br' }
  | { t: 'link'; href: string; label: InlineNode[] };

const MARK_TAGS: Record<string, 'strong' | 'em'> = {
  STRONG: 'strong',
  B: 'strong',
  EM: 'em',
  I: 'em',
};

function push(out: InlineNode[], node: InlineNode): void {
  if (node.t !== 'br' && node.t !== 'link' && !node.v) return;
  const last = out[out.length - 1];
  if (node.t === 'text' && last?.t === 'text') last.v += node.v;
  else out.push(node);
}

/** Chrome keeps a trailing <br> as a placeholder in an otherwise empty line. */
function dropTrailingBreak(nodes: InlineNode[]): InlineNode[] {
  if (nodes[nodes.length - 1]?.t === 'br') nodes.pop();
  return nodes;
}

function walk(parent: Node, out: InlineNode[], inLink: boolean): void {
  for (const node of Array.from(parent.childNodes)) {
    if (node.nodeType === 3) {
      push(out, { t: 'text', v: node.nodeValue ?? '' });
      continue;
    }
    if (node.nodeType !== 1) continue;
    const el = node as Element;
    const tag = el.tagName.toUpperCase();
    // Marks never nest: a mark holds its whole text.
    const text = (el.textContent ?? '').replace(/\n/g, ' ');
    const mark = MARK_TAGS[tag];
    if (mark) {
      push(out, { t: mark, v: text });
    } else if (tag === 'MARK') {
      // A highlighted [REPLACE: …] placeholder is plain text in the markup.
      push(out, el.classList.contains('lp-hl') ? { t: 'mark', v: text } : { t: 'text', v: text });
    } else if (tag === 'BR') {
      push(out, inLink ? { t: 'text', v: ' ' } : { t: 'br' });
    } else if (tag === 'A' && !inLink && el.hasAttribute('href')) {
      const label: InlineNode[] = [];
      walk(el, label, true);
      push(out, { t: 'link', href: el.getAttribute('href') ?? '', label });
    } else if ((tag === 'DIV' || tag === 'P') && !inLink) {
      // Each new line in a contenteditable is a wrapper element.
      if (out.length > 0) push(out, { t: 'br' });
      const line: InlineNode[] = [];
      walk(el, line, false);
      for (const part of dropTrailingBreak(line)) push(out, part);
    } else {
      walk(el, out, inLink);
    }
  }
}

export function readInlineNodes(root: Element): InlineNode[] {
  const out: InlineNode[] = [];
  walk(root, out, false);
  return dropTrailingBreak(out);
}
