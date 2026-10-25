import { benefits } from './benefits';
import { cookieBanner } from './cookie-banner';
import { countdown } from './countdown';
import { customHtml } from './custom-html';
import { faq } from './faq';
import { footer } from './footer';
import { formEmbed } from './form-embed';
import { gallery } from './gallery';
import { hero } from './hero';
import { imageText } from './image-text';
import { logos } from './logos';
import { pricing } from './pricing';
import { spacer } from './spacer';
import { productCarousel } from './special/product-carousel';
import { stickyCta } from './sticky-cta';
import { testimonials } from './testimonials';
import type { AnyBlockDefinition } from './types';
import { video } from './video';

// Every block type, one line each. Adding a block = its own folder + one line here (PRD §9).
export const BLOCKS = [
  hero,
  benefits,
  testimonials,
  faq,
  footer,
  productCarousel,
  formEmbed,
  spacer,
  imageText,
  logos,
  gallery,
  pricing,
  countdown,
  video,
  stickyCta,
  cookieBanner,
  customHtml,
] as const;

export type RegisteredBlock = (typeof BLOCKS)[number];
export type BlockType = RegisteredBlock['type'];

const BY_TYPE: ReadonlyMap<string, AnyBlockDefinition> = new Map(
  BLOCKS.map((definition): [string, AnyBlockDefinition] => [definition.type, definition]),
);

export function getBlockDefinition(type: string): AnyBlockDefinition | undefined {
  return BY_TYPE.get(type);
}

export function listBlockDefinitions(): readonly AnyBlockDefinition[] {
  return BLOCKS;
}
