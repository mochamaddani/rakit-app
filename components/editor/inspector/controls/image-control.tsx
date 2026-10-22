'use client';

import { useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { uploadImage, type UploadResult } from '@/lib/assets/client';
import { UPLOAD_BUCKET, UPLOAD_TYPES } from '@/lib/assets/limits';
import { initialValueAt, seedValue, type ImageSpec } from '@/lib/editor/inspector/fields';
import { sanitizeUrl } from '@/lib/renderer/url';
import { createId } from '@/lib/schema/ids';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import { useWorkspaceId } from '../../editor-context';
import { fieldId, type ControlProps } from '../types';
import { useFieldDraft } from '../use-field-draft';
import { FieldShell } from './field-shell';

interface ImageValue {
  src: string;
  alt: string;
}

type UploadedImage = Extract<UploadResult, { ok: true }>['image'];

/** Image by upload or address, with alt text. */
export function ImageControl({ spec, value, path, actions, context }: ControlProps<ImageSpec>) {
  const id = fieldId(context, path);
  const image = value as ImageValue | undefined;
  // One command for the whole image, its own undo step; the alt text stays.
  const applyUpload = (uploaded: UploadedImage) => {
    actions.endEdit();
    actions.set(path, { ...(image ?? { alt: '' }), ...uploaded });
    actions.endEdit();
  };

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
        <div className="flex gap-2">
          <Button type="button" variant="outline" size="sm" onClick={add}>
            Add image
          </Button>
          <UploadButton onUploaded={applyUpload} />
        </div>
      </div>
    );
  }

  return (
    <fieldset className="grid gap-2 rounded-md border p-2">
      <legend className="px-1 text-xs font-medium">{spec.label}</legend>
      <UploadButton onUploaded={applyUpload} />
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

const ACCEPT = Object.keys(UPLOAD_TYPES).join(',');

/** Uploads a file to the workspace's folder and hands back the processed WebP (D-045). */
function UploadButton({ onUploaded }: { onUploaded(image: UploadedImage): void }) {
  const workspaceId = useWorkspaceId();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const upload = async (file: File | undefined) => {
    if (!file) return;
    setBusy(true);
    setError(null);
    const supabase = createSupabaseBrowserClient();
    const result = await uploadImage(file, {
      workspaceId,
      upload: async (path, blob, contentType) => {
        const { error: failed } = await supabase.storage
          .from(UPLOAD_BUCKET)
          .upload(path, blob, { contentType, upsert: false });
        return { ok: !failed };
      },
      fetch: (url, init) => fetch(url, init),
      newId: () => crypto.randomUUID(),
    });
    setBusy(false);
    if (result.ok) onUploaded(result.image);
    else setError(result.message);
  };

  return (
    <div className="grid gap-1">
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={busy}
        onClick={() => input.current?.click()}
      >
        Upload image
      </Button>
      <input
        ref={input}
        type="file"
        accept={ACCEPT}
        hidden
        onChange={(event) => {
          void upload(event.target.files?.[0]);
          event.target.value = '';
        }}
      />
      {busy ? (
        <p role="status" className="text-xs text-muted-foreground">
          Uploading…
        </p>
      ) : null}
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </div>
  );
}
