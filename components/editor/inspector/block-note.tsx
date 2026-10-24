'use client';

import { formTrackingNote } from '@/lib/blocks/form-embed/providers';
import type { FormEmbedProps } from '@/lib/blocks/form-embed/schema';

// Notes some blocks show under their generated fields (docs/DECISIONS.md D-014: client-side
// inspector additions are registered here, outside the pure block definitions).
const NOTES: Readonly<Record<string, (props: unknown) => string>> = {
  'form-embed': (props) => formTrackingNote(props as FormEmbedProps),
};

export function BlockNote({ type, props }: { type: string; props: unknown }) {
  const note = Object.hasOwn(NOTES, type) ? NOTES[type]!(props) : null;
  if (!note) return null;
  return (
    <p
      className="mt-4 rounded-md bg-muted p-3 text-xs text-muted-foreground"
      data-testid="block-note"
    >
      {note}
    </p>
  );
}
