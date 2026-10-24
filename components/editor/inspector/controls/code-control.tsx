'use client';

import { Textarea } from '@/components/ui/textarea';
import { fieldError, type CodeSpec } from '@/lib/editor/inspector/fields';
import { fieldId, type ControlProps } from '../types';
import { useFieldDraft } from '../use-field-draft';
import { FieldShell } from './field-shell';

/** Raw code the owner pastes; it runs only in the exported page, never in the editor. */
export function CodeControl({ spec, value, path, actions, context }: ControlProps<CodeSpec>) {
  const id = fieldId(context, path);
  const { draft, error, change, blur } = useFieldDraft(
    typeof value === 'string' ? value : '',
    (v) => fieldError(spec, v),
  );
  return (
    <FieldShell
      id={id}
      label={spec.label}
      error={error}
      aside={
        <span className="text-[11px] text-muted-foreground tabular-nums">
          {draft.length}/{spec.max}
        </span>
      }
    >
      <Textarea
        id={id}
        rows={8}
        spellCheck={false}
        className="font-mono text-xs"
        value={draft}
        maxLength={spec.max}
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
