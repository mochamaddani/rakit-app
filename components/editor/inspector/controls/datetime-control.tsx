'use client';

import { Input } from '@/components/ui/input';
import { fieldError, type DateTimeSpec } from '@/lib/editor/inspector/fields';
import { fieldId, type ControlProps } from '../types';
import { useFieldDraft } from '../use-field-draft';
import { FieldShell } from './field-shell';

/** A wall-clock deadline ('YYYY-MM-DDTHH:MM'); clearing the input stores ''. */
export function DateTimeControl({
  spec,
  value,
  path,
  actions,
  context,
}: ControlProps<DateTimeSpec>) {
  const id = fieldId(context, path);
  const { draft, error, change, blur } = useFieldDraft(
    typeof value === 'string' ? value : '',
    (v) => fieldError(spec, v),
  );
  return (
    <FieldShell id={id} label={spec.label} error={error}>
      <Input
        id={id}
        type="datetime-local"
        step={60}
        value={draft}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-error` : undefined}
        onChange={(event) => change(event.target.value, (v) => actions.set(path, v))}
        onBlur={() => {
          blur();
          actions.endEdit();
        }}
      />
    </FieldShell>
  );
}
