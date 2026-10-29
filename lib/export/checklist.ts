import { countdownEndMs, type CountdownProps } from '@/lib/blocks/countdown/schema';
import type { CustomHtmlProps } from '@/lib/blocks/custom-html/schema';
import { detectFormProvider, formIsMissing } from '@/lib/blocks/form-embed/providers';
import type { FormEmbedProps } from '@/lib/blocks/form-embed/schema';
import type { FooterProps } from '@/lib/blocks/footer/schema';
import type { BlockInstance, PageDocument } from '@/lib/schema/document';
import { isWhatsAppNumber } from '@/lib/renderer/whatsapp';
import { hasTrackingIds } from '@/lib/schema/settings';
import { sanitizeHtml } from '@/lib/sanitize/html';
import { collectImages } from './images';
import { formatBytes, SIZE_HARD_BYTES, SIZE_WARN_BYTES } from './size';

// The pre-export checklist (PRD §6.7, §6.11): warnings only, never a blocker.

export type ChecklistLevel = 'warn' | 'hard';

export interface ChecklistItem {
  id: string;
  level: ChecklistLevel;
  message: string;
  blockIds?: string[];
}

export interface ChecklistInput {
  doc: PageDocument;
  /** "Include tracking" in the export dialog. */
  tracking: boolean;
  bytes: number;
  /** From the image step: images that stayed links, and inlined images over 300 KB. */
  images: { failed: number; large: number };
  /** When the export is built, for countdown deadlines. */
  now: Date;
}

