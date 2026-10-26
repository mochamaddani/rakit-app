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

export const serumSkincare: BuiltinTemplate = {
  id: 'serum-skincare',
  name: 'Serum skincare',
  category: 'beauty',
  description:
    'Skincare atau kosmetik: hero, kandungan utama, keunggulan, paket, FAQ pemakaian dan formulir pesanan.',
  document: () => ({
    schemaVersion: 1,
    settings: settings(
      {
        title: '[REPLACE: Nama Serum] — Rawat Kulitmu Setiap Hari',
        description: '[REPLACE: satu kalimat tentang produk dan kandungan utamanya]',
      },
      {
        colors: {
          primary: '#A63D62',
          onPrimary: '#FFFFFF',
          accent: '#F7D6DF',
          onAccent: '#4A1D2C',
          background: '#FFFBFC',
          surface: '#FCEFF3',
          text: '#2B1A20',
          mutedText: '#6B5560',
          border: '#F1D9E1',
          dark: '#4A1D2C',
          onDark: '#FFFFFF',
        },
        font: 'humanist',
        headingFont: 'transitional',
        radius: 'xl',
        buttonShape: 'pill',
      },
    ),
    sections: [
      section('sHero', { tone: 'muted', padY: 'lg', width: 'wide' }, [
        {
          id: 'bHero',
          type: 'hero',
          props: {
            eyebrow: 'Skincare Harian',
            headline: '[REPLACE: Nama Serum]',
            subheadline: 'Tekstur ringan, cepat meresap, nyaman dipakai pagi dan malam.',
            primaryCta: toOrder('Beli Sekarang'),
            trustLine: '[REPLACE: nomor notifikasi BPOM]',
            image: img('[REPLACE: foto botol serum]'),
            layout: 'split',
            align: 'left',
          },
        },
      ]),
      section('sKandungan', { padY: 'lg' }, [
        {
          id: 'bKandungan',
          type: 'image-text',
          props: {
            eyebrow: 'Kandungan Utama',
            heading: '[REPLACE: bahan aktif utama]',
            body: '[REPLACE: penjelasan singkat bahan aktif sesuai klaim yang terdaftar]',
            points: withIds('p', [
              { text: '[REPLACE: kandungan 1]' },
              { text: '[REPLACE: kandungan 2]' },
              { text: '[REPLACE: kandungan 3]' },
            ]),
            image: img('[REPLACE: foto tekstur serum]'),
            imageSide: 'left',
            aspectRatio: '1:1',
          },
        },
      ]),
      section('sBenefit', { tone: 'muted', padY: 'lg' }, [
        {
          id: 'bBenefit',
          type: 'benefits',
          props: {
            heading: 'Kenapa Kamu Akan Suka',
            items: withIds('k', [
              { icon: 'sparkles', title: 'Ringan di Kulit', text: 'Tidak lengket, cepat meresap.' },
              { icon: 'heart', title: '[REPLACE: keunggulan 2]', text: '[REPLACE: penjelasan]' },
              { icon: 'shield', title: '[REPLACE: keunggulan 3]', text: '[REPLACE: penjelasan]' },
            ]),
            columns: 3,
          },
          style: { align: 'center' },
        },
      ]),
      section('sTesti', { padY: 'lg' }, [
        testimonialSlots('Cerita Pemakai', '[REPLACE: jenis kulit]'),
      ]),
      section('sPaket', { tone: 'muted', padY: 'lg' }, [
        {
          id: 'bPaket',
          type: 'pricing',
          props: {
            heading: 'Pilih Paket',
            offers: withIds('o', [
              { name: '1 Botol', description: '[REPLACE: isi dan harga]', cta: toOrder('Pilih') },
              {
                name: '2 Botol',
                description: '[REPLACE: isi dan harga]',
                badge: 'Lebih Hemat',
                highlighted: true,
                cta: toOrder('Pilih'),
              },
            ]),
          },
        },
      ]),
      section('sFaq', { padY: 'lg', width: 'narrow' }, [
        faq('Pertanyaan Seputar Pemakaian', [
          ['Bagaimana cara pakai?', '[REPLACE: urutan dan frekuensi pemakaian]'],
          [
            'Apakah cocok untuk kulit sensitif?',
            '[REPLACE: jawaban sesuai hasil uji produk]. Lakukan uji tempel lebih dulu.',
          ],
          ['Apakah sudah terdaftar di BPOM?', '[REPLACE: nomor notifikasi BPOM]'],
        ]),
      ]),
      orderSection('Pesan Sekarang', 'Isi data pengiriman di bawah ini.'),
      footerSection('[REPLACE: Nama Brand]'),
    ],
  }),
};
