import {
  faq,
  footerSection,
  img,
  orderSection,
  section,
  settings,
  toOrder,
  withIds,
  type BuiltinTemplate,
} from './parts';

export const aksesoriGadget: BuiltinTemplate = {
  id: 'aksesori-gadget',
  name: 'Aksesori gadget',
  category: 'gadget',
  description:
    'Gadget atau aksesori elektronik: hero, spesifikasi, carousel varian, paket, FAQ garansi dan formulir pesanan.',
  document: () => ({
    schemaVersion: 1,
    settings: settings(
      {
        title: '[REPLACE: Nama Produk] — Spesifikasi dan Harga',
        description: '[REPLACE: satu kalimat tentang produk dan fitur utamanya]',
      },
      {
        colors: {
          primary: '#2563EB',
          onPrimary: '#FFFFFF',
          accent: '#22D3EE',
          onAccent: '#0B1220',
          background: '#FFFFFF',
          surface: '#F1F5F9',
          text: '#0F172A',
          mutedText: '#475569',
          border: '#E2E8F0',
          dark: '#0B1220',
          onDark: '#F8FAFC',
        },
        font: 'neo-grotesque',
        headingFont: 'neo-grotesque',
        radius: 'md',
        buttonShape: 'rounded',
      },
    ),
    sections: [
      section('sHero', { tone: 'dark', padY: 'lg', width: 'wide' }, [
        {
          id: 'bHero',
          type: 'hero',
          props: {
            eyebrow: '[REPLACE: kategori produk]',
            headline: '[REPLACE: Nama Produk]',
            subheadline: '[REPLACE: fitur utama dalam satu kalimat]',
            primaryCta: toOrder('Pesan Sekarang'),
            trustLine: '[REPLACE: garansi] • Bayar di Tempat',
            image: img('[REPLACE: foto produk dengan latar gelap]'),
            layout: 'split',
            align: 'left',
          },
        },
      ]),
      section('sSpek', { padY: 'lg' }, [
        {
          id: 'bSpek',
          type: 'benefits',
          props: {
            heading: 'Spesifikasi',
            items: withIds('k', [
              {
                icon: 'bolt',
                title: '[REPLACE: daya atau kecepatan]',
                text: '[REPLACE: penjelasan]',
              },
              {
                icon: 'clock',
                title: '[REPLACE: daya tahan baterai]',
                text: '[REPLACE: penjelasan]',
              },
              {
                icon: 'check',
                title: '[REPLACE: kompatibilitas]',
                text: '[REPLACE: perangkat yang didukung]',
              },
              { icon: 'shield', title: '[REPLACE: garansi]', text: '[REPLACE: syarat garansi]' },
            ]),
            columns: 4,
            variant: 'plain',
          },
        },
      ]),
      section('sVarian', { tone: 'muted', padY: 'lg', width: 'wide' }, [
        {
          id: 'bVarian',
          type: 'product-carousel',
          props: {
            heading: 'Pilih Varian',
            items: withIds(
              'c',
              [1, 2, 3].map((n) => ({
                image: img(`[REPLACE: foto varian ${n}]`),
                title: `[REPLACE: nama varian ${n}]`,
                description: '[REPLACE: harga dan perbedaan varian]',
                cta: { label: 'Pilih', link: { kind: 'default' } },
              })),
            ),
            imageFit: 'contain',
            slidesPerView: { mobile: 1.3, tablet: 2.5, desktop: 3 },
          },
        },
      ]),
      section('sPaket', { padY: 'lg' }, [
        {
          id: 'bPaket',
          type: 'pricing',
          props: {
            heading: 'Harga',
            offers: withIds('o', [
              {
                name: '[REPLACE: nama paket]',
                description: '[REPLACE: isi paket dan harga]',
                features: withIds('f', [
                  { text: '[REPLACE: isi dalam kotak]' },
                  { text: '[REPLACE: garansi]' },
                ]),
                highlighted: true,
                cta: toOrder('Pesan Sekarang'),
              },
            ]),
            note: '[REPLACE: info ongkir]',
          },
        },
      ]),
      section('sFaq', { tone: 'muted', padY: 'lg', width: 'narrow' }, [
        faq('Garansi dan Pengiriman', [
          ['Berapa lama garansinya?', '[REPLACE: masa dan cakupan garansi]'],
          ['Apakah barang original?', '[REPLACE: asal barang dan bukti keaslian]'],
          ['Bagaimana klaim garansi?', '[REPLACE: langkah klaim garansi]'],
        ]),
      ]),
      orderSection('Pesan Sekarang', 'Isi data pengiriman dan pilih varian di formulir ini.'),
      footerSection('[REPLACE: Nama Toko]'),
    ],
  }),
};
