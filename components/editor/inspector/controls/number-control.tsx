'use client';

import { Input } from '@/components/ui/input';
import { fieldError, type NumberSpec } from '@/lib/editor/inspector/fields';
import { formatPrice } from '@/lib/renderer/format';
import { fieldId, type ControlProps } from '../types';
import { useFieldDraft } from '../use-field-draft';
import { FieldShell } from './field-shell';

const PRICE_KEYS = new Set(['price', 'compareAtPrice']);

export function NumberControl({ spec, value, path, actions, context }: ControlProps<NumberSpec>) {
  const id = fieldId(context, path);
  const validate = (text: string) => {
    if (text.trim() === '') return spec.optional ? null : 'Required';
    const n = Number(text);
    return Number.isFinite(n) ? fieldError(spec, n) : 'Enter a number';
  };
  const { draft, error, change, blur } = useFieldDraft(
    typeof value === 'number' ? String(value) : '',
    validate,
  );
  const amount = Number(draft);
  const showPrice =
    PRICE_KEYS.has(spec.key) && draft.trim() !== '' && Number.isFinite(amount) && !error;

  return (
    <FieldShell
      id={id}
      label={spec.label}
      error={error}
      help={showPrice ? formatPrice(amount, context.doc.settings.price) : undefined}
    >
      <Input
        id={id}
        type="number"
        inputMode="decimal"
        step={spec.int ? 1 : 'any'}
        min={spec.min ?? undefined}
        max={spec.max ?? undefined}
        value={draft}
        aria-invalid={error ? true : undefined}
        onChange={(event) =>
          change(event.target.value, (text) =>
            actions.set(path, text.trim() === '' ? undefined : Number(text)),
          )
        }
        onBlur={() => {
          blur();
          actions.endEdit();
        }}
      />
    </FieldShell>
  );
}
