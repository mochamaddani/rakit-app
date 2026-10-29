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

// Modeled on the owner's Teh Kumis Kucing page: split hero, benefits, packages, COD order form.
export const tehHerbal: BuiltinTemplate = {
  id: 'teh-herbal',
  name: 'Teh herbal',
  category: 'herbal',
  description:
    'Teh atau minuman herbal dengan bayar di tempat: hero, keunggulan, cara seduh, paket hemat, FAQ dan formulir pesanan.',
  document: () => ({
    schemaVersion: 2,
    settings: settings(
      {
        title: '[REPLACE: Nama Teh] — Teh Herbal Alami',
        description: '[REPLACE: satu kalimat tentang teh Anda, bahan dan cara penyajiannya]',
      },
      {
        colors: {
          primary: '#2F6B4F',
          onPrimary: '#FFFFFF',
          accent: '#F2C14E',
          onAccent: '#1F3D2E',
          background: '#FFFFFF',
          surface: '#EEF5F0',
          text: '#1E2B24',
          mutedText: '#55665C',
          border: '#D8E6DC',
          dark: '#1F3D2E',
          onDark: '#FFFFFF',
        },
        font: 'humanist',
        headingFont: 'humanist',
        radius: 'lg',
        buttonShape: 'pill',
      },
    ),
    sections: [
      section('sHero', { tone: 'muted', padY: 'lg', width: 'wide' }, [
        {
          id: 'bHero',
          type: 'hero',
          props: {
            eyebrow: 'Teh Herbal Alami',
            headline: '[REPLACE: Nama Teh Anda]',
            subheadline:
              'Diseduh dari **[REPLACE: bahan utama]** pilihan. Hangat, ringan, dan nyaman dinikmati setiap hari.',
            primaryCta: toOrder('Pesan Sekarang'),
            trustLine: 'Bayar di Tempat (COD) • Dikirim ke Seluruh Indonesia',
            image: img('[REPLACE: foto kemasan teh]'),
            layout: 'split',
            align: 'left',
          },
        },
      ]),
      section('sBenefit', { padY: 'lg' }, [
        {
          id: 'bBenefit',
          type: 'benefits',
          props: {
            heading: 'Kenapa Memilih [REPLACE: Nama Teh]?',
            items: withIds('k', [
              {
                icon: 'leaf',
                title: 'Bahan Pilihan',
                text: '[REPLACE: asal dan cara memilih bahan]',
              },
              {
                icon: 'sparkles',
                title: 'Tanpa Pewarna',
                text: '[REPLACE: komposisi lengkap sesuai kemasan]',
              },
              {
                icon: 'clock',
                title: 'Praktis Diseduh',
                text: 'Cukup seduh dengan air panas 3–5 menit.',
              },
            ]),
            columns: 3,
          },
          style: { align: 'center' },
        },
      ]),
      section('sSeduh', { tone: 'muted', padY: 'lg' }, [
        {
          id: 'bSeduh',
          type: 'image-text',
          props: {
            eyebrow: 'Cara Menikmati',
            heading: 'Seduh, Tunggu, Nikmati',
            points: withIds('p', [
              { text: 'Masukkan 1 kantong teh ke dalam cangkir.' },
              { text: 'Tuang 200 ml air panas, diamkan 3–5 menit.' },
              { text: 'Nikmati hangat atau tambahkan es batu.' },
            ]),
            image: img('[REPLACE: foto teh yang sudah diseduh]'),
            imageSide: 'right',
          },
        },
      ]),
      section('sTesti', { padY: 'lg' }, [testimonialSlots('Kata Mereka', '[REPLACE: kota]')]),
      section('sPaket', { tone: 'primary', padY: 'lg' }, [
        {
          id: 'bPaket',
          type: 'pricing',
          props: {
            heading: 'Pilih Paket Hemat',
            offers: withIds('o', [
              {
                name: 'Paket Coba',
                description: '[REPLACE: isi paket dan harga]',
                features: withIds('f', [{ text: '[REPLACE: jumlah kemasan]' }]),
                cta: toOrder('Pilih Paket'),
              },
              {
                name: 'Paket Hemat',
                description: '[REPLACE: isi paket dan harga]',
                badge: 'Paling Laris',
                highlighted: true,
                features: withIds('f', [
                  { text: '[REPLACE: jumlah kemasan]' },
                  { text: '[REPLACE: bonus, bila ada]' },
                ]),
                cta: toOrder('Pilih Paket'),
              },
            ]),
            note: '[REPLACE: info ongkir dan COD]',
          },
        },
      ]),
      section('sFaq', { padY: 'lg', width: 'narrow' }, [
        faq('Pertanyaan yang Sering Ditanyakan', [
          ['Berapa kali sehari boleh diminum?', '[REPLACE: aturan minum sesuai kemasan]'],
          ['Apakah bisa bayar di tempat?', 'Bisa. Bayar langsung ke kurir saat paket sampai.'],
          ['Berapa lama pengiriman?', '[REPLACE: estimasi pengiriman per wilayah]'],
        ]),
      ]),
      orderSection(
        'Lengkapi Data Pemesanan',
        'Isi data pengiriman di bawah ini. Bayar di tempat saat paket sampai.',
      ),
      footerSection('[REPLACE: Nama Toko]'),
      stickySection('Promo terbatas', 'Pesan Sekarang'),
    ],
  }),
};
