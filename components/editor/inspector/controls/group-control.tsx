'use client';

import { Button } from '@/components/ui/button';
import { initialValueAt, seedValue, type GroupSpec } from '@/lib/editor/inspector/fields';
import { createId } from '@/lib/schema/ids';
import { FieldList } from '../field-list';
import type { ControlProps } from '../types';

export function GroupControl({ spec, value, path, actions, context }: ControlProps<GroupSpec>) {
  const present = typeof value === 'object' && value !== null;
  const add = () =>
    actions.set(
      path,
      context.definition
        ? initialValueAt(context.definition, path, spec.schema, createId)
        : seedValue(spec.schema, createId),
    );

  return (
    <fieldset className="grid gap-3 rounded-md border p-3">
      <legend className="px-1 text-xs font-semibold">{spec.label}</legend>
      {present ? (
        <FieldList
          fields={spec.fields}
          value={value as Record<string, unknown>}
          path={path}
          actions={actions}
          context={context}
        />
      ) : null}
      {spec.optional ? (
        <Button
          type="button"
          variant={present ? 'ghost' : 'outline'}
          size="sm"
          onClick={present ? () => actions.set(path, undefined) : add}
        >
          {present ? `Remove ${spec.label.toLowerCase()}` : `Add ${spec.label.toLowerCase()}`}
        </Button>
      ) : null}
    </fieldset>
  );
}
