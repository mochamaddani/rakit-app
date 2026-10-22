'use client';

import type { ChoiceSpec } from '@/lib/editor/inspector/fields';
import { fieldId, type ControlProps } from '../types';
import { FieldShell } from './field-shell';

export const selectClass =
  'h-8 w-full rounded-lg border border-input bg-transparent px-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50';

export function ChoiceControl({ spec, value, path, actions, context }: ControlProps<ChoiceSpec>) {
  const id = fieldId(context, path);
  return (
    <FieldShell id={id} label={spec.label}>
      <select
        id={id}
        className={selectClass}
        value={value === undefined ? '' : String(value)}
        onChange={(event) => {
          const option = spec.options.find((o) => String(o.value) === event.target.value);
          actions.set(path, option?.value);
        }}
      >
        {spec.optional ? <option value="">Default</option> : null}
        {spec.options.map((option) => (
          <option key={String(option.value)} value={String(option.value)}>
            {option.label}
          </option>
        ))}
      </select>
    </FieldShell>
  );
}
