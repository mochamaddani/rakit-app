import { sanitizeUrl } from '@/lib/renderer/url';
import type { FormEmbedProps } from './schema';

// Form providers the Checkout Form knows (docs/DECISIONS.md D-048). The owner's order form is
// Storelink: its widget runs in the page and sends its own pixel and server-side events.

export type FormProviderId = 'storelink' | 'tally' | 'google-forms';

export interface FormProvider {
  id: FormProviderId;
  label: string;
  /** Hostnames (and their subdomains), optionally with a path prefix ('docs.google.com/forms'). */
  hosts: readonly string[];
  /**
   * How a conversion reaches the ad platforms:
   * 'message': the provider posts a submit message and this page fires Lead (Tally);
   * 'self': the provider fires its own pixel and server-side events, so this page fires nothing (Storelink);
   * 'none': nobody does (Google Forms).
   */
  conversions: 'message' | 'self' | 'none';
  /** Origins a submit message may come from ('message' providers only). */
  submitOrigins: readonly string[];
  /** Share link → embeddable URL; iframe mode only. */
  embedUrl(url: URL): string;
}

export const FORM_PROVIDERS: readonly FormProvider[] = [
  {
    id: 'storelink',
    label: 'Storelink',
    hosts: ['storelink.id', 'gabung.id'],
    conversions: 'self',
    submitOrigins: [],
    embedUrl: (url) => url.href,
  },
  {
    id: 'tally',
    label: 'Tally',
    hosts: ['tally.so'],
    conversions: 'message',
    submitOrigins: ['https://tally.so'],
    embedUrl: (url) => {
      const share = /^\/r\/([A-Za-z0-9]+)\/?$/.exec(url.pathname);
      return share ? `https://tally.so/embed/${share[1]}?transparentBackground=1` : url.href;
    },
  },
  {
    id: 'google-forms',
    label: 'Google Forms',
    hosts: ['docs.google.com/forms'],
    conversions: 'none',
    submitOrigins: [],
    embedUrl: (url) => {
      const next = new URL(url.href);
      next.searchParams.set('embedded', 'true');
      return next.href;
    },
  },
];

function matches(url: URL, pattern: string): boolean {
  const slash = pattern.indexOf('/');
  const host = slash === -1 ? pattern : pattern.slice(0, slash);
  const path = slash === -1 ? '' : pattern.slice(slash);
  const hostname = url.hostname.toLowerCase();
  return (
    (hostname === host || hostname.endsWith(`.${host}`)) &&
    (path === '' || url.pathname === path || url.pathname.startsWith(`${path}/`))
  );
}

function webUrl(text: string): URL | null {
  try {
    const url = new URL(text);
    return url.protocol === 'http:' || url.protocol === 'https:' ? url : null;
  } catch {
    return null;
  }
}

const providerFor = (url: URL) =>
  FORM_PROVIDERS.find((provider) => provider.hosts.some((pattern) => matches(url, pattern))) ??
  null;

const CODE_URL = /https?:\/\/[^\s"'<>`)]+/gi;

/** The provider named by an iframe URL's host, or by a URL inside snippet code; null otherwise. */
export function detectFormProvider(
  props: Pick<FormEmbedProps, 'mode' | 'url' | 'code'>,
): FormProvider | null {
  if (props.mode === 'iframe') {
    const url = webUrl(props.url.trim());
    return url ? providerFor(url) : null;
  }
  for (const match of props.code.match(CODE_URL) ?? []) {
    const url = webUrl(match);
    const provider = url && providerFor(url);
    if (provider) return provider;
  }
  return null;
}

/** An absolute http(s) link that is safe to emit, or null. */
export function webLink(value: string): string | null {
  const url = sanitizeUrl(value, 'link');
  return url && /^https?:\/\//i.test(url) ? url : null;
}

/** True when export would show "Form address missing" instead of a form. */
export function formIsMissing(props: Pick<FormEmbedProps, 'mode' | 'url' | 'code'>): boolean {
  return props.mode === 'snippet' ? !props.code.trim() : webLink(props.url) === null;
}

/** What the form still needs, or who sends its conversion; for the inspector. */
export function formTrackingNote(props: Pick<FormEmbedProps, 'mode' | 'url' | 'code'>): string {
  if (formIsMissing(props)) {
    return props.mode === 'snippet'
      ? 'Paste the embed code from your form provider.'
      : 'Enter the form address, starting with https://.';
  }
  const provider = detectFormProvider(props);
  switch (provider?.conversions) {
    case 'self':
      return `${provider.label} sends its own conversion events. Set the Meta Pixel and events in ${provider.label}, using the same Pixel ID as this page.`;
    case 'message':
      return 'Fires Lead when the form is submitted.';
    default:
      return `${provider?.label ?? 'This form'} doesn't report submits, so Lead can't fire here.`;
  }
}
