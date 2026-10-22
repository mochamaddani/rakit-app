import type { RenderEnv } from '@/lib/renderer/context';
import { renderBlock, type BlockAt } from '@/lib/renderer/page';
import type { BlockInstance } from '@/lib/schema/document';
import type { PageSettings } from '@/lib/schema/settings';

// Per-block HTML for the canvas. Immer keeps unchanged blocks as the same objects, so a typing
// edit re-renders one block. Block markup also depends on the settings, the section anchors
// (section links) and the position (first section: eager images; first block: the page's h1).

interface Entry {
  mode: RenderEnv['mode'];
  settings: PageSettings;
  anchors: string;
  sectionId: string;
  aboveFold: boolean;
  first: boolean;
  html: string | null;
}

export interface BlockHtmlCache {
  /** renderBlock's markup, or null for an unregistered type. */
  get(env: RenderEnv, block: BlockInstance, at: BlockAt): string | null;
}

export function createBlockHtmlCache(): BlockHtmlCache {
  const entries = new WeakMap<BlockInstance, Entry>();
  const anchorKeys = new WeakMap<RenderEnv, string>();
  const anchorsOf = (env: RenderEnv) => {
    let key = anchorKeys.get(env);
    if (key === undefined) {
      key = [...env.sectionAnchors].map(([id, anchor]) => `${id}=${anchor}`).join(' ');
      anchorKeys.set(env, key);
    }
    return key;
  };

  return {
    get(env, block, at) {
      const anchors = anchorsOf(env);
      const aboveFold = at.sectionIndex === 0;
      const first = aboveFold && at.indexInSection === 0;
      const hit = entries.get(block);
      if (
        hit &&
        hit.mode === env.mode &&
        hit.settings === env.settings &&
        hit.anchors === anchors &&
        hit.sectionId === at.sectionId &&
        hit.aboveFold === aboveFold &&
        hit.first === first
      ) {
        return hit.html;
      }
      const html = renderBlock(env, block, at)?.value ?? null;
      entries.set(block, {
        mode: env.mode,
        settings: env.settings,
        anchors,
        sectionId: at.sectionId,
        aboveFold,
        first,
        html,
      });
      return html;
    },
  };
}
