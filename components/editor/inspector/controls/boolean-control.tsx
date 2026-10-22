'use client';

import type { BooleanSpec } from '@/lib/editor/inspector/fields';
import { fieldId, type ControlProps } from '../types';

export function BooleanControl({ spec, value, path, actions, context }: ControlProps<BooleanSpec>) {
  const id = fieldId(context, path);
  return (
    <div className="flex items-center gap-2">
      <input
        id={id}
        type="checkbox"
        checked={value === true}
        onChange={(event) => actions.set(path, event.target.checked)}
        className="size-4 accent-sky-600"
      />
      <label htmlFor={id} className="text-xs font-medium">
        {spec.label}
      </label>
    </div>
  );
}