const PRIVACY = /privacy|privasi/i;
const PLACEHOLDER = /\[REPLACE:/g;

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

function strings(value: unknown, out: string[] = []): string[] {
  if (typeof value === 'string') out.push(value);
  else if (Array.isArray(value)) value.forEach((item) => strings(item, out));
  else if (value && typeof value === 'object') Object.values(value).forEach((v) => strings(v, out));
  return out;
}

function hasDefaultLink(value: unknown): boolean {
  if (Array.isArray(value)) return value.some(hasDefaultLink);
  if (!value || typeof value !== 'object') return false;
  if ((value as { kind?: unknown }).kind === 'default') return true;
  return Object.values(value).some(hasDefaultLink);
}

/** True when some WhatsApp link in the value has no usable number. */
function hasBrokenWhatsApp(value: unknown): boolean {
  if (Array.isArray(value)) return value.some(hasBrokenWhatsApp);
  if (!value || typeof value !== 'object') return false;
  const link = value as { kind?: unknown; phone?: unknown };
  if (link.kind === 'whatsapp')
    return typeof link.phone !== 'string' || !isWhatsAppNumber(link.phone);
  return Object.values(value).some(hasBrokenWhatsApp);
}

export function preExportChecklist(input: ChecklistInput): ChecklistItem[] {
  const { doc } = input;
  const { seo, tracking } = doc.settings;
  const blocks: BlockInstance[] = doc.sections.flatMap((section) => section.blocks);
  const items: ChecklistItem[] = [];
  const warn = (id: string, message: string, blockIds?: string[]) =>
    items.push(
      blockIds ? { id, level: 'warn', message, blockIds } : { id, level: 'warn', message },
    );

  if (!seo.title.trim()) warn('title', 'Add a page title (Page settings → Search engines).');
  if (!seo.description.trim()) warn('description', 'Add a page description.');

  const footerLinks = blocks
    .filter((block) => block.type === 'footer')
    .flatMap((block) => (block.props as FooterProps).links);
  if (!footerLinks.some((link) => PRIVACY.test(link.label))) {
    warn('privacy', 'Add a privacy policy link to the footer.');
  }

  const allForms = blocks.filter((block) => block.type === 'form-embed');
  if (allForms.length === 0) warn('form', 'The page has no form.');
  const missing = allForms.filter((block) => formIsMissing(block.props as FormEmbedProps));
  if (missing.length > 0) {
    items.push({
      id: 'formMissing',
      level: 'hard',
      message: 'A form has no embed code or address, so the page shows "Form address missing".',
      blockIds: missing.map((block) => block.id),
    });
  }
  const forms = allForms
    .filter((block) => !missing.includes(block))
    .map((block) => ({ block, provider: detectFormProvider(block.props as FormEmbedProps) }));
  for (const { provider } of forms.filter((form) => form.provider?.conversions === 'self')) {
    warn(
      'formSelf',
      `${provider!.label} sends its own conversion events: check that its Meta Pixel ID matches this page's.`,
    );
    break;
  }
  const silent = forms.filter((form) => !form.provider || form.provider.conversions === 'none');
  if (silent.length > 0) {
    const labels = new Set(silent.map((form) => form.provider?.label ?? 'the provider'));
    const name = labels.size === 1 ? [...labels][0]! : 'the provider';
    warn(
      'formSignal',
      `Lead can't be tracked for this form: ${name} doesn't report submits.`,
      silent.map((form) => form.block.id),
    );
  }
  const storelink = forms.filter((form) => form.provider?.id === 'storelink');
  if (storelink.length > 1) {
    warn(
      'formTwice',
      'Only one Storelink form works per page.',
      storelink.map((form) => form.block.id),
    );
  }

  if (input.tracking && !hasTrackingIds(tracking)) warn('tracking', 'No tracking IDs are set.');
  if (!doc.settings.defaultCta && blocks.some((block) => hasDefaultLink(block.props))) {
    warn('defaultCta', 'Buttons set to the page default go nowhere. Set a default button target.');
  }
  const noNumber = blocks.filter((block) => hasBrokenWhatsApp(block.props));
  if (noNumber.length > 0) {
    warn(
      'whatsapp',
      'A WhatsApp button has no phone number, so it goes nowhere.',
      noNumber.map((block) => block.id),
    );
  }

  const noAlt = collectImages(doc).filter(
    (image) => image.blockId !== null && image.src.trim() && !image.alt.trim(),
  );
  if (noAlt.length > 0) {
    warn('alt', `${plural(noAlt.length, 'image has', 'images have')} no alt text.`, [
      ...new Set(noAlt.map((image) => image.blockId!)),
    ]);
  }

  const count = (value: unknown) =>
    strings(value).reduce((sum, text) => sum + (text.match(PLACEHOLDER)?.length ?? 0), 0);
  const placeholders = count(doc.settings) + blocks.reduce((sum, b) => sum + count(b.props), 0);
  if (placeholders > 0) {
    warn(
      'placeholder',
      `${plural(placeholders, '[REPLACE: …] placeholder remains', '[REPLACE: …] placeholders remain')}.`,
      blocks.filter((block) => count(block.props) > 0).map((block) => block.id),
    );
  }

  const countdowns = blocks.filter((block) => block.type === 'countdown');
  const ends = countdowns.map((block) => ({
    id: block.id,
    end: countdownEndMs(block.props as CountdownProps),
  }));
  const ended = ends.filter(({ end }) => end !== null && end <= input.now.getTime());
  if (ended.length > 0) {
    warn(
      'countdownEnded',
      'A countdown has already ended.',
      ended.map(({ id }) => id),
    );
  }
  const unset = ends.filter(({ end }) => end === null);
  if (unset.length > 0) {
    warn(
      'countdownUnset',
      'A countdown has no end date.',
      unset.map(({ id }) => id),
    );
  }

  // Custom HTML is named by its own name, else by its position among Custom HTML blocks.
  const customs = blocks
    .filter((block) => block.type === 'custom-html')
    .map((block, i) => {
      const props = block.props as CustomHtmlProps;
      return { block, props, name: props.blockName.trim() || `Custom HTML ${i + 1}` };
    });
  const running = customs.filter(({ props }) => props.runScripts);
  if (running.length > 0) {
    warn(
      'customHtmlScripts',
      `Custom HTML runs scripts on this page: ${running.map(({ name }) => name).join(', ')}.`,
      running.map(({ block }) => block.id),
    );
  }
  // What "Run scripts" off takes out, by block: embeds, forms, scripts, handlers, unsafe links.
  const removed = customs.flatMap(({ block, props, name }) => {
    if (props.runScripts) return [];
    const { report } = sanitizeHtml(props.html);
    const parts = [
      ...report.removedTags,
      ...(report.hadScripts && !report.removedTags.includes('script') ? ['event handlers'] : []),
      ...(report.removedUrls > 0 ? ['unsafe links'] : []),
    ];
    return parts.length > 0
      ? [{ block, name, parts, iframe: report.removedTags.includes('iframe') }]
      : [];
  });
  if (removed.length > 0) {
    const list = removed.map(({ name, parts }) => `${name} (${parts.join(', ')})`).join(', ');
    const video = removed.some(({ iframe }) => iframe)
      ? ' For YouTube or Vimeo, use a Video block.'
      : '';
    warn(
      'customHtmlRemoved',
      `Parts of Custom HTML were removed (turn on Run scripts to keep them): ${list}.${video}`,
      removed.map(({ block }) => block.id),
    );
  }

  const code = [
    input.tracking && tracking.headCode.trim() ? 'head code' : '',
    input.tracking && tracking.bodyCode.trim() ? 'body code' : '',
    forms.some(
      ({ block }) =>
        (block.props as FormEmbedProps).mode === 'snippet' &&
        (block.props as FormEmbedProps).code.trim(),
    )
      ? 'checkout form code'
      : '',
  ].filter(Boolean);
  if (code.length > 0) warn('customCode', `Custom code runs on this page: ${code.join(', ')}.`);

  const { failed, large } = input.images;
  if (failed > 0) {
    warn(
      'imagesFailed',
      `${plural(failed, 'image', 'images')} couldn't be inlined and stay links.`,
    );
  }
  if (large > 0) warn('largeImages', `${plural(large, 'image is', 'images are')} over 300 KB.`);

  if (input.bytes > SIZE_HARD_BYTES) {
    items.push({
      id: 'size',
      level: 'hard',
      message: `The file is ${formatBytes(input.bytes)}, over 3 MB. Use Hosted images.`,
    });
  } else if (input.bytes > SIZE_WARN_BYTES) {
    warn(
      'size',
      `The file is ${formatBytes(input.bytes)}, over 1 MB. Hosted images make it lighter.`,
    );
  }
  return items;
}
