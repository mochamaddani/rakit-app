// Demo documents for renderer tests, the render CLI and browser tests. Raw (unvalidated) JSON, as
// it would be stored. Content is sample data for rendering, not a template to ship.

/** Deterministic 800×800 SVG placeholder as a data URI (labels must be plain ASCII text). */
export function svgPlaceholder(label: string, color: string): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="800" viewBox="0 0 800 800"><rect width="800" height="800" fill="${color}"/><text x="400" y="420" font-family="system-ui, sans-serif" font-size="64" font-weight="700" text-anchor="middle" fill="#ffffff">${label}</text></svg>`;
  return `data:image/svg+xml;base64,${btoa(svg)}`;
}

const COLORS: ReadonlyArray<readonly [string, string]> = [
  ['Biru Laut', '#1D4ED8'],
  ['Hijau Daun', '#15803D'],
  ['Merah Bata', '#B91C1C'],
  ['Ungu', '#7E22CE'],
  ['Oranye', '#C2410C'],
  ['Toska', '#0E7490'],
  ['Kuning', '#A16207'],
  ['Merah Muda', '#BE185D'],
];

function productItems(prefix = 'p') {
  return COLORS.map(([name, color], i) => ({
    id: `${prefix}${i + 1}`,
    title: `Botol ${name}`,
    description: 'Stainless 750ml, tutup kedap.',
    price: 149000,
    compareAtPrice: 199000,
    showDiscount: true,
    badge: i === 0 ? 'Terlaris' : '',
    rating: i % 2 === 0 ? 5 : 4.5,
    reviewCount: 40 + i * 7,
    // One card without an image exercises the placeholder.
    image:
      i === 5
        ? { src: '', alt: '' }
        : { src: svgPlaceholder(name, color), alt: `Botol ${name}`, width: 800, height: 800 },
    cta: { label: 'Pilih', link: { kind: 'default' } },
  }));
}

export const exampleDocument = {
  schemaVersion: 2,
  settings: {
    lang: 'id',
    seo: {
      title: 'Botol Minum Anti Bocor 750ml | Botolku',
      description: 'Botol minum stainless 750ml: dingin 24 jam, tutup kedap, gratis ongkir.',
    },
    defaultCta: { kind: 'section', sectionId: 'sOrder' },
  },
  sections: [
    {
      id: 'sHero',
      blocks: [
        {
          id: 'bHero',
          type: 'hero',
          props: {
            eyebrow: 'Baru',
            headline: 'Botol Minum **Anti Bocor** 750ml',
            subheadline: 'Air tetap dingin 24 jam. Tutup kedap, aman masuk tas.',
            primaryCta: { label: 'Pesan Sekarang', link: { kind: 'default' } },
            trustLine: 'Gratis ongkir · Garansi 30 hari',
            image: {
              src: svgPlaceholder('Botolku', '#2563EB'),
              alt: 'Botol minum biru',
              width: 800,
              height: 800,
            },
            layout: 'split',
            align: 'left',
          },
        },
      ],
    },
    {
      id: 'sLogos',
      style: { padY: 'sm' },
      blocks: [
        {
          id: 'bLogos',
          type: 'logos',
          props: {
            heading: 'Dijual juga di',
            items: ['Toko A', 'Toko B', 'Toko C'].map((name, i) => ({
              id: `l${i + 1}`,
              image: { src: svgPlaceholder(name, '#6B7280'), alt: name, width: 300, height: 100 },
            })),
          },
        },
      ],
    },
    {
      id: 'sBenefits',
      style: { tone: 'muted' },
      blocks: [
        {
          id: 'bBenefits',
          type: 'benefits',
          props: {
            heading: 'Kenapa pilih botol ini?',
            columns: 4,
            items: [
              { id: 'i1', icon: 'clock', title: 'Dingin 24 jam', text: 'Dinding ganda vakum.' },
              { id: 'i2', icon: 'shield', title: 'Tidak bocor', text: 'Tutup ulir dengan karet.' },
              { id: 'i3', icon: 'leaf', title: 'Bebas BPA', text: 'Aman untuk minum harian.' },
              { id: 'i4', icon: 'truck', title: 'Gratis ongkir', text: 'Ke seluruh Indonesia.' },
            ],
          },
        },
      ],
    },
    {
      id: 'sStory',
      blocks: [
        {
          id: 'bStory',
          type: 'image-text',
          props: {
            eyebrow: 'Cara kerjanya',
            heading: 'Dinding ganda, **dingin lebih lama**',
            body: 'Ruang hampa udara di antara dua dinding baja menahan panas dari luar.',
            points: [
              { id: 'p1', text: 'Baja tahan karat 304' },
              { id: 'p2', text: 'Tutup ulir dengan karet' },
            ],
            image: {
              src: svgPlaceholder('Dinding ganda', '#0EA5E9'),
              alt: 'Potongan dinding botol',
              width: 800,
              height: 1000,
            },
            imageSide: 'right',
          },
        },
      ],
    },
    {
      id: 'sProducts',
      blocks: [
        {
          id: 'bProducts',
          type: 'product-carousel',
          props: {
            heading: 'Pilih **warnamu**',
            subheading: 'Semua ukuran 750ml',
            items: productItems(),
            // 15 s per card, so autoplay never moves under the carousel's own e2e tests.
            autoplay: true,
            autoplaySeconds: 15,
            event: 'ViewContent',
          },
        },
      ],
    },
    {
      id: 'sGallery',
      style: { tone: 'muted' },
      blocks: [
        {
          id: 'bGallery',
          type: 'gallery',
          props: {
            heading: 'Lihat lebih dekat',
            items: ['Tutup', 'Dasar', 'Tali'].map((caption, i) => ({
              id: `g${i + 1}`,
              image: { src: svgPlaceholder(caption, '#334155'), alt: `Bagian ${caption}` },
              caption,
            })),
          },
        },
      ],
    },
    {
      id: 'sPricing',
      blocks: [
        {
          id: 'bPricing',
          type: 'pricing',
          props: {
            heading: 'Pilih paket',
            offers: [
              {
                id: 'o1',
                name: 'Satu botol',
                price: 149000,
                features: [{ id: 'f1', text: 'Gratis ongkir' }],
                cta: { label: 'Pesan satu', link: { kind: 'default' } },
              },
              {
                id: 'o2',
                name: 'Paket keluarga',
                price: 399000,
                compareAtPrice: 447000,
                showDiscount: true,
                badge: 'Hemat',
                highlighted: true,
                features: [
                  { id: 'f1', text: 'Tiga botol' },
                  { id: 'f2', text: 'Gratis ongkir' },
                ],
                cta: { label: 'Pesan paket', link: { kind: 'default' } },
              },
            ],
            note: 'Bayar di tempat tersedia',
          },
        },
      ],
    },
    {
      id: 'sCountdown',
      style: { tone: 'dark', padY: 'sm' },
      blocks: [
        {
          id: 'bCountdown',
          type: 'countdown',
          props: { heading: 'Promo berakhir dalam', endsAt: '2099-12-31T23:59' },
        },
      ],
    },
    {
      id: 'sVideo',
      blocks: [
        {
          id: 'bVideo',
          type: 'video',
          props: {
            heading: 'Lihat cara pakainya',
            video: {
              url: 'https://youtu.be/dQw4w9WgXcQ',
              title: 'Cara pakai botol',
              poster: { src: svgPlaceholder('Video', '#111827'), alt: '' },
            },
          },
        },
        { id: 'bSpacer', type: 'spacer', props: { size: 'md', line: true } },
        {
          id: 'bCustom',
          type: 'custom-html',
          props: {
            html: '<p class="note">Stok terbatas untuk <strong>bulan ini</strong>.</p>',
            blockName: 'Catatan stok',
          },
        },
      ],
    },
    {
      id: 'sTestimonials',
      style: { tone: 'muted' },
      blocks: [
        {
          id: 'bTestimonials',
          type: 'testimonials',
          props: {
            heading: 'Kata pembeli',
            items: [
              {
                id: 't1',
                quote: 'Esnya masih ada sampai sore.',
                name: 'Rina',
                detail: 'Bandung',
                rating: 5,
              },
              {
                id: 't2',
                quote: 'Tutupnya **benar-benar** kedap.',
                name: 'Budi',
                detail: 'Surabaya',
                rating: 5,
              },
              {
                id: 't3',
                quote: 'Warnanya bagus, pengiriman cepat.',
                name: 'Sari',
                detail: 'Medan',
                rating: 4.5,
              },
            ],
          },
        },
      ],
    },
    {
      id: 'sFaq',
      blocks: [
        {
          id: 'bFaq',
          type: 'faq',
          props: {
            heading: 'Pertanyaan',
            openFirst: true,
            items: [
              {
                id: 'q1',
                question: 'Berapa lama pengiriman?',
                answer: 'Jawa 2-3 hari.\nLuar Jawa 3-5 hari.',
              },
              {
                id: 'q2',
                question: 'Bisa bayar di tempat (COD)?',
                answer: 'Bisa, untuk semua kota.',
              },
              { id: 'q3', question: 'Apakah aman untuk air panas?', answer: 'Aman sampai 90°C.' },
              {
                id: 'q4',
                question: 'Bagaimana cara klaim garansi?',
                answer: 'Hubungi kami lewat WhatsApp dengan foto produk.',
              },
            ],
          },
        },
      ],
    },
    {
      id: 'sOrder',
      anchor: 'order',
      style: { tone: 'primary' },
      blocks: [
        {
          id: 'bOrder',
          type: 'hero',
          props: {
            headline: 'Pesan sekarang, dikirim hari ini',
            subheadline: 'Klik tombol di bawah untuk pesan lewat WhatsApp.',
            primaryCta: {
              label: 'Pesan via WhatsApp',
              link: { kind: 'url', url: 'https://wa.me/6281234567890', newTab: true },
            },
          },
        },
      ],
    },
    {
      id: 'sSticky',
      blocks: [
        {
          id: 'bSticky',
          type: 'sticky-cta',
          props: {
            text: 'Gratis ongkir hari ini',
            cta: {
              label: 'Chat',
              link: { kind: 'whatsapp', phone: '6281234567890', message: 'Halo kak, mau pesan.' },
            },
          },
        },
      ],
    },
    {
      id: 'sFooter',
      style: { padY: 'sm' },
      blocks: [
        {
          id: 'bFooter',
          type: 'footer',
          props: {
            brand: 'Botolku',
            links: [
              {
                id: 'l1',
                label: 'Kebijakan Privasi',
                link: { kind: 'url', url: 'https://botolku.example/privasi' },
              },
              {
                id: 'l2',
                label: 'Syarat & Ketentuan',
                link: { kind: 'url', url: 'https://botolku.example/syarat' },
              },
              {
                id: 'l3',
                label: 'Kontak',
                link: { kind: 'url', url: 'https://wa.me/6281234567890' },
              },
            ],
            disclaimer: 'Hasil dapat berbeda untuk setiap orang.',
            copyright: '© 2026 Botolku',
          },
        },
      ],
    },
  ],
};

/** Two independent carousels on one page (browser test: controls never leak between them). */
export const twoCarouselsDocument = {
  schemaVersion: 2,
  settings: { lang: 'id' },
  sections: [
    {
      id: 's1',
      blocks: [
        {
          id: 'cA',
          type: 'product-carousel',
          props: { heading: 'Koleksi A', items: productItems('a') },
        },
        {
          id: 'cB',
          type: 'product-carousel',
          props: { heading: 'Koleksi B', items: productItems('b') },
        },
      ],
    },
  ],
};

/** One unbroken word exactly `max` characters long. */
const word = (max: number) => 'Panjangsekali'.repeat(Math.ceil(max / 13)).slice(0, max);
const longUrl = `https://botolku.example/${'promo'.repeat(30)}`;

