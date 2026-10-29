'use client';

import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import type { LinkSpec } from '@/lib/editor/inspector/fields';
import { blockTypeLabel } from '@/lib/editor/structure';
import { readUtm, UTM_KEYS, writeUtm, type UtmKey } from '@/lib/editor/utm';
import { sanitizeUrl } from '@/lib/renderer/url';
import { normalizeWhatsAppNumber, whatsAppUrl } from '@/lib/renderer/whatsapp';
import { fieldId, type ControlProps } from '../types';
import { useFieldDraft } from '../use-field-draft';
import { selectClass } from './choice-control';
import { FieldShell } from './field-shell';

const KIND_LABELS: Record<LinkSpec['kinds'][number], string> = {
  url: 'Web address',
  section: 'Section on this page',
  default: 'Page default button target',
  whatsapp: 'WhatsApp chat',
};
const UTM_LABELS: Record<UtmKey, string> = {
  utm_source: 'Source',
  utm_medium: 'Medium',
  utm_campaign: 'Campaign',
  utm_content: 'Content',
  utm_term: 'Term',
};
const MAX_URL = 2048;
const MAX_MESSAGE = 500;

type LinkValue =
  | { kind: 'url'; url: string; newTab: boolean }
  | { kind: 'section'; sectionId: string }
  | { kind: 'default' }
  | { kind: 'whatsapp'; phone: string; message: string };

