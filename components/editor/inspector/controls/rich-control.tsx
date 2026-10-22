'use client';

import { Bold, Highlighter, Italic, Link2, type LucideIcon } from 'lucide-react';
import { useRef } from 'react';
import { Textarea } from '@/components/ui/textarea';
import { fieldError, type RichSpec } from '@/lib/editor/inspector/fields';
import { fieldId, type ControlProps } from '../types';
import { useFieldDraft } from '../use-field-draft';
import { Counter } from './text-control';
import { FieldShell } from './field-shell';

interface Format {
  label: string;
  icon: LucideIcon;
  before: string;
  after: string;
  /** Characters of `after` to select once wrapped (the link's address). */
  selectAfter?: number;
}

// The inline markup of docs/DECISIONS.md D-009.
const FORMATS: Format[] = [
  { label: 'Bold', icon: Bold, before: '**', after: '**' },
  { label: 'Italic', icon: Italic, before: '*', after: '*' },
  { label: 'Highlight', icon: Highlighter, before: '==', after: '==' },
  { label: 'Link', icon: Link2, before: '[', after: '](https://)', selectAfter: 8 },
];

export function RichControl({ spec, value, path, actions, context }: ControlProps<RichSpec>) {
  const id = fieldId(context, path);
  const ref = useRef<HTMLTextAreaElement>(null);
  const { draft, error, change, blur } = useFieldDraft(
    typeof value === 'string' ? value : '',
    (v) => fieldError(spec, v),
  );
  const commit = (v: string) => actions.set(path, v);

  const wrap = ({ before, after, selectAfter }: Format) => {
    const el = ref.current;
    if (!el) return;
    const { selectionStart: start, selectionEnd: end } = el;
    const next =
      draft.slice(0, start) + before + draft.slice(start, end) + after + draft.slice(end);
    change(next, commit);
    requestAnimationFrame(() => {
      el.focus();
      if (selectAfter) {
        const from = end + before.length + 2;
        el.setSelectionRange(from, from + selectAfter);
      } else {
        el.setSelectionRange(start + before.length, end + before.length);
      }
    });
  };

  return (
    <FieldShell
      id={id}
      label={spec.label}
      error={error}
      help="**bold**, *italic*, ==highlight==, [text](https://…)"
      aside={<Counter length={draft.length} max={spec.max} />}
    >
      <div className="flex gap-0.5" role="toolbar" aria-label={`${spec.label} formatting`}>
        {FORMATS.map((format) => (
          <button
            key={format.label}
            type="button"
            aria-label={format.label}
            title={format.label}
            // Keep the selection in the textarea.
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => wrap(format)}
            className="flex size-6 items-center justify-center rounded text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <format.icon className="size-3.5" aria-hidden="true" />
          </button>
        ))}
      </div>
      <Textarea
        ref={ref}
        id={id}
        rows={3}
        value={draft}
        maxLength={Number.isFinite(spec.max) ? spec.max : undefined}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-error` : undefined}
        onChange={(event) => change(event.target.value, commit)}
        onBlur={() => {
          blur();
          actions.endEdit();
        }}
      />
    </FieldShell>
  );
}
