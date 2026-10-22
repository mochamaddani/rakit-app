'use client';

import { useMemo } from 'react';
import type { CommandResult } from '@/lib/editor/commands';
import { describeFields, type FieldSpec } from '@/lib/editor/inspector/fields';
import { fieldLabel } from '@/lib/editor/inspector/labels';
import { AA_TEXT_RATIO, THEME_CONTRAST_PAIRS, contrastRatio } from '@/lib/schema/contrast';
import { PRICE_FORMATS, PageSettingsSchema } from '@/lib/schema/settings';
import type { Theme } from '@/lib/schema/theme';
import { useEditor } from '../editor-context';
import { selectClass } from './controls/choice-control';
import { FieldShell } from './controls/field-shell';
import { FieldList } from './field-list';
import type { FieldActions, FieldContext } from './types';

const notAList = (): CommandResult => ({ ok: false, code: 'invalid', reason: 'Not a list' });
const pick = (key: string): FieldSpec[] =>
  describeFields(PageSettingsSchema).filter((field) => field.key === key);
const CURRENCIES = Object.keys(PRICE_FORMATS) as (keyof typeof PRICE_FORMATS)[];

/** Under each background color: how readable each text color on it is (hint only; M5 validates). */
function ContrastHints({ background, colors }: { background: string; colors: Theme['colors'] }) {
  const pairs = THEME_CONTRAST_PAIRS.filter(([, bg]) => bg === background);
  if (pairs.length === 0) return null;
  return (
    <div className="grid gap-0.5">
      {pairs.map(([fg, bg]) => {
        const ratio = contrastRatio(colors[fg], colors[bg]);
        const ok = ratio >= AA_TEXT_RATIO;
        return (
          <p
            key={fg}
            data-testid={`contrast-${fg}-${bg}`}
            className={ok ? 'text-xs text-muted-foreground' : 'text-xs text-destructive'}
          >
            {fieldLabel(fg)}: {ratio.toFixed(1)}:1 · {ok ? 'AA' : 'too low for text'}
          </p>
        );
      })}
    </div>
  );
}

export function PagePanel() {
  const doc = useEditor((s) => s.doc);
  const dispatch = useEditor((s) => s.dispatch);
  const endCoalescing = useEditor((s) => s.endCoalescing);
  const { settings } = doc;

  const actions = useMemo<FieldActions>(
    () => ({
      set: (path, value) =>
        dispatch(
          { type: 'setSetting', path, value },
          { coalesceKey: `settings:${path.join('.')}` },
        ),
      endEdit: endCoalescing,
      listInsert: notAList,
      listMove: notAList,
      listRemove: notAList,
      listDuplicate: notAList,
    }),
    [dispatch, endCoalescing],
  );
  const context: FieldContext = {
    doc,
    definition: null,
    idPrefix: 'page',
    renderExtra: (spec, path) =>
      spec.kind === 'color' && path.includes('colors') ? (
        <ContrastHints background={spec.key} colors={settings.theme.colors} />
      ) : null,
  };
  const value = settings as unknown as Record<string, unknown>;

  return (
    <div className="grid gap-4 p-4">
      <h2 className="text-sm font-semibold">Page settings</h2>
      <FieldList
        fields={[...pick('lang'), ...pick('seo'), ...pick('defaultCta')]}
        value={value}
        path={[]}
        actions={actions}
        context={context}
      />
      <FieldShell id="page-currency" label="Currency">
        <select
          id="page-currency"
          className={selectClass}
          value={settings.price.currency}
          onChange={(event) => {
            const code = event.target.value as keyof typeof PRICE_FORMATS;
            if (PRICE_FORMATS[code]) actions.set(['price'], PRICE_FORMATS[code]);
          }}
        >
          {CURRENCIES.map((code) => (
            <option key={code} value={code}>
              {code} · {PRICE_FORMATS[code].prefix || PRICE_FORMATS[code].suffix}
            </option>
          ))}
        </select>
      </FieldShell>
      <FieldList
        fields={pick('theme')}
        value={value}
        path={[]}
        actions={actions}
        context={context}
      />
    </div>
  );
}
