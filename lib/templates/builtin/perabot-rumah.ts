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

export const perabotRumah: BuiltinTemplate = {
  id: 'perabot-rumah',
  name: 'Perabot rumah',
  category: 'home',
  description:
    'Peralatan rumah tangga atau dekorasi: hero, cara pakai, keunggulan, galeri, FAQ dan formulir pesanan.',
  document: () => ({
    schemaVersion: 2,
    settings: settings(
      {
        title: '[REPLACE: Nama Produk] — Rumah Lebih Rapi',
        description: '[REPLACE: satu kalimat tentang produk dan masalah yang dibantu]',
      },
      {
        colors: {
          primary: '#7C5A3A',
          onPrimary: '#FFFFFF',
          accent: '#E9DCC9',
          onAccent: '#3B2A1A',
          background: '#FFFDF9',
          surface: '#F5EFE6',
          text: '#2A221B',
          mutedText: '#6B5E52',
          border: '#E6DCCD',
          dark: '#2A221B',
          onDark: '#FFFFFF',
        },
        font: 'humanist',
        headingFont: 'old-style',
        radius: 'md',
        buttonShape: 'rounded',
      },
    ),
    sections: [
      section('sHero', { tone: 'muted', padY: 'lg', width: 'wide' }, [
        {
          id: 'bHero',
          type: 'hero',
          props: {
            eyebrow: 'Untuk Rumah Anda',
            headline: '[REPLACE: Nama Produk]',
            subheadline: '[REPLACE: masalah yang dibantu, misalnya dapur sempit jadi lebih lega]',
            primaryCta: toOrder('Pesan Sekarang'),
            trustLine: 'Bayar di Tempat • [REPLACE: garansi, bila ada]',
            image: img('[REPLACE: foto produk terpasang di rumah]'),
            layout: 'split',
            align: 'left',
          },
        },
      ]),
      section('sCara', { padY: 'lg' }, [
        {
          id: 'bCara',
          type: 'image-text',
          props: {
            eyebrow: 'Cara Pakai',
            heading: 'Pasang dalam Hitungan Menit',
            points: withIds('p', [
              { text: '[REPLACE: langkah 1]' },
              { text: '[REPLACE: langkah 2]' },
              { text: '[REPLACE: langkah 3]' },
            ]),
            cta: toOrder('Pesan Sekarang'),
            image: img('[REPLACE: foto cara pemasangan]'),
            imageSide: 'right',
            aspectRatio: '1:1',
          },
        },
      ]),
      section('sBenefit', { tone: 'muted', padY: 'lg' }, [
        {
          id: 'bBenefit',
          type: 'benefits',
          props: {
            heading: 'Yang Anda Dapatkan',
            items: withIds('k', [
              { icon: 'shield', title: 'Bahan Kokoh', text: '[REPLACE: material dan daya tahan]' },
              { icon: 'check', title: 'Mudah Dibersihkan', text: '[REPLACE: cara perawatan]' },
              { icon: 'tag', title: '[REPLACE: ukuran]', text: '[REPLACE: dimensi dan berat]' },
              {
                icon: 'truck',
                title: 'Dikemas Aman',
                text: 'Dibungkus rapat supaya sampai dalam kondisi baik.',
              },
            ]),
            columns: 4,
          },
          style: { align: 'center' },
        },
      ]),
      section('sGaleri', { padY: 'lg', width: 'wide' }, [
        {
          id: 'bGaleri',
          type: 'gallery',
          props: {
            heading: 'Inspirasi Penataan',
            items: withIds(
              'g',
              [1, 2, 3].map((n) => ({ image: img(`[REPLACE: foto penataan ${n}]`) })),
            ),
            aspectRatio: '4:5',
          },
        },
      ]),
      section('sTesti', { tone: 'muted', padY: 'lg' }, [
        testimonialSlots('Ulasan Pembeli', '[REPLACE: kota]'),
      ]),
      section('sFaq', { padY: 'lg', width: 'narrow' }, [
        faq('Pertanyaan Umum', [
          ['Berapa ukurannya?', '[REPLACE: dimensi lengkap]'],
          ['Bagaimana jika barang rusak saat dikirim?', '[REPLACE: kebijakan penggantian]'],
          ['Apakah bisa bayar di tempat?', 'Bisa. Bayar langsung ke kurir saat paket sampai.'],
        ]),
      ]),
      orderSection('Pesan Sekarang', 'Isi data pengiriman di bawah ini.'),
      footerSection('[REPLACE: Nama Toko]'),
    ],
  }),
};
