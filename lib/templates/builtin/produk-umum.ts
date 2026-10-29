import {
  faq,
  footerSection,
  img,
  orderSection,
  section,
  settings,
  testimonialSlots,
  toOrder,
  withIds,
  type BuiltinTemplate,
} from './parts';

export const produkUmum: BuiltinTemplate = {
  id: 'produk-umum',
  name: 'Halaman produk sederhana',
  category: 'other',
  description:
    'Untuk produk apa saja: hero, keunggulan, ulasan, FAQ dan formulir pesanan. Titik awal paling ringkas.',
  document: () => ({
    schemaVersion: 2,
    settings: settings(
      {
        title: '[REPLACE: Nama Produk]',
        description: '[REPLACE: satu kalimat tentang produk Anda]',
      },
      {
        colors: {
          primary: '#0F766E',
          onPrimary: '#FFFFFF',
          accent: '#F59E0B',
          onAccent: '#111827',
          background: '#FFFFFF',
          surface: '#F3F4F6',
          text: '#111827',
          mutedText: '#4B5563',
          border: '#E5E7EB',
          dark: '#111827',
          onDark: '#F9FAFB',
        },
        font: 'system',
        headingFont: 'system',
        radius: 'md',
        buttonShape: 'rounded',
      },
    ),
    sections: [
      section('sHero', { tone: 'muted', padY: 'lg' }, [
        {
          id: 'bHero',
          type: 'hero',
          props: {
            headline: '[REPLACE: Nama Produk]',
            subheadline: '[REPLACE: manfaat utama dalam satu kalimat]',
            primaryCta: toOrder('Pesan Sekarang'),
            image: img('[REPLACE: foto produk]'),
            layout: 'stacked',
            align: 'center',
          },
        },
      ]),
      section('sBenefit', { padY: 'lg' }, [
        {
          id: 'bBenefit',
          type: 'benefits',
          props: {
            heading: 'Keunggulan',
            items: withIds(
              'k',
              [1, 2, 3].map((n) => ({
                title: `[REPLACE: keunggulan ${n}]`,
                text: '[REPLACE: penjelasan]',
              })),
            ),
          },
          style: { align: 'center' },
        },
      ]),
      section('sTesti', { tone: 'muted', padY: 'lg' }, [
        testimonialSlots('Ulasan', '[REPLACE: kota]'),
      ]),
      section('sFaq', { padY: 'lg', width: 'narrow' }, [
        faq('Pertanyaan Umum', [
          ['[REPLACE: pertanyaan 1]', '[REPLACE: jawaban 1]'],
          ['[REPLACE: pertanyaan 2]', '[REPLACE: jawaban 2]'],
        ]),
      ]),
      orderSection('Pesan Sekarang', 'Isi data pengiriman di bawah ini.'),
      footerSection('[REPLACE: Nama Toko]'),
    ],
  }),
};
