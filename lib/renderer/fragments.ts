import type { AspectRatio, Cta, Image } from '@/lib/schema/primitives';
import type { RenderContext } from './context';
import { formatDecimal } from './format';
import { html, unsafeRaw, type SafeHtml } from './html';
import { ICON_SVG, type UiIconName } from './icons';
import { sanitizeUrl } from './url';

// Markup shared by several blocks. Attribute order is fixed so output stays byte-stable.

export interface ImageOptions {
  className: string;
  aspectRatio?: AspectRatio;
  eager?: boolean;
  highPriority?: boolean;
}

/** Nominal size reserved for an image of unknown intrinsic size (prevents layout shift). */
const RATIO_SIZES: Record<AspectRatio, readonly [number, number]> = {
  '1:1': [800, 800],
  '4:5': [800, 1000],
  '16:9': [800, 450],
};

export function renderImage(image: Image, opts: ImageOptions, _ctx: RenderContext): SafeHtml {
  const src = sanitizeUrl(image.src, 'image');
  if (src === null) {
    return image.alt
      ? html`<div class="${opts.className} lp-img-ph" role="img" aria-label="${image.alt}"></div>`
      : html`<div class="${opts.className} lp-img-ph" aria-hidden="true"></div>`;
  }
  const size =
    image.width && image.height
      ? ([image.width, image.height] as const)
      : opts.aspectRatio && RATIO_SIZES[opts.aspectRatio];
  return html`<img class="${opts.className}" src="${src}" alt="${image.alt}"${
    size ? html` width="${size[0]}" height="${size[1]}"` : ''
  } loading="${opts.eager ? 'eager' : 'lazy'}" decoding="async"${
    opts.highPriority ? html` fetchpriority="high"` : ''
  }>`;
}

export interface CtaExtras {
  className?: string;
  /** Extra `data-*` attributes (keys without the `data-` prefix), e.g. for tracking. */
  dataAttrs?: Record<string, string>;
  /** The label's prop path, marked for inline editing in preview ('primaryCta.label'). */
  field?: string;
}

const DATA_KEY = /^[a-z][a-z0-9-]*$/;

export function renderCta(cta: Cta, ctx: RenderContext, extras: CtaExtras = {}): SafeHtml {
  const classes = ['lp-btn', `lp-btn--${cta.variant}`, extras.className].filter(Boolean).join(' ');
  const newTab = cta.link.kind === 'url' && cta.link.newTab;
  const attrs = { ...extras.dataAttrs, ...(cta.event !== 'none' && { 'lp-event': cta.event }) };
  const data = Object.entries(attrs)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([key, value]) => {
      if (!DATA_KEY.test(key)) throw new Error(`Invalid data attribute name: ${key}`);
      return html` data-${unsafeRaw(key)}="${value}"`;
    });
  return html`<a class="${classes}" href="${ctx.resolveLink(cta.link)}"${
    newTab ? html` target="_blank" rel="noopener"` : ''
  } data-lp-cta${data}${extras.field ? ctx.field(extras.field, 'text') : ''}>${ctx.text(cta.label)}</a>`;
}

export function renderIcon(name: UiIconName, className = 'lp-icon'): SafeHtml {
  return html`<svg class="${className}" viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${unsafeRaw(
    ICON_SVG[name] ?? '',
  )}</svg>`;
}

export function renderStars(rating: number, ctx: RenderContext): SafeHtml {
  const value = Math.min(5, Math.max(0, rating));
  const percent = Math.round((value / 5) * 1000) / 10;
  return html`<span class="lp-stars" style="--lp-rating:${percent}%" aria-hidden="true"></span><span class="lp-sr">${ctx.t(
    'rated',
    { rating: formatDecimal(value, ctx.lang) },
  )}</span>`;
}
