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

export const kelasOnline: BuiltinTemplate = {
  id: 'kelas-online',
  name: 'Kelas online',
  category: 'digital',
  description:
    'Kelas, e-book atau produk digital: hero, materi, profil mentor, harga, FAQ dan formulir pendaftaran.',
  document: () => ({
    schemaVersion: 1,
    settings: settings(
      {
        title: '[REPLACE: Nama Kelas] — Daftar Sekarang',
        description: '[REPLACE: satu kalimat tentang apa yang dipelajari dan untuk siapa]',
      },
      {
        colors: {
          primary: '#5B21B6',
          onPrimary: '#FFFFFF',
          accent: '#FBBF24',
          onAccent: '#1E1B4B',
          background: '#FFFFFF',
          surface: '#F5F3FF',
          text: '#1E1B4B',
          mutedText: '#4C4F6B',
          border: '#E4E0F7',
          dark: '#1E1B4B',
          onDark: '#FFFFFF',
        },
        font: 'geometric',
        headingFont: 'geometric',
        radius: 'lg',
        buttonShape: 'rounded',
      },
    ),
    sections: [
      section('sHero', { tone: 'primary', padY: 'lg', width: 'wide' }, [
        {
          id: 'bHero',
          type: 'hero',
          props: {
            eyebrow: 'Kelas Online',
            headline: '[REPLACE: Nama Kelas]',
            subheadline: '[REPLACE: hasil yang bisa dicapai peserta, tanpa janji penghasilan]',
            primaryCta: toOrder('Daftar Sekarang'),
            trustLine: '[REPLACE: format kelas, misalnya rekaman + sesi tanya jawab]',
            image: img('[REPLACE: foto mentor atau cuplikan materi]'),
            layout: 'split',
            align: 'left',
          },
        },
      ]),
      section('sMateri', { padY: 'lg' }, [
        {
          id: 'bMateri',
          type: 'benefits',
          props: {
            heading: 'Yang Akan Kamu Pelajari',
            items: withIds(
              'k',
              [1, 2, 3, 4, 5, 6].map((n) => ({
                icon: 'check',
                title: `[REPLACE: modul ${n}]`,
                text: '[REPLACE: isi modul]',
              })),
            ),
            columns: 3,
            variant: 'plain',
          },
        },
      ]),
      section('sMentor', { tone: 'muted', padY: 'lg' }, [
        {
          id: 'bMentor',
          type: 'image-text',
          props: {
            eyebrow: 'Mentor',
            heading: '[REPLACE: nama mentor]',
            body: '[REPLACE: pengalaman mentor yang bisa dibuktikan]',
            image: img('[REPLACE: foto mentor]'),
            imageSide: 'left',
            aspectRatio: '1:1',
          },
        },
      ]),
      section('sHarga', { padY: 'lg' }, [
        {
          id: 'bHarga',
          type: 'pricing',
          props: {
            heading: 'Investasi Belajar',
            offers: withIds('o', [
              {
                name: 'Kelas Rekaman',
                description: '[REPLACE: harga]',
                features: withIds('f', [{ text: '[REPLACE: akses materi]' }]),
                cta: toOrder('Daftar'),
              },
              {
                name: 'Kelas + Mentoring',
                description: '[REPLACE: harga]',
                badge: 'Rekomendasi',
                highlighted: true,
                features: withIds('f', [
                  { text: '[REPLACE: akses materi]' },
                  { text: '[REPLACE: sesi mentoring]' },
                ]),
                cta: toOrder('Daftar'),
              },
            ]),
          },
        },
      ]),
      section('sTesti', { tone: 'muted', padY: 'lg' }, [
        testimonialSlots('Kata Alumni', '[REPLACE: angkatan]'),
      ]),
      section('sFaq', { padY: 'lg', width: 'narrow' }, [
        faq('Pertanyaan Umum', [
          ['Untuk siapa kelas ini?', '[REPLACE: peserta yang cocok]'],
          ['Berapa lama aksesnya?', '[REPLACE: masa akses]'],
          ['Apakah ada sertifikat?', '[REPLACE: ada atau tidak]'],
        ]),
      ]),
      orderSection('Daftar Sekarang', 'Isi data di bawah ini untuk mendaftar.'),
      footerSection('[REPLACE: Nama Kelas]'),
    ],
  }),
};
