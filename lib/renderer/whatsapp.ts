// WhatsApp chat links (docs/DECISIONS.md D-057): the owner types a phone number, the page links to
// https://wa.me/<number>. Numbers are digits in international form; Indonesian local numbers
// (08…) become 628….

const MIN_DIGITS = 8;
/** E.164 allows at most 15 digits. */
const MAX_DIGITS = 15;

/**
 * Digits only, in international form: `0812…` → `62812…`, `+62 812-…` → `62812…`,
 * `62 0812…` → `62812…`, `0062…` → `62…`. Safe to run on every keystroke: it never undoes itself.
 */
export function normalizeWhatsAppNumber(input: string): string {
  let digits = input.replace(/\D/g, '');
  if (digits.startsWith('00')) digits = digits.slice(2);
  else if (digits.startsWith('0')) digits = `62${digits.slice(1)}`;
  if (digits.startsWith('620')) digits = `62${digits.slice(3)}`;
  return digits.slice(0, MAX_DIGITS);
}

/** True when the number is long enough to be a real WhatsApp number. */
export function isWhatsAppNumber(input: string): boolean {
  return normalizeWhatsAppNumber(input).length >= MIN_DIGITS;
}

/** The wa.me address, with the message prefilled; null without a usable number. */
export function whatsAppUrl(phone: string, message = ''): string | null {
  if (!isWhatsAppNumber(phone)) return null;
  const text = message.trim();
  return `https://wa.me/${normalizeWhatsAppNumber(phone)}${
    text ? `?text=${encodeURIComponent(text)}` : ''
  }`;
}
