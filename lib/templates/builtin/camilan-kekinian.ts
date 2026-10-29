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

export const camilanKekinian: BuiltinTemplate = {
  id: 'camilan-kekinian',
  name: 'Camilan kekinian',
  category: 'food',
  description:
    'Makanan ringan atau minuman: hero, galeri varian rasa, keunggulan, paket hemat, FAQ dan formulir pesanan.',
  document: () => ({
    schemaVersion: 2,
    settings: settings(
      {
        title: '[REPLACE: Nama Camilan] — Renyah Sampai Gigitan Terakhir',
        description: '[REPLACE: satu kalimat tentang camilan dan varian rasanya]',
      },
      {
        colors: {
          primary: '#C2410C',
          onPrimary: '#FFFFFF',
          accent: '#FACC15',
          onAccent: '#422006',
          background: '#FFFFFF',
          surface: '#FFF7ED',
          text: '#1C1917',
          mutedText: '#57534E',
          border: '#FED7AA',
          dark: '#431407',
          onDark: '#FFFFFF',
        },
        font: 'rounded',
        headingFont: 'rounded',
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
            eyebrow: 'Camilan Kekinian',
            headline: '[REPLACE: Nama Camilan]',
            subheadline: 'Renyah, gurih, dan bikin nagih. Cocok buat teman nonton dan kumpul.',
            primaryCta: toOrder('Pesan Sekarang'),
            trustLine: '[REPLACE: nomor PIRT atau sertifikat halal]',
            image: img('[REPLACE: foto camilan dalam kemasan]'),
            layout: 'stacked',
            align: 'center',
          },
        },
      ]),
      section('sRasa', { padY: 'lg', width: 'wide' }, [
        {
          id: 'bRasa',
          type: 'gallery',
          props: {
            heading: 'Pilih Rasa Favorit',
            items: withIds(
              'g',
              [1, 2, 3, 4].map((n) => ({
                image: img(`[REPLACE: foto varian rasa ${n}]`),
                caption: `[REPLACE: nama rasa ${n}]`,
              })),
            ),
            columns: { mobile: 2, desktop: 4 },
          },
        },
      ]),
      section('sBenefit', { tone: 'primary', padY: 'lg' }, [
        {
          id: 'bBenefit',
          type: 'benefits',
          props: {
            heading: 'Kenapa Harus Coba',
            items: withIds('k', [
              {
                icon: 'heart',
                title: 'Dibuat Fresh',
                text: '[REPLACE: kapan dan bagaimana diproduksi]',
              },
              { icon: 'gift', title: 'Kemasan Rapat', text: 'Tetap renyah sampai di tanganmu.' },
              { icon: 'truck', title: 'Kirim Cepat', text: '[REPLACE: estimasi pengiriman]' },
            ]),
            variant: 'plain',
          },
          style: { align: 'center' },
        },
      ]),
      section('sPaket', { padY: 'lg' }, [
        {
          id: 'bPaket',
          type: 'pricing',
          props: {
            heading: 'Paket Hemat',
            offers: withIds('o', [
              {
                name: 'Paket Satuan',
                description: '[REPLACE: isi dan harga]',
                cta: toOrder('Pilih'),
              },
              {
                name: 'Paket Kumpul',
                description: '[REPLACE: isi dan harga]',
                badge: 'Paling Hemat',
                highlighted: true,
                cta: toOrder('Pilih'),
              },
              {
                name: 'Paket Reseller',
                description: '[REPLACE: isi dan harga]',
                cta: toOrder('Pilih'),
              },
            ]),
            note: '[REPLACE: info ongkir]',
          },
        },
      ]),
      section('sTesti', { tone: 'muted', padY: 'lg' }, [
        testimonialSlots('Kata Pembeli', '[REPLACE: rasa yang dibeli]'),
      ]),
      section('sFaq', { padY: 'lg', width: 'narrow' }, [
        faq('Tanya Jawab', [
          ['Tahan berapa lama?', '[REPLACE: masa simpan sesuai kemasan]'],
          ['Apakah sudah halal?', '[REPLACE: status sertifikat halal]'],
          ['Bisa kirim ke luar kota?', '[REPLACE: jangkauan pengiriman]'],
        ]),
      ]),
      orderSection('Pesan Sekarang', 'Pilih rasa dan isi data pengiriman di bawah ini.'),
      footerSection('[REPLACE: Nama Toko]'),
      stickySection('Lagi promo', 'Pesan Sekarang'),
    ],
  }),
};
