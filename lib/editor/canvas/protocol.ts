import { z } from 'zod';
import { LIMITS } from '@/lib/schema/document';
import { IdSchema } from '@/lib/schema/ids';
import { CANVAS_SOURCE, CHANNEL_PATTERN } from './constants';

// Messages between the editor and the canvas iframe (docs/DECISIONS.md D-039). Everything the
// iframe sends is untrusted: it is validated here, and the editor still checks ids against the
// document before acting on them.

const Coordinate = z.number().min(-1e7).max(1e7);
const Rev = z
  .number()
  .int()
  .min(0)
  .max(2 ** 31);
const Rect = z.object({
  id: IdSchema,
  top: Coordinate,
  left: Coordinate,
  width: Coordinate,
  height: Coordinate,
});

const CanvasEventSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('ready') }),
  z.object({
    type: z.literal('rects'),
    rev: Rev,
    scrollY: Coordinate,
    viewportWidth: Coordinate,
    viewportHeight: Coordinate,
    docHeight: Coordinate,
    sections: z.array(Rect).max(LIMITS.sections),
    blocks: z.array(Rect).max(LIMITS.totalBlocks),
  }),
  z.object({ type: z.literal('hover'), blockId: IdSchema.nullable() }),
  z.object({
    type: z.literal('select'),
    target: z.discriminatedUnion('kind', [
      z.object({ kind: z.literal('block'), blockId: IdSchema }),
      z.object({ kind: z.literal('section'), sectionId: IdSchema }),
    ]),
  }),
  z.object({
    type: z.literal('key'),
    input: z.object({
      key: z.string().max(16),
      mod: z.boolean(),
      shift: z.boolean(),
      alt: z.boolean(),
    }),
  }),
  z.object({ type: z.literal('synced'), rev: Rev }),
  z.object({ type: z.literal('error'), message: z.string().max(500) }),
]);

export type CanvasEvent = z.output<typeof CanvasEventSchema>;

const EnvelopeSchema = z.object({
  source: z.literal(CANVAS_SOURCE),
  channel: z.string().regex(CHANNEL_PATTERN),
});

/** One message from the iframe, validated; null when it is not a valid event on this channel. */
export function parseCanvasEvent(data: unknown, channel: string): CanvasEvent | null {
  const envelope = EnvelopeSchema.safeParse(data);
  if (!envelope.success || envelope.data.channel !== channel) return null;
  const event = CanvasEventSchema.safeParse(data);
  return event.success ? event.data : null;
}

export interface SyncPayload {
  css?: string;
  js?: string;
  lang?: string;
  skeleton?: string;
  blocks: { id: string; html: string }[];
}

export type CanvasCommand =
  | ({ type: 'sync'; rev: number } & SyncPayload)
  | { type: 'scrollTo'; blockId: string }
  /** Auto-scroll during a drag; answered with rects even at the scroll edge (D-034). */
  | { type: 'scrollBy'; dy: number }
  | { type: 'hello' };

/** Adds `source` and `channel`, ready for postMessage. */
export function envelope(channel: string, command: CanvasCommand): Record<string, unknown> {
  return { source: CANVAS_SOURCE, channel, ...command };
}
