// The owner's Teh Kumis Kucing landing page (version 1: "Pesan Sekarang" opens WhatsApp), with
// a Storelink order form section added. Rebuilt from files/public/teh-kumis-kucing/index.html with
// today's blocks; M4 turns it into a built-in template. Copy is the owner's, verbatim.

export const TEH_KUMIS_KUCING_IMAGES = ['header', 'benefit', 'promo', 'packages', 'cod'] as const;
export type TehKumisKucingImage = (typeof TEH_KUMIS_KUCING_IMAGES)[number];

/** The original page's image files, keyed by where they appear. */
export const TEH_KUMIS_KUCING_FILES: Record<TehKumisKucingImage, string> = {
  header: 'header_image.png',
  benefit: 'benefit_image.png',
  promo: 'super_promo.png',
  packages: 'packages.png',
  cod: 'cash_on_delivery.png',
};

export interface TemplateImage {
  src: string;
  width?: number;
  height?: number;
  assetId?: string;
}

const WHATSAPP = `https://wa.me/6287891570167?text=${encodeURIComponent(
  'Halo kak, saya mau beli Teh Kumis Kucingnya dong.',
)}`;

/** The owner's Storelink order form, as Storelink hands it out (D-048). */
const STORELINK =
  '<script id="evf-widget-script">!function(e,m,t,r,o,d,a){(d=m.createElement(t)).async=!0,d.src=r,(a=m.getElementsByTagName(t)[0]).parentNode.insertBefore(d,a),d.onload=()=>o(e)}(window,document,"script","https://srstorebdg.storelink.id/script/embed",e=>{e.embedEvfScript({url:"https://srstorebdg.storelink.id/teh-kumis-kucing",delayLoad:200})});</script>';

const orderButton = {
  label: 'Pesan Sekarang',
  link: { kind: 'url', url: WHATSAPP, newTab: true },
  event: 'Lead',
};

const image = (img: TemplateImage, alt: string) => ({ ...img, alt });

