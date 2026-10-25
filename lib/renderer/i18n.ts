import type { Lang } from '@/lib/schema/settings';

export type MessageKey =
  | 'products'
  | 'prevSlide'
  | 'nextSlide'
  | 'goToSlide'
  | 'slideLabel'
  | 'rated'
  | 'reviews'
  | 'originalPrice'
  | 'links'
  | 'untitled'
  | 'orderForm'
  | 'formMissing'
  | 'logos'
  | 'days'
  | 'hours'
  | 'minutes'
  | 'seconds'
  | 'offerEnded'
  | 'video'
  | 'playVideo'
  | 'videoMissing'
  | 'cookieNotice'
  | 'cookieOk'
  | 'cookieRegion'
  | 'privacy'
  | 'customHtml';

const MESSAGES: Record<Lang, Record<MessageKey, string>> = {
  id: {
    products: 'Produk',
    prevSlide: 'Slide sebelumnya',
    nextSlide: 'Slide berikutnya',
    goToSlide: 'Ke slide {n}',
    slideLabel: '{n} dari {total}',
    rated: 'Rating {rating} dari 5',
    reviews: '{count} ulasan',
    originalPrice: 'Harga normal',
    links: 'Tautan',
    untitled: 'Tanpa judul',
    orderForm: 'Formulir pemesanan',
    formMissing: 'Alamat formulir belum diisi.',
    logos: 'Logo',
    days: 'Hari',
    hours: 'Jam',
    minutes: 'Menit',
    seconds: 'Detik',
    offerEnded: 'Promo telah berakhir',
    video: 'Video',
    playVideo: 'Putar: {title}',
    videoMissing: 'Alamat video belum diisi.',
    cookieNotice: 'Situs ini memakai cookie untuk mengukur iklan dan memperbaiki halaman.',
    cookieOk: 'Oke',
    cookieRegion: 'Pemberitahuan cookie',
    privacy: 'Kebijakan privasi',
    customHtml: 'HTML khusus',
  },
  en: {
    products: 'Products',
    prevSlide: 'Previous slide',
    nextSlide: 'Next slide',
    goToSlide: 'Go to slide {n}',
    slideLabel: '{n} of {total}',
    rated: 'Rated {rating} out of 5',
    reviews: '{count} reviews',
    originalPrice: 'Original price',
    links: 'Links',
    untitled: 'Untitled',
    orderForm: 'Order form',
    formMissing: 'Form address missing.',
    logos: 'Logos',
    days: 'Days',
    hours: 'Hours',
    minutes: 'Minutes',
    seconds: 'Seconds',
    offerEnded: 'This offer has ended',
    video: 'Video',
    playVideo: 'Play: {title}',
    videoMissing: 'Video address missing.',
    cookieNotice: 'This site uses cookies to measure ads and improve the page.',
    cookieOk: 'OK',
    cookieRegion: 'Cookie notice',
    privacy: 'Privacy policy',
    customHtml: 'Custom HTML',
  },
};

/** Strings that appear inside exported pages (labels, screen-reader text), in the page language. */
export function t(lang: Lang, key: MessageKey, vars: Record<string, string | number> = {}): string {
  return MESSAGES[lang][key].replace(/\{(\w+)\}/g, (placeholder, name: string) =>
    name in vars ? String(vars[name]) : placeholder,
  );
}