export function LinkControl({ spec, value, path, actions, context }: ControlProps<LinkSpec>) {
  const id = fieldId(context, path);
  const link = (value ?? undefined) as LinkValue | undefined;
  const { sections } = context.doc;
  // A deleted section leaves its links dangling; the page renders them as href="#".
  const missingSection =
    link?.kind === 'section' && !sections.some((section) => section.id === link.sectionId);

  const setKind = (kind: string) => {
    if (kind === '') actions.set(path, undefined);
    else if (kind === 'url') actions.set(path, { kind: 'url', url: '', newTab: false });
    else if (kind === 'section' && sections[0])
      actions.set(path, { kind: 'section', sectionId: sections[0].id });
    else if (kind === 'default') actions.set(path, { kind: 'default' });
    else if (kind === 'whatsapp') actions.set(path, { kind: 'whatsapp', phone: '', message: '' });
  };

  return (
    <div className="grid gap-2">
      <FieldShell id={`${id}-kind`} label="Link type">
        <select
          id={`${id}-kind`}
          className={selectClass}
          value={link?.kind ?? ''}
          onChange={(event) => setKind(event.target.value)}
        >
          {spec.optional ? <option value="">None</option> : null}
          {spec.kinds.map((kind) => (
            <option key={kind} value={kind} disabled={kind === 'section' && sections.length === 0}>
              {KIND_LABELS[kind]}
            </option>
          ))}
        </select>
      </FieldShell>
      {link?.kind === 'url' ? (
        <UrlFields id={id} url={link.url} newTab={link.newTab} path={path} actions={actions} />
      ) : null}
      {link?.kind === 'whatsapp' ? (
        <WhatsAppFields
          id={id}
          phone={link.phone}
          message={link.message}
          path={path}
          actions={actions}
        />
      ) : null}
      {link?.kind === 'section' ? (
        <FieldShell
          id={`${id}-section`}
          label="Section"
          error={missingSection ? 'This section no longer exists. Choose another.' : null}
        >
          <select
            id={`${id}-section`}
            className={selectClass}
            value={link.sectionId}
            aria-invalid={missingSection ? true : undefined}
            aria-describedby={missingSection ? `${id}-section-error` : undefined}
            onChange={(event) => actions.set([...path, 'sectionId'], event.target.value)}
          >
            {/* Without this option the select would show the first section, not the dead link. */}
            {missingSection ? (
              <option value={link.sectionId} disabled>
                Missing section
              </option>
            ) : null}
            {sections.map((section, index) => {
              const first = section.blocks[0];
              return (
                <option key={section.id} value={section.id}>
                  {`Section ${index + 1} · ${first ? blockTypeLabel(first.type) : 'Empty'}${
                    section.anchor ? ` (#${section.anchor})` : ''
                  }`}
                </option>
              );
            })}
          </select>
        </FieldShell>
      ) : null}
    </div>
  );
}

function UrlFields({
  id,
  url,
  newTab,
  path,
  actions,
}: {
  id: string;
  url: string;
  newTab: boolean;
  path: ControlProps['path'];
  actions: ControlProps['actions'];
}) {
  const { draft, error, change, blur } = useFieldDraft(url, (v) =>
    v.length > MAX_URL ? `At most ${MAX_URL} characters` : null,
  );
  const commitUrl = (v: string) => actions.set([...path, 'url'], v);
  const utm = readUtm(url);
  const disabled = draft.trim() !== '' && sanitizeUrl(draft, 'link') === null;

  return (
    <>
      <FieldShell
        id={`${id}-url`}
        label="Address"
        error={error}
        help={
          disabled
            ? 'This link will be disabled. Use https://, mailto:, tel: or #anchor.'
            : undefined
        }
      >
        <Input
          id={`${id}-url`}
          inputMode="url"
          placeholder="https://"
          value={draft}
          onChange={(event) => change(event.target.value, commitUrl)}
          onBlur={() => {
            blur();
            actions.endEdit();
          }}
        />
      </FieldShell>
      <div className="flex items-center gap-2">
        <input
          id={`${id}-newtab`}
          type="checkbox"
          checked={newTab}
          onChange={(event) => actions.set([...path, 'newTab'], event.target.checked)}
          className="size-4 accent-sky-600"
        />
        <label htmlFor={`${id}-newtab`} className="text-xs font-medium">
          Open in a new tab
        </label>
      </div>
      <details className="rounded-md border px-2 py-1.5">
        <summary className="cursor-pointer text-xs font-medium">UTM parameters</summary>
        <div className="mt-2 grid gap-2">
          {!utm ? (
            <p className="text-xs text-muted-foreground">Available for http(s) addresses.</p>
          ) : null}
          {UTM_KEYS.map((key) => (
            <UtmField
              key={key}
              id={`${id}-${key}`}
              label={UTM_LABELS[key]}
              disabled={!utm}
              value={utm?.[key] ?? ''}
              onChange={(value) => commitUrl(writeUtm(url, { [key]: value }))}
              onBlur={() => actions.endEdit()}
            />
          ))}
        </div>
      </details>
    </>
  );
}

/**
 * A WhatsApp number, corrected as it is typed: digits only, and a leading 0 becomes 62 (D-057).
 * The help line shows the address the button opens.
 */
function WhatsAppFields({
  id,
  phone,
  message,
  path,
  actions,
}: {
  id: string;
  phone: string;
  message: string;
  path: ControlProps['path'];
  actions: ControlProps['actions'];
}) {
  const number = useFieldDraft(phone, () => null);
  const text = useFieldDraft(message, (v) =>
    v.length > MAX_MESSAGE ? `At most ${MAX_MESSAGE} characters` : null,
  );
  const url = whatsAppUrl(number.draft);

  return (
    <>
      <FieldShell
        id={`${id}-phone`}
        label="WhatsApp number"
        help={
          url
            ? `Opens ${url}`
            : 'Type the number; 0812… becomes 62812…. Other countries: start with their code.'
        }
      >
        <Input
          id={`${id}-phone`}
          type="tel"
          inputMode="tel"
          autoComplete="off"
          placeholder="6281234567890"
          value={number.draft}
          onChange={(event) =>
            number.change(normalizeWhatsAppNumber(event.target.value), (v) =>
              actions.set([...path, 'phone'], v),
            )
          }
          onBlur={() => actions.endEdit()}
        />
      </FieldShell>
      <FieldShell id={`${id}-message`} label="Message (optional)" error={text.error}>
        <Textarea
          id={`${id}-message`}
          rows={2}
          placeholder="Halo kak, saya mau pesan…"
          value={text.draft}
          onChange={(event) =>
            text.change(event.target.value, (v) => actions.set([...path, 'message'], v))
          }
          onBlur={() => {
            text.blur();
            actions.endEdit();
          }}
        />
      </FieldShell>
    </>
  );
}

/**
 * One UTM value: typed as is (spaces included), trimmed when the field loses focus (M2a review M2).
 * Like every field it follows undo and redo, so an undone value is not written back on blur.
 */
function UtmField({
  id,
  label,
  value,
  disabled,
  onChange,
  onBlur,
}: {
  id: string;
  label: string;
  value: string;
  disabled: boolean;
  onChange(value: string): void;
  onBlur(): void;
}) {
  const { draft, change } = useFieldDraft(value, () => null);
  return (
    <FieldShell id={id} label={label}>
      <Input
        id={id}
        disabled={disabled}
        value={draft}
        onChange={(event) => change(event.target.value, onChange)}
        onBlur={() => {
          const trimmed = draft.trim();
          if (trimmed !== draft) change(trimmed, onChange);
          onBlur();
        }}
      />
    </FieldShell>
  );
}
