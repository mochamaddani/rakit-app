// The editor's performance fixture (docs/PLAN.md R2): 40 blocks, one per section, including two
// 20-item product carousels. Raw (unvalidated) JSON with deterministic ids, as it would be stored.
import { svgPlaceholder } from './example-document';

const CAROUSEL_POSITIONS = [10, 30];
const CAROUSEL_ITEMS = 20;
const ROUNDS = 12;
const COLORS = ['#1D4ED8', '#15803D', '#B91C1C', '#7E22CE', '#C2410C'];

type RawBlock = { type: string; props: Record<string, unknown> };

const image = (label: string, color: string) => ({
  src: svgPlaceholder(label, color),
  alt: label,
  width: 800,
  height: 800,
});

const hero = (): RawBlock => ({
  type: 'hero',
  props: {
    headline: 'Botol Minum Anti Bocor 750ml',
    subheadline: 'Air tetap dingin 24 jam.',
    primaryCta: { label: 'Pesan Sekarang', link: { kind: 'default' } },
    image: image('Hero', '#2563EB'),
    layout: 'split',
  },
});

const benefits = (round: number): RawBlock => ({
  type: 'benefits',
  props: {
    heading: `Keunggulan ${round}`,
    items: [1, 2, 3].map((n) => ({
      id: `i${n}`,
      icon: 'check',
      title: `Keunggulan ${round}.${n}`,
      text: 'Dinding ganda vakum.',
    })),
  },
});

const testimonials = (round: number): RawBlock => ({
  type: 'testimonials',
  props: {
    heading: `Ulasan ${round}`,
    items: [1, 2, 3].map((n) => ({
      id: `t${n}`,
      quote: 'Esnya masih ada sampai sore.',
      name: `Pembeli ${round}.${n}`,
      rating: 5,
    })),
  },
});

const faq = (round: number): RawBlock => ({
  type: 'faq',
  props: {
    heading: `Pertanyaan ${round}`,
    items: [1, 2, 3].map((n) => ({
      id: `q${n}`,
      question: `Pertanyaan ${round}.${n}?`,
      answer: 'Jawa 2-3 hari.\nLuar Jawa 3-5 hari.',
    })),
  },
});

const carousel = (n: number): RawBlock => ({
  type: 'product-carousel',
  props: {
    heading: `Koleksi ${n}`,
    items: Array.from({ length: CAROUSEL_ITEMS }, (_, i) => ({
      id: `p${i + 1}`,
      title: `Produk ${n}.${i + 1}`,
      description: 'Stainless 750ml, tutup kedap.',
      price: 149000,
      compareAtPrice: 199000,
      showDiscount: true,
      image: image(`Produk ${i + 1}`, COLORS[i % COLORS.length]!),
      cta: { label: 'Pilih', link: { kind: 'default' } },
    })),
  },
});

const footer = (): RawBlock => ({
  type: 'footer',
  props: { brand: 'Botolku', copyright: '© 2026 Botolku' },
});

/**
 * A hero, 12 × [benefits, testimonials, faq], the carousels at block positions 10 and 30
 * (0-based), and a footer last: 40 blocks. Section `s<n>` holds block `b<n>`.
 */
export function perfDocument(): unknown {
  const blocks: RawBlock[] = [hero()];
  for (let round = 1; round <= ROUNDS; round++) {
    blocks.push(benefits(round), testimonials(round), faq(round));
  }
  CAROUSEL_POSITIONS.forEach((position, i) => blocks.splice(position, 0, carousel(i + 1)));
  blocks.push(footer());
  return {
    schemaVersion: 1,
    settings: { lang: 'id' },
    sections: blocks.map((block, i) => ({
      id: `s${i + 1}`,
      blocks: [{ id: `b${i + 1}`, ...block }],
    })),
  };
}
