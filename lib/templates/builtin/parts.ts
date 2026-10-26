import type { TemplateCategory } from '../categories';

// Building blocks for the built-in templates (docs/DECISIONS.md D-055). Templates are raw
// PageDocuments that tests parse against the current schema. They carry no tracking ids, contacts,
// links, form code or prices, and every image is a placeholder whose alt says what goes there.

export interface BuiltinTemplate {
  /** Slug-shaped and stable: it is the form value that names the template. */
  id: string;
  name: string;
  category: TemplateCategory;
  description: string;
  /** A fresh raw PageDocument on every call, so callers may mutate it. */
  document(): unknown;
}

export interface Colors {
  primary: string;
  onPrimary: string;
  accent: string;
  onAccent: string;
  background: string;
  surface: string;
  text: string;
  mutedText: string;
  border: string;
  dark: string;
  onDark: string;
}

/** An empty image: renders the placeholder box until the owner uploads one. */
export const img = (alt: string) => ({ src: '', alt });

/** A button to the page's order section (settings.defaultCta). No event: the form reports its own. */
export const toOrder = (label: string, variant: 'primary' | 'secondary' = 'primary') => ({
  label,
  link: { kind: 'default' as const },
  variant,
});

/** Gives each item an id (`<prefix>1`, `<prefix>2`, …). */
export const withIds = <T extends object>(prefix: string, items: T[]) =>
  items.map((item, i) => ({ id: `${prefix}${i + 1}`, ...item }));

export const section = (
  id: string,
  style: {
    tone?: 'base' | 'muted' | 'primary' | 'dark';
    padY?: 'sm' | 'md' | 'lg';
    width?: 'narrow' | 'normal' | 'wide';
  },
  blocks: { id: string; type: string; props: object; style?: object }[],
  anchor?: string,
) => ({ id, ...(anchor ? { anchor } : {}), style, blocks });

/** Testimonial slots the owner fills with real reviews; never invented ones. */
export const testimonialSlots = (heading: string, detail: string) => ({
  id: 'bTesti',
  type: 'testimonials',
  props: {
    heading,
    items: withIds(
      't',
      [1, 2, 3].map((n) => ({
        quote: `[REPLACE: ulasan asli pembeli ke-${n}, dengan izin mereka]`,
        name: `[REPLACE: nama pembeli ${n}]`,
        detail,
      })),
    ),
  },
});

/** The order section every button points at; the owner pastes the Storelink (or other) code. */
export const orderSection = (heading: string, subheading: string) =>
  section(
    'sOrder',
    { tone: 'muted', padY: 'lg', width: 'narrow' },
    [{ id: 'bOrder', type: 'form-embed', props: { heading, subheading, mode: 'snippet' } }],
    'pesan',
  );

export const footerSection = (brand: string) =>
  section('sFooter', { tone: 'dark', padY: 'md' }, [
    {
      id: 'bFooter',
      type: 'footer',
      props: {
        brand,
        disclaimer: '[REPLACE: nomor izin usaha atau izin edar (bila ada) dan alamat usaha]',
        copyright: `© ${brand}`,
      },
    },
  ]);

export const stickySection = (text: string, label: string) =>
  section('sSticky', { padY: 'sm' }, [
    { id: 'bSticky', type: 'sticky-cta', props: { text, cta: toOrder(label) } },
  ]);

export const faq = (heading: string, items: [question: string, answer: string][]) => ({
  id: 'bFaq',
  type: 'faq',
  props: {
    heading,
    items: withIds(
      'q',
      items.map(([question, answer]) => ({ question, answer })),
    ),
    openFirst: true,
    exclusive: true,
  },
});

/** Settings shared by every built-in: Indonesian, rupiah, buttons go to the order section. */
export const settings = (
  seo: { title: string; description: string },
  theme: {
    colors: Colors;
    font: string;
    headingFont: string;
    radius: string;
    buttonShape: string;
  },
) => ({
  lang: 'id',
  seo,
  theme,
  defaultCta: { kind: 'section', sectionId: 'sOrder' },
});