/**
 * Layout stress test: every text field at its maximum length as a single unbroken word, a visible
 * long URL in rich text, and 1e12 prices. A 360px phone must still show no horizontal scroll.
 */
export const stressDocument = {
  schemaVersion: 2,
  settings: { lang: 'id', seo: { title: word(120) } },
  sections: [
    {
      id: 'sHero',
      blocks: [
        {
          id: 'bHero',
          type: 'hero',
          props: {
            eyebrow: word(80),
            headline: word(200),
            subheadline: `Kunjungi ${longUrl}`,
            primaryCta: { label: word(80), link: { kind: 'default' } },
            secondaryCta: { label: word(80), link: { kind: 'default' }, variant: 'secondary' },
            trustLine: word(160),
            image: {
              src: svgPlaceholder('Stress', '#2563EB'),
              alt: word(300),
              width: 800,
              height: 800,
            },
            layout: 'split',
          },
        },
      ],
    },
    {
      id: 'sBenefits',
      style: { tone: 'muted' },
      blocks: [
        {
          id: 'bBenefits',
          type: 'benefits',
          props: {
            heading: word(160),
            subheading: word(300),
            items: [1, 2].map((n) => ({
              id: `i${n}`,
              icon: 'check',
              title: word(80),
              text: word(300),
            })),
          },
        },
      ],
    },
    {
      id: 'sProducts',
      blocks: [
        {
          id: 'bProducts',
          type: 'product-carousel',
          props: {
            heading: word(160),
            subheading: longUrl,
            items: [1, 2, 3].map((n) => ({
              id: `p${n}`,
              title: word(120),
              description: word(300),
              price: 999_999_999_999,
              compareAtPrice: 1_000_000_000_000,
              showDiscount: true,
              badge: word(30),
              rating: 4.5,
              reviewCount: 999_999_999,
              cta: { label: word(40), link: { kind: 'default' } },
            })),
          },
        },
      ],
    },
    {
      id: 'sTestimonials',
      blocks: [
        {
          id: 'bTestimonials',
          type: 'testimonials',
          props: {
            heading: word(160),
            items: [{ id: 't1', quote: word(600), name: word(80), detail: word(80), rating: 5 }],
          },
        },
      ],
    },
    {
      id: 'sFaq',
      blocks: [
        {
          id: 'bFaq',
          type: 'faq',
          props: {
            heading: word(160),
            openFirst: true,
            items: [{ id: 'q1', question: word(200), answer: `${word(600)} ${longUrl}` }],
          },
        },
      ],
    },
    {
      id: 'sOrder',
      style: { tone: 'primary' },
      blocks: [
        {
          id: 'bOrder',
          type: 'hero',
          props: {
            headline: word(200),
            primaryCta: { label: word(80), link: { kind: 'url', url: longUrl } },
          },
        },
      ],
    },
    {
      id: 'sFooter',
      blocks: [
        {
          id: 'bFooter',
          type: 'footer',
          props: {
            brand: word(80),
            links: [{ id: 'l1', label: word(60), link: { kind: 'url', url: longUrl } }],
            disclaimer: `${word(600)} ${longUrl}`,
            copyright: word(120),
          },
        },
      ],
    },
  ],
};

