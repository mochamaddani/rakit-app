'use client';

import { useMemo, useState } from 'react';
import { Input } from '@/components/ui/input';
import type { CommandResult } from '@/lib/editor/commands';
import { describeFields } from '@/lib/editor/inspector/fields';
import { findSection } from '@/lib/editor/structure';
import { SectionStyleSchema } from '@/lib/schema/primitives';
import { useEditor } from '../editor-context';
import { FieldShell } from './controls/field-shell';
import { FieldList } from './field-list';
import type { FieldActions } from './types';

const notAList = (): CommandResult => ({ ok: false, code: 'invalid', reason: 'Not a list' });

/** The band's style and anchor; shown for a selected section and in a block's Section tab. */
export function SectionFields({ sectionId }: { sectionId: string }) {
  const doc = useEditor((s) => s.doc);
  const dispatch = useEditor((s) => s.dispatch);
  const endCoalescing = useEditor((s) => s.endCoalescing);
  const section = doc.sections[findSection(doc, sectionId)];

  const actions = useMemo<FieldActions>(
    () => ({
      set: (path, value) =>
        dispatch(
          { type: 'setSectionStyle', sectionId, path, value },
          { coalesceKey: `section:${sectionId}:${path.join('.')}` },
        ),
      endEdit: endCoalescing,
      listInsert: notAList,
      listMove: notAList,
      listRemove: notAList,
      listDuplicate: notAList,
    }),
    [dispatch, endCoalescing, sectionId],
  );
  if (!section) return null;

  return (
    <div className="grid gap-4">
      <FieldList
        fields={describeFields(SectionStyleSchema)}
        value={section.style}
        path={[]}
        actions={actions}
        context={{ doc, definition: null, idPrefix: `section-${sectionId}` }}
      />
      <AnchorField key={sectionId} sectionId={sectionId} anchor={section.anchor} />
    </div>
  );
}

/** Its error is the command's own reason (pattern, reserved prefix, uniqueness). */
function AnchorField({ sectionId, anchor }: { sectionId: string; anchor: string | undefined }) {
  const dispatch = useEditor((s) => s.dispatch);
  const endCoalescing = useEditor((s) => s.endCoalescing);
  const committed = anchor ?? '';
  const [state, setState] = useState({
    draft: committed,
    error: null as string | null,
    base: committed,
  });
  if (state.base !== committed) setState({ draft: committed, error: null, base: committed });
  const id = `section-${sectionId}-anchor`;

  return (
    <FieldShell
      id={id}
      label="Anchor"
      error={state.error}
      help="Links to this section use #anchor. Lowercase letters, digits and dashes."
    >
      <Input
        id={id}
        value={state.draft}
        maxLength={41}
        spellCheck={false}
        aria-invalid={state.error ? true : undefined}
        onChange={(event) => {
          const draft = event.target.value;
          const result = dispatch(
            { type: 'setSectionAnchor', sectionId, anchor: draft === '' ? undefined : draft },
            { coalesceKey: `section:${sectionId}:anchor` },
          );
          setState((current) => ({ ...current, draft, error: result.ok ? null : result.reason }));
        }}
        onBlur={() => {
          setState((current) =>
            current.error ? { ...current, draft: current.base, error: null } : current,
          );
          endCoalescing();
        }}
      />
    </FieldShell>
  );
}

export function SectionPanel({ sectionId }: { sectionId: string }) {
  return (
    <div className="grid gap-4 p-4">
      <h2 className="text-sm font-semibold">Section</h2>
      <SectionFields sectionId={sectionId} />
    </div>
  );
}
