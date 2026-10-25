'use client';

import { isFieldShown, type FieldSpec } from '@/lib/editor/inspector/fields';
import type { PropPath } from '@/lib/editor/structure';
import { BooleanControl } from './controls/boolean-control';
import { CodeControl } from './controls/code-control';
import { ChoiceControl } from './controls/choice-control';
import { ColorControl } from './controls/color-control';
import { DateTimeControl } from './controls/datetime-control';
import { GroupControl } from './controls/group-control';
import { ImageControl } from './controls/image-control';
import { LinkControl } from './controls/link-control';
import { ListControl } from './controls/list-control';
import { NumberControl } from './controls/number-control';
import { RichControl } from './controls/rich-control';
import { TextControl } from './controls/text-control';
import type { FieldActions, FieldContext } from './types';

/** Renders generated fields (docs/DECISIONS.md D-040); `value` is the object they belong to. */
export function FieldList({
  fields,
  value,
  path,
  actions,
  context,
}: {
  fields: FieldSpec[];
  value: Record<string, unknown> | undefined;
  path: PropPath;
  actions: FieldActions;
  context: FieldContext;
}) {
  return (
    <div className="grid gap-4">
      {fields
        .filter((spec) => isFieldShown(spec, value))
        .map((spec) => {
          const props = { value: value?.[spec.key], path: [...path, spec.key], actions, context };
          switch (spec.kind) {
            case 'text':
              return <TextControl key={spec.key} spec={spec} {...props} />;
            case 'rich':
              return <RichControl key={spec.key} spec={spec} {...props} />;
            case 'code':
              return <CodeControl key={spec.key} spec={spec} {...props} />;
            case 'datetime':
              return <DateTimeControl key={spec.key} spec={spec} {...props} />;
            case 'number':
              return <NumberControl key={spec.key} spec={spec} {...props} />;
            case 'boolean':
              return <BooleanControl key={spec.key} spec={spec} {...props} />;
            case 'choice':
              return <ChoiceControl key={spec.key} spec={spec} {...props} />;
            case 'color':
              return <ColorControl key={spec.key} spec={spec} {...props} />;
            case 'link':
              return (
                <fieldset key={spec.key} className="grid gap-2 rounded-md border p-3">
                  <legend className="px-1 text-xs font-semibold">{spec.label}</legend>
                  <LinkControl spec={spec} {...props} />
                </fieldset>
              );
            case 'image':
              return <ImageControl key={spec.key} spec={spec} {...props} />;
            case 'group':
              return <GroupControl key={spec.key} spec={spec} {...props} />;
            case 'list':
              return <ListControl key={spec.key} spec={spec} {...props} />;
          }
        })}
    </div>
  );
}
