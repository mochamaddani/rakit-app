// Focus ring contrast (WCAG 1.4.11): every element reachable with Tab, in every section tone and on
// card surfaces, gets a solid ring with at least 3:1 contrast against the backdrop it is drawn on.
import { expect, test, type Page } from '@playwright/test';
import { exampleDocument } from '@/tests/fixtures/example-document';
import { renderToFile } from './render-to-file';

const TONES = ['base', 'muted', 'primary', 'dark'] as const;
const LINK = ' [Info](https://botolku.example/info)';

interface RawSection {
  style?: object;
  blocks: Array<{ id: string; props: { items?: Array<Record<string, string>> } }>;
}

/** The example page with every section in one tone, plus links inside a benefit card and a quote. */
function documentInTone(tone: (typeof TONES)[number]): unknown {
  const doc = structuredClone(exampleDocument) as unknown as { sections: RawSection[] };
  for (const section of doc.sections) {
    section.style = { ...section.style, tone };
    for (const block of section.blocks) {
      const first = block.props.items?.[0];
      if (block.id === 'bBenefits' && first) first.text += LINK;
      if (block.id === 'bTestimonials' && first) first.quote += LINK;
    }
  }
  return doc;
}

/** Runs in the page: the focused element's ring and its contrast with the backdrop behind it. */
function inspectFocus() {
  const el = document.activeElement;
  if (!(el instanceof HTMLElement) || el === document.body || el.hasAttribute('data-probe')) {
    return null;
  }
  el.setAttribute('data-probe', '');
  const rgba = (value: string) => {
    const match = /rgba?\(([^)]+)\)/.exec(value);
    if (!match) throw new Error(`unexpected color format: ${value}`);
    const [r = 0, g = 0, b = 0, a = 1] = (match[1] ?? '')
      .split(/[\s,/]+/)
      .filter(Boolean)
      .map(Number);
    return { r, g, b, a };
  };
  const luminance = ({ r, g, b }: { r: number; g: number; b: number }) => {
    const linear = (v: number) =>
      v / 255 <= 0.04045 ? v / 255 / 12.92 : ((v / 255 + 0.055) / 1.055) ** 2.4;
    return 0.2126 * linear(r) + 0.7152 * linear(g) + 0.0722 * linear(b);
  };
  // The ring sits outside the element (outline-offset), so its backdrop is the nearest painted ancestor.
  let backdrop = { r: 255, g: 255, b: 255, a: 1 };
  for (let node = el.parentElement; node; node = node.parentElement) {
    const color = rgba(getComputedStyle(node).backgroundColor);
    if (color.a > 0) {
      backdrop = color;
      break;
    }
  }
  const style = getComputedStyle(el);
  const [light, dark] = [luminance(rgba(style.outlineColor)), luminance(backdrop)].sort(
    (x, y) => y - x,
  );
  const label = (el.getAttribute('aria-label') ?? el.textContent ?? '').trim().slice(0, 40);
  return {
    element: `${el.tagName.toLowerCase()}.${el.classList[0] ?? ''} "${label}"`,
    focusVisible: el.matches(':focus-visible'),
    outline: `${style.outlineStyle} ${style.outlineWidth} ${style.outlineColor}`,
    backdrop: `rgb(${backdrop.r}, ${backdrop.g}, ${backdrop.b})`,
    ratio: Math.round((((light ?? 0) + 0.05) / ((dark ?? 0) + 0.05)) * 100) / 100,
    solid: style.outlineStyle === 'solid' && parseFloat(style.outlineWidth) >= 2,
  };
}

async function tabThrough(page: Page) {
  const rings = [];
  for (let i = 0; i < 80; i++) {
    await page.keyboard.press('Tab');
    const ring = await page.evaluate(inspectFocus);
    if (!ring) break;
    rings.push(ring);
  }
  return rings;
}

for (const tone of TONES) {
  test(`every focus ring has 3:1 contrast with its backdrop in the ${tone} tone`, async ({
    page,
  }, info) => {
    await page.goto(renderToFile(info.outputPath('page.html'), documentInTone(tone)));
    const rings = await tabThrough(page);
    // Hero CTA, 2 card links, track, 8 product CTAs, 2 arrows, 5 dots (one per scroll position at
    // 4 cards per view, D-054), 4 FAQ, CTA, 3 footer links.
    expect(rings.length).toBeGreaterThanOrEqual(27);
    expect(rings.filter((r) => r.element.includes('"Info"'))).toHaveLength(2);
    expect(rings.filter((r) => !r.focusVisible || !r.solid || r.ratio < 3)).toEqual([]);
  });
}
