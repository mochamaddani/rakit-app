'use client';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { initialValueAt, seedValue, type ImageSpec } from '@/lib/editor/inspector/fields';
import { sanitizeUrl } from '@/lib/renderer/url';
import { createId } from '@/lib/schema/ids';
import { fieldId, type ControlProps } from '../types';
import { useFieldDraft } from '../use-field-draft';
import { FieldShell } from './field-shell';

interface ImageValue {
  src: string;
  alt: string;
}

/** Image by address and alt text. Uploads arrive in M2b. */
export function ImageControl({ spec, value, path, actions, context }: ControlProps<ImageSpec>) {
  const id = fieldId(context, path);
  const image = value as ImageValue | undefined;

  if (!image) {
    const add = () =>
      actions.set(
        path,
        context.definition
          ? initialValueAt(context.definition, path, spec.schema, createId)
          : seedValue(spec.schema, createId),
      );
    return (
      <div className="grid gap-1.5">
        <span className="text-xs font-medium">{spec.label}</span>
        <Button type="button" variant="outline" size="sm" onClick={add}>
          Add image
        </Button>
      </div>
    );
  }

  return (
    <fieldset className="grid gap-2 rounded-md border p-2">
      <legend className="px-1 text-xs font-medium">{spec.label}</legend>
      <ImageText
        id={`${id}-src`}
        label="Image address"
        value={image.src}
        onCommit={(v) => actions.set([...path, 'src'], v)}
        onBlur={actions.endEdit}
      />
      {sanitizeUrl(image.src, 'image') ? (
        // eslint-disable-next-line @next/next/no-img-element -- a preview of any address the user typed
        <img src={image.src} alt="" className="h-20 w-full rounded-md border object-contain" />
      ) : null}
      <ImageText
        id={`${id}-alt`}
        label="Alt text"
        value={image.alt}
        maxLength={300}
        onCommit={(v) => actions.set([...path, 'alt'], v)}
        onBlur={actions.endEdit}
        help={
          image.src && !image.alt
            ? 'Describe the image for screen readers, or leave empty if it is decorative.'
            : undefined
        }
      />
      {spec.optional ? (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => actions.set(path, undefined)}
        >
          Remove image
        </Button>
      ) : null}
    </fieldset>
  );
}

function ImageText({
  id,
  label,
  value,
  maxLength,
  help,
  onCommit,
  onBlur,
}: {
  id: string;
  label: string;
  value: string;
  maxLength?: number;
  help?: string;
  onCommit(value: string): void;
  onBlur(): void;
}) {
  const { draft, change, blur } = useFieldDraft(value, () => null);
  return (
    <FieldShell id={id} label={label} help={help}>
      <Input
        id={id}
        value={draft}
        maxLength={maxLength}
        onChange={(event) => change(event.target.value, onCommit)}
        onBlur={() => {
          blur();
          onBlur();
        }}
      />
    </FieldShell>
  );
}