/** A raw PageDocument (validated by the caller) using the given uploaded images. */
export function tehKumisKucingDocument(images: Record<TehKumisKucingImage, TemplateImage>) {
  return {
    schemaVersion: 1,
    settings: {
      lang: 'id',
      seo: {
        title: 'Teh Kumis Kucing — Teh Herbal Alami',
        description:
          'Teh Kumis Kucing, minuman herbal alami dari daun Orthosiphon aristatus pilihan. Diproses tanpa tambahan bahan kimia.',
      },
      theme: {
        colors: {
          primary: '#245E54',
          onPrimary: '#FFFFFF',
          accent: '#FECD03',
          onAccent: '#1A463F',
          background: '#FFFFFF',
          surface: '#E9F1EF',
          text: '#21302C',
          mutedText: '#5B6B66',
          border: '#DBE6E2',
          dark: '#1A463F',
          onDark: '#FFFFFF',
        },
        font: 'geometric',
        headingFont: 'geometric',
        radius: 'lg',
        buttonShape: 'pill',
      },
      defaultCta: { kind: 'section', sectionId: 'sPesan' },
      tracking: {
        metaPixelId: '480125371067808',
        ga4Id: 'G-RJD8R8GZHW',
        googleAdsId: 'AW-18391075496',
        googleAdsLeadLabel: 'LkwNCLne3OMcEKiVxsFE',
        gtmId: 'GTM-WMCLH9HB',
      },
    },
    sections: [
      {
        id: 'sHero',
        style: { tone: 'muted', padY: 'lg', width: 'wide' },
        blocks: [
          {
            id: 'bHero',
            type: 'hero',
            props: {
              eyebrow: 'Teh Herbal Alami',
              headline: 'Teh Kumis Kucing',
              subheadline:
                '**Detox Alami, Tubuh Lebih Sehat**\nTerbuat dari daun **Orthosiphon Aristatus** pilihan.',
              primaryCta: orderButton,
              trustLine: '100% Alami • Tanpa Bahan Kimia • Aman Dikonsumsi',
              image: image(images.header, 'Kemasan Teh Kumis Kucing'),
              layout: 'split',
              align: 'left',
            },
          },
        ],
      },
      {
        id: 'sIntro',
        style: { tone: 'primary', padY: 'md', width: 'narrow' },
        blocks: [
          {
            id: 'bIntro',
            type: 'benefits',
            props: {
              subheading:
                'Teh Kumis Kucing merupakan minuman herbal alami yang dibuat dari daun Orthosiphon aristatus pilihan. Diproses tanpa tambahan bahan kimia.',
            },
            style: { align: 'center' },
          },
        ],
      },
      {
        id: 'sManfaat',
        style: { tone: 'muted', padY: 'lg', width: 'normal' },
        blocks: [
          {
            id: 'bManfaat',
            type: 'hero',
            props: {
              headline: 'Manfaat Teh Kumis Kucing',
              subheadline: 'Pilihan tepat untuk hidup yang lebih sehat, alami, dan seimbang.',
              image: image(images.benefit, 'Manfaat Teh Kumis Kucing'),
              layout: 'stacked',
              align: 'center',
            },
          },
        ],
      },
      {
        id: 'sPromo',
        anchor: 'promo',
        style: { tone: 'base', padY: 'lg', width: 'normal' },
        blocks: [
          {
            id: 'bPromo',
            type: 'hero',
            props: {
              eyebrow: 'Siap Hidup Lebih Sehat?',
              headline: 'Dapatkan Diskon Beli 1 Gratis 1',
              subheadline:
                'Pesan Teh Kumis Kucing sekarang dan rasakan manfaatnya secara alami.\nHanya ==99ribu==',
              primaryCta: orderButton,
              trustLine: '*Promo terbatas selama persediaan masih ada.',
              image: image(images.promo, 'Super Promo Teh Kumis Kucing'),
              layout: 'stacked',
              align: 'center',
            },
          },
        ],
      },
      {
        id: 'sPaket',
        style: { tone: 'muted', padY: 'lg', width: 'normal' },
        blocks: [
          {
            id: 'bPaket',
            type: 'hero',
            props: {
              headline: 'Ratusan Paket Kami Kirim Setiap Hari',
              subheadline: 'Bukti nyata kepercayaan pelanggan kami di seluruh Indonesia.',
              image: image(
                images.packages,
                'Ratusan paket Teh Kumis Kucing siap dikirim setiap hari',
              ),
              layout: 'stacked',
              align: 'center',
            },
          },
        ],
      },
      {
        id: 'sCod',
        anchor: 'cod',
        style: { tone: 'base', padY: 'lg', width: 'normal' },
        blocks: [
          {
            id: 'bCod',
            type: 'hero',
            props: {
              headline: 'Bisa Bayar di Tempat (COD)',
              subheadline: 'Bayar saat barang sampai di tangan Anda, langsung ke kurir.',
              image: image(
                images.cod,
                'Cash on Delivery (COD) — bayar di tempat. Aman: bayar saat barang sampai di tangan Anda. Praktis: tidak perlu transfer, bayar langsung ke kurir. Terpercaya: layanan COD untuk belanja lebih nyaman.',
              ),
              layout: 'stacked',
              align: 'center',
            },
          },
        ],
      },
      {
        id: 'sPesan',
        anchor: 'pesan',
        style: { tone: 'muted', padY: 'lg', width: 'narrow' },
        blocks: [
          {
            id: 'bPesan',
            type: 'form-embed',
            props: {
              heading: 'Lengkapi Data Pemesanan',
              subheading: 'Isi data pengiriman di bawah ini. Bayar di tempat saat paket sampai.',
              mode: 'snippet',
              code: STORELINK,
            },
          },
        ],
      },
      {
        id: 'sFooter',
        style: { tone: 'dark', padY: 'md', width: 'normal' },
        blocks: [
          {
            id: 'bFooter',
            type: 'footer',
            props: { brand: 'Belanja Kuy! ID', copyright: '2026' },
          },
        ],
      },
    ],
  };
}
