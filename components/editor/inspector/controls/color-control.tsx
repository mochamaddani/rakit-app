'use client';

import { Input } from '@/components/ui/input';
import { fieldError, type ColorSpec } from '@/lib/editor/inspector/fields';
import { fieldId, type ControlProps } from '../types';
import { useFieldDraft } from '../use-field-draft';
import { FieldShell } from './field-shell';

export function ColorControl({ spec, value, path, actions, context }: ControlProps<ColorSpec>) {
  const id = fieldId(context, path);
  const committed = typeof value === 'string' ? value : '#000000';
  const { draft, error, change, blur } = useFieldDraft(committed, (v) => fieldError(spec, v));
  const commit = (v: string) => actions.set(path, v);

  return (
    <div className="grid gap-1">
      <FieldShell id={id} label={spec.label} error={error}>
        <div className="flex items-center gap-2">
          <input
            type="color"
            aria-label={`${spec.label} (picker)`}
            value={committed.toLowerCase()}
            onChange={(event) => change(event.target.value.toUpperCase(), commit)}
            onBlur={() => actions.endEdit()}
            className="h-8 w-10 shrink-0 cursor-pointer rounded-md border border-input bg-transparent p-0.5"
          />
          <Input
            id={id}
            value={draft}
            maxLength={7}
            spellCheck={false}
            aria-invalid={error ? true : undefined}
            onChange={(event) => change(event.target.value, commit)}
            onBlur={() => {
              blur();
              actions.endEdit();
            }}
            className="font-mono"
          />
        </div>
      </FieldShell>
      {context.renderExtra?.(spec, path)}
    </div>
  );
}