/** Every tracking id and both custom code fields, a CTA with an event and a web link (M3). */
export const trackingDocument = {
  schemaVersion: 2,
  settings: {
    lang: 'id',
    seo: {
      title: 'Teh Kumis Kucing',
      description: 'Teh herbal untuk teman santai.',
      ogImage: { src: 'https://cdn.example/og.webp', alt: '' },
      favicon: { src: svgPlaceholder('T', '#0F766E'), alt: '' },
    },
    defaultCta: { kind: 'section', sectionId: 'sOrder' },
    tracking: {
      metaPixelId: '1234567890',
      ga4Id: 'G-TEST1234',
      googleAdsId: 'AW-123456789',
      googleAdsLeadLabel: 'abcdEF12',
      gtmId: 'GTM-TEST12',
      headCode: '<meta name="lp-head-code" content="1">',
      bodyCode: '<div id="lp-body-code"></div>',
    },
  },
  sections: [
    {
      id: 'sHero',
      blocks: [
        {
          id: 'bHero',
          type: 'hero',
          props: {
            headline: 'Teh Kumis Kucing',
            primaryCta: {
              label: 'Beli di toko',
              link: { kind: 'url', url: 'https://shop.example/p?utm_source=google#buy' },
              event: 'Contact',
            },
            secondaryCta: { label: 'Pesan', link: { kind: 'default' }, variant: 'secondary' },
          },
        },
      ],
    },
    {
      id: 'sOrder',
      anchor: 'pesan',
      blocks: [
        {
          id: 'bForm',
          type: 'form-embed',
          props: { heading: 'Pesan di sini', mode: 'iframe', url: 'https://tally.so/r/abc' },
        },
      ],
    },
    {
      id: 'sFoot',
      blocks: [
        {
          id: 'bFoot',
          type: 'footer',
          props: {
            links: [
              {
                id: 'l1',
                label: 'Kebijakan Privasi',
                link: { kind: 'url', url: 'https://example.com/privasi' },
              },
            ],
          },
        },
      ],
    },
  ],
};
