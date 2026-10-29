import type { Link } from '@/lib/schema/primitives';
import type { Lang, PageSettings } from '@/lib/schema/settings';
import { html, type SafeHtml } from './html';
import { t, type MessageKey } from './i18n';
import { renderInline, renderText } from './inline';
import { sanitizeUrl } from './url';
import { whatsAppUrl } from './whatsapp';

export type RenderMode = 'preview' | 'export';

export interface BlockPosition {
  blockId: string;
  sectionId: string;
  sectionIndex: number;
  indexInSection: number;
}

export interface RenderEnv {
  mode: RenderMode;
  settings: PageSettings;
  /** sectionId → anchor (without '#'), for section links. */
  sectionAnchors: ReadonlyMap<string, string>;
  /** The block that owns the page's one fetchpriority="high" image (D-016); null for none. */
  priorityBlockId: string | null;
}

/** Everything a block's render() may use; blocks never read the document directly. */
export interface RenderContext {
  readonly mode: RenderMode;
  readonly settings: PageSettings;
  readonly lang: Lang;
  readonly block: BlockPosition;
  /** First section counts as above the fold (docs/DECISIONS.md D-016). */
  readonly aboveFold: boolean;
  readonly isFirstBlock: boolean;
  /** Export only: this block's first image is the page's one fetchpriority="high" image. */
  readonly highPriority: boolean;
  resolveLink(link: Link): string;
  /** Plain text, escaped; placeholders highlighted in preview. */
  text(value: string): SafeHtml;
  /** Inline markup, escaped; placeholders highlighted in preview. */
  rich(value: string): SafeHtml;
  t(key: MessageKey, vars?: Record<string, string | number>): string;
  /** Block-scoped DOM id: 'b-<blockId>-<parts…>'. */
  domId(...parts: string[]): string;
  /**
   * Preview only: attributes marking the element whose whole content is this field, so the canvas
   * can edit it in place (docs/DECISIONS.md D-044). Empty in export.
   */
  field(path: string, kind: 'text' | 'rich'): SafeHtml;
}

export function createRenderContext(env: RenderEnv, block: BlockPosition): RenderContext {
  const inlineOptions = { highlightPlaceholders: env.mode === 'preview' };

  const resolveLink = (link: Link): string => {
    switch (link.kind) {
      case 'url':
        return sanitizeUrl(link.url, 'link') ?? '#';
      case 'section': {
        const anchor = env.sectionAnchors.get(link.sectionId);
        return anchor ? `#${anchor}` : '#';
      }
      case 'default':
        return env.settings.defaultCta ? resolveLink(env.settings.defaultCta) : '#';
      case 'whatsapp':
        return whatsAppUrl(link.phone, link.message) ?? '#';
    }
  };

  return {
    mode: env.mode,
    settings: env.settings,
    lang: env.settings.lang,
    block,
    aboveFold: block.sectionIndex === 0,
    isFirstBlock: block.sectionIndex === 0 && block.indexInSection === 0,
    highPriority: env.mode === 'export' && block.blockId === env.priorityBlockId,
    resolveLink,
    text: (value) => renderText(value, inlineOptions),
    rich: (value) => renderInline(value, inlineOptions),
    t: (key, vars) => t(env.settings.lang, key, vars),
    domId: (...parts) => ['b', block.blockId, ...parts].join('-'),
    field: (path, kind) =>
      env.mode === 'preview'
        ? html` data-lp-field="${path}"${kind === 'rich' ? html` data-lp-rich` : ''}`
        : html``,
  };
}
