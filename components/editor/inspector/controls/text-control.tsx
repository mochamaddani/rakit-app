'use client';

import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { fieldError, type TextSpec } from '@/lib/editor/inspector/fields';
import { fieldId, type ControlProps } from '../types';
import { useFieldDraft } from '../use-field-draft';
import { FieldShell } from './field-shell';

/** Shows `n/max` once 80 % of the limit is used. */
export function Counter({ length, max }: { length: number; max: number }) {
  if (!Number.isFinite(max) || length < max * 0.8) return null;
  return (
    <span className="text-[11px] text-muted-foreground tabular-nums">
      {length}/{max}
    </span>
  );
}

export function TextControl({ spec, value, path, actions, context }: ControlProps<TextSpec>) {
  const id = fieldId(context, path);
  const { draft, error, change, blur } = useFieldDraft(
    typeof value === 'string' ? value : '',
    (v) => fieldError(spec, spec.optional && v === '' ? undefined : v),
  );
  const props = {
    id,
    value: draft,
    maxLength: Number.isFinite(spec.max) ? spec.max : undefined,
    'aria-invalid': error ? true : undefined,
    'aria-describedby': error ? `${id}-error` : undefined,
    onChange: (event: { target: { value: string } }) =>
      change(event.target.value, (v) =>
        actions.set(path, spec.optional && v === '' ? undefined : v),
      ),
    onBlur: () => {
      blur();
      actions.endEdit();
    },
  };
  return (
    <FieldShell
      id={id}
      label={spec.label}
      error={error}
      aside={<Counter length={draft.length} max={spec.max} />}
    >
      {spec.multiline ? <Textarea rows={3} {...props} /> : <Input {...props} />}
    </FieldShell>
  );
}
