// Inspector copy lives here, not in the block schemas (docs/DECISIONS.md D-040).

const FIELD_LABELS: Readonly<Record<string, string>> = {
  primaryCta: 'Primary button',
  secondaryCta: 'Secondary button',
  cta: 'Button',
  trustLine: 'Trust line',
  alt: 'Alt text',
  src: 'Image address',
  newTab: 'Open in a new tab',
  compareAtPrice: 'Compare-at price',
  showDiscount: 'Show discount badge',
  slidesPerView: 'Cards per view',
  arrowsOnTouch: 'Show arrows on touch screens',
  aspectRatio: 'Image shape',
  imageSide: 'Image side',
  grayscale: 'Grey until hovered',
  size: 'Size',
  columns: 'Columns',
  highlighted: 'Highlight this offer',
  offers: 'Offers',
  note: 'Note under the offers',
  endsAt: 'Ends at',
  utcOffset: 'Time zone',
  onEnd: 'When it ends',
  endedText: 'Message after the end',
  'video.url': 'Video address',
  'video.title': 'Video title',
  poster: 'Poster image',
  ratio: 'Shape',
  showOn: 'Show on',
  reveal: 'Appears',
  privacyLink: 'Privacy policy link',
  buttonLabel: 'Button label',
  openFirst: 'Open the first question',
  exclusive: 'Only one answer open at a time',
  hideOn: 'Hide on',
  spaceAbove: 'Space above',
  padY: 'Vertical padding',
  width: 'Content width',
  tone: 'Background',
  onPrimary: 'Text on primary',
  onAccent: 'Text on accent',
  onDark: 'Text on dark',
  mutedText: 'Muted text',
  surface: 'Card background',
  background: 'Page background',
  dark: 'Dark background',
  headingFont: 'Heading font',
  buttonShape: 'Button shape',
  seo: 'Search engines',
  noindex: 'Hide from search engines',
  defaultCta: 'Default button target',
  lang: 'Language',
  tracking: 'Tracking',
  metaPixelId: 'Meta Pixel ID',
  ga4Id: 'GA4 measurement ID',
  googleAdsId: 'Google Ads ID',
  googleAdsLeadLabel: 'Google Ads lead conversion label',
  gtmId: 'GTM container ID',
  headCode: 'Custom code in <head>',
  bodyCode: 'Custom code at the end of <body>',
  ogImage: 'Social share image',
  favicon: 'Favicon',
  event: 'Tracking event',
  mode: 'Form type',
  url: 'Form address',
  code: 'Embed code',
  thankYouUrl: 'Thank-you page address',
  height: 'Height (px)',
};

const OPTION_LABELS: Readonly<Record<string, Readonly<Record<string, string>>>> = {
  lang: { id: 'Indonesian', en: 'English' },
  hideOn: { none: 'Never' },
  navigation: { both: 'Arrows and dots' },
  icon: { none: 'No icon' },
  tone: { base: 'Page', primary: 'Primary color' },
  event: { none: 'No event', InitiateCheckout: 'Initiate checkout' },
  mode: { snippet: 'Embed code', iframe: 'Form address (iframe)' },
  showOn: { mobile: 'Phones only', all: 'All screens' },
  reveal: { always: 'Always', afterFirstSection: 'After the first section' },
};

/** "compareAt" → "Compare at"; "neo-grotesque" → "Neo-grotesque". */
function humanize(text: string): string {
  const spaced = text.replace(/([a-z0-9])([A-Z])/g, '$1 $2').toLowerCase();
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

/** `parent.key` overrides first ("video.url"), then the key alone. */
export function fieldLabel(key: string, parent?: string): string {
  const scoped = parent ? `${parent}.${key}` : null;
  if (scoped && Object.hasOwn(FIELD_LABELS, scoped)) return FIELD_LABELS[scoped]!;
  return Object.hasOwn(FIELD_LABELS, key) ? FIELD_LABELS[key]! : humanize(key);
}

export function optionLabel(key: string, value: string | number): string {
  const text = String(value);
  const overrides = Object.hasOwn(OPTION_LABELS, key) ? OPTION_LABELS[key]! : {};
  return Object.hasOwn(overrides, text) ? overrides[text]! : humanize(text);
}
