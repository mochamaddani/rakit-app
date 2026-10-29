import {
  faq,
  footerSection,
  img,
  orderSection,
  section,
  settings,
  stickySection,
  testimonialSlots,
  toOrder,
  withIds,
  type BuiltinTemplate,
} from './parts';

export const koleksiFashion: BuiltinTemplate = {
  id: 'koleksi-fashion',
  name: 'Koleksi fashion',
  category: 'fashion',
  description:
    'Pakaian atau hijab: hero, carousel produk, bahan dan ukuran, galeri lookbook, FAQ ukuran dan retur, formulir pesanan.',
  document: () => ({
    schemaVersion: 2,
    settings: settings(
      {
        title: '[REPLACE: Nama Koleksi] — Koleksi Terbaru',
        description: '[REPLACE: satu kalimat tentang koleksi, bahan dan ukurannya]',
      },
      {
        colors: {
          primary: '#141414',
          onPrimary: '#FFFFFF',
          accent: '#E8D5C4',
          onAccent: '#141414',
          background: '#FFFFFF',
          surface: '#F6F3EF',
          text: '#141414',
          mutedText: '#5E5E5E',
          border: '#E7E2DC',
          dark: '#141414',
          onDark: '#FAFAFA',
        },
        font: 'neo-grotesque',
        headingFont: 'old-style',
        radius: 'none',
        buttonShape: 'square',
      },
    ),
    sections: [
      section('sHero', { padY: 'lg', width: 'wide' }, [
        {
          id: 'bHero',
          type: 'hero',
          props: {
            eyebrow: 'Koleksi Terbaru',
            headline: '[REPLACE: Nama Koleksi]',
            subheadline: 'Potongan rapi, bahan nyaman, siap dipakai dari pagi sampai malam.',
            primaryCta: toOrder('Pesan Sekarang'),
            secondaryCta: {
              label: 'Lihat Koleksi',
              link: { kind: 'section', sectionId: 'sKoleksi' },
              variant: 'secondary',
            },
            trustLine: 'Tukar ukuran mudah • Bayar di tempat',
            image: img('[REPLACE: foto model memakai produk]'),
            layout: 'stacked',
            align: 'center',
          },
        },
      ]),
      section(
        'sKoleksi',
        { tone: 'muted', padY: 'lg', width: 'wide' },
        [
          {
            id: 'bKoleksi',
            type: 'product-carousel',
            props: {
              heading: 'Pilih Warna Favoritmu',
              items: withIds(
                'c',
                [1, 2, 3, 4].map((n) => ({
                  image: img(`[REPLACE: foto produk varian ${n}]`),
                  title: `[REPLACE: nama varian ${n}]`,
                  description: '[REPLACE: harga dan ukuran tersedia]',
                  cta: { label: 'Pilih', link: { kind: 'default' } },
                })),
              ),
              aspectRatio: '4:5',
            },
          },
        ],
        'koleksi',
      ),
      section('sBahan', { padY: 'lg' }, [
        {
          id: 'bBahan',
          type: 'benefits',
          props: {
            heading: 'Detail yang Kamu Rasakan',
            items: withIds('k', [
              {
                icon: 'sparkles',
                title: 'Bahan Adem',
                text: '[REPLACE: jenis kain dan karakternya]',
              },
              {
                icon: 'check',
                title: 'Ukuran Lengkap',
                text: '[REPLACE: ukuran yang tersedia, misalnya S–XXL]',
              },
              { icon: 'refresh', title: 'Tukar Ukuran', text: '[REPLACE: syarat tukar ukuran]' },
            ]),
            variant: 'plain',
          },
          style: { align: 'center' },
        },
      ]),
      section('sLookbook', { padY: 'lg', width: 'wide' }, [
        {
          id: 'bLookbook',
          type: 'gallery',
          props: {
            heading: 'Lookbook',
            items: withIds(
              'g',
              [1, 2, 3, 4, 5, 6].map((n) => ({
                image: img(`[REPLACE: foto lookbook ${n}]`),
              })),
            ),
            aspectRatio: '4:5',
          },
        },
      ]),
      section('sTesti', { tone: 'muted', padY: 'lg' }, [
        testimonialSlots('Mereka Sudah Pakai', '[REPLACE: ukuran yang dibeli]'),
      ]),
      section('sFaq', { padY: 'lg', width: 'narrow' }, [
        faq('Tanya Jawab', [
          ['Bagaimana memilih ukuran?', '[REPLACE: tabel ukuran (lingkar dada, panjang badan)]'],
          ['Apakah bisa tukar ukuran?', '[REPLACE: syarat dan batas waktu tukar ukuran]'],
          ['Apakah warna sesuai foto?', 'Warna bisa sedikit berbeda karena pencahayaan dan layar.'],
        ]),
      ]),
      orderSection('Pesan Sekarang', 'Isi data pengiriman dan pilih varian di formulir ini.'),
      footerSection('[REPLACE: Nama Brand]'),
      stickySection('Stok terbatas', 'Pesan Sekarang'),
    ],
  }),
};
