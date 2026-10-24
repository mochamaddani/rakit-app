import { z } from 'zod';
import type { AnyBlockDefinition } from '@/lib/blocks/types';
import { toPlainText } from '@/lib/renderer/inline';
import type { IdFactory } from '@/lib/schema/ids';
import { getAtPath, withFreshIds, type PropPath } from '../structure';
import { fieldLabel, optionLabel } from './labels';

// The inspector is generated from each block's Zod schema (docs/DECISIONS.md D-040). The walker
// knows a fixed set of constructs and throws on anything else, so a registry-wide test catches a
// block whose inspector would be incomplete.

interface BaseSpec {
  key: string;
  label: string;
  optional: boolean;
  /** The field's schema without optional/default/prefault wrappers. */
  schema: z.ZodType;
}
export interface TextSpec extends BaseSpec {
  kind: 'text';
  min: number;
  max: number;
  multiline: boolean;
}
export interface RichSpec extends BaseSpec {
  kind: 'rich';
  min: number;
  max: number;
}
/** Raw code (monospace textarea); never edited in the canvas. */
export interface CodeSpec extends BaseSpec {
  kind: 'code';
  max: number;
}
export interface NumberSpec extends BaseSpec {
  kind: 'number';
  min: number | null;
  max: number | null;
  int: boolean;
}
export interface BooleanSpec extends BaseSpec {
  kind: 'boolean';
}
export interface ChoiceSpec extends BaseSpec {
  kind: 'choice';
  options: { value: string | number; label: string }[];
}
export interface ColorSpec extends BaseSpec {
  kind: 'color';
}
export interface LinkSpec extends BaseSpec {
  kind: 'link';
  kinds: ('url' | 'section' | 'default')[];
}
export interface ImageSpec extends BaseSpec {
  kind: 'image';
}
export interface GroupSpec extends BaseSpec {
  kind: 'group';
  fields: FieldSpec[];
}
export interface ListSpec extends BaseSpec {
  kind: 'list';
  item: GroupSpec;
  max: number;
}
export type FieldSpec =
  | TextSpec
  | RichSpec
  | CodeSpec
  | NumberSpec
  | BooleanSpec
  | ChoiceSpec
  | ColorSpec
  | LinkSpec
  | ImageSpec
  | GroupSpec
  | ListSpec;

const LINK_KINDS = new Set(['url', 'section', 'default']);
const MULTILINE_AFTER = 160;

const controlOf = (schema: z.ZodType) =>
  (schema.meta() as { control?: unknown } | undefined)?.control;

/** Strips wrappers, noting whether the value may be absent (only `.optional()` allows that). */
function unwrap(schema: z.ZodType): { inner: z.ZodType; optional: boolean } {
  let inner = schema;
  let optional = false;
  for (;;) {
    if (inner instanceof z.ZodOptional) {
      optional = true;
      inner = inner.unwrap() as z.ZodType;
    } else if (inner instanceof z.ZodDefault || inner instanceof z.ZodPrefault) {
      inner = inner.unwrap() as z.ZodType;
    } else {
      return { inner, optional };
    }
  }
}

/** Every literal or enum value of a union of literals/enums, or null when it is something else. */
function choiceValues(schema: z.ZodType): (string | number)[] | null {
  if (schema instanceof z.ZodEnum) return schema.options as (string | number)[];
  if (schema instanceof z.ZodLiteral) return [...schema.values] as (string | number)[];
  if (schema instanceof z.ZodUnion && !(schema instanceof z.ZodDiscriminatedUnion)) {
    const values: (string | number)[] = [];
    for (const option of schema.options as z.ZodType[]) {
      const nested = choiceValues(option);
      if (!nested) return null;
      values.push(...nested);
    }
    return values;
  }
  return null;
}

function linkKinds(schema: z.ZodType): LinkSpec['kinds'] | null {
  if (!(schema instanceof z.ZodDiscriminatedUnion) || schema.def.discriminator !== 'kind')
    return null;
  const kinds: LinkSpec['kinds'] = [];
  for (const option of schema.options as z.ZodType[]) {
    const kind =
      option instanceof z.ZodObject && option.shape.kind instanceof z.ZodLiteral
        ? option.shape.kind.value
        : undefined;
    if (typeof kind !== 'string' || !LINK_KINDS.has(kind)) return null;
    kinds.push(kind as LinkSpec['kinds'][number]);
  }
  return kinds;
}

function describeField(key: string, declared: z.ZodType): FieldSpec {
  const { inner: schema, optional } = unwrap(declared);
  const base = { key, label: fieldLabel(key), optional, schema };

  if (schema instanceof z.ZodString) {
    const control = controlOf(schema);
    const min = schema.minLength ?? 0;
    const max = schema.maxLength ?? Number.POSITIVE_INFINITY;
    if (control === 'rich') return { ...base, kind: 'rich', min, max };
    if (control === 'code') return { ...base, kind: 'code', max };
    if (control === 'color') return { ...base, kind: 'color' };
    return {
      ...base,
      kind: 'text',
      min,
      max,
      multiline: max !== Infinity && max > MULTILINE_AFTER,
    };
  }
  if (schema instanceof z.ZodNumber) {
    return {
      ...base,
      kind: 'number',
      min: Number.isFinite(schema.minValue) ? schema.minValue : null,
      max: Number.isFinite(schema.maxValue) ? schema.maxValue : null,
      int: schema.isInt,
    };
  }
  if (schema instanceof z.ZodBoolean) return { ...base, kind: 'boolean' };
  const kinds = linkKinds(schema);
  if (kinds) return { ...base, kind: 'link', kinds };
  const values = choiceValues(schema);
  if (values) {
    return {
      ...base,
      kind: 'choice',
      options: values.map((value) => ({ value, label: optionLabel(key, value) })),
    };
  }
  if (schema instanceof z.ZodObject) {
    if (controlOf(schema) === 'image') return { ...base, kind: 'image' };
    return { ...base, kind: 'group', fields: describeFields(schema) };
  }
  if (schema instanceof z.ZodArray && schema.element instanceof z.ZodObject) {
    const element = schema.element as z.ZodObject;
    const maxItems = (z.toJSONSchema(schema) as { maxItems?: number }).maxItems;
    return {
      ...base,
      kind: 'list',
      max: maxItems ?? Number.POSITIVE_INFINITY,
      item: {
        key,
        label: fieldLabel(key),
        optional: false,
        schema: element,
        kind: 'group',
        fields: describeFields(element),
      },
    };
  }
  throw new Error(`The inspector cannot edit field "${key}" (${schema.type})`);
}

const described = new WeakMap<z.ZodType, FieldSpec[]>();

/** Fields of an object schema, in shape order, without `id` keys. Cached per schema. */
export function describeFields(schema: z.ZodType): FieldSpec[] {
  const cached = described.get(schema);
  if (cached) return cached;
  const { inner } = unwrap(schema);
  if (!(inner instanceof z.ZodObject)) throw new Error('describeFields needs an object schema');
  const fields = Object.entries(inner.shape as Record<string, z.ZodType>)
    .filter(([key]) => key !== 'id')
    .map(([key, field]) => describeField(key, field));
  described.set(schema, fields);
  return fields;
}

/**
 * A minimal valid value: required text becomes `[REPLACE: <label>]` (never invented content),
 * `id` keys get newId(), numbers their minimum, choices their first option, and links point at
 * the page's default target when they can.
 */
export function seedValue(schema: z.ZodType, newId: IdFactory, key = ''): unknown {
  if (schema instanceof z.ZodOptional) return seedValue(schema.unwrap() as z.ZodType, newId, key);
  if (schema instanceof z.ZodDefault || schema instanceof z.ZodPrefault)
    return schema.parse(undefined);
  if (schema instanceof z.ZodObject) {
    const value: Record<string, unknown> = {};
    for (const [name, field] of Object.entries(schema.shape as Record<string, z.ZodType>)) {
      if (field instanceof z.ZodOptional) continue;
      value[name] = name === 'id' ? newId() : seedValue(field, newId, name);
    }
    return schema.parse(value);
  }
  if (schema instanceof z.ZodString) {
    return (schema.minLength ?? 0) > 0 ? `[REPLACE: ${fieldLabel(key)}]` : '';
  }
  if (schema instanceof z.ZodNumber) {
    return Number.isFinite(schema.minValue) ? schema.minValue : 0;
  }
  if (schema instanceof z.ZodBoolean) return false;
  if (schema instanceof z.ZodArray) return [];
  const kinds = linkKinds(schema);
  if (kinds)
    return kinds.includes('default')
      ? { kind: 'default' }
      : seedValue((schema as z.ZodDiscriminatedUnion).options[0] as z.ZodType, newId, key);
  const values = choiceValues(schema);
  if (values?.length) return values[0];
  throw new Error(`Cannot seed a value for "${key}" (${schema.type})`);
}

/**
 * A new list item (path ends in an index) or a newly enabled optional group.
 * Uses the block's own sample from defaultProps, with fresh ids, else seedValue.
 * For a list item the sample is the first item of that list in defaultProps; for a group, the
 * value at the same path.
 */
export function initialValueAt(
  definition: AnyBlockDefinition,
  path: PropPath,
  schema: z.ZodType,
  newId: IdFactory,
): unknown {
  const last = path.at(-1);
  const samplePath = typeof last === 'number' ? [...path.slice(0, -1), 0] : path;
  const sample = getAtPath(definition.defaultProps(newId), samplePath);
  if (sample !== undefined) return withFreshIds(sample, newId);
  return seedValue(schema, newId, typeof last === 'string' ? last : '');
}

/** The first non-empty text or rich field of the item (markup stripped), else `Item <n>`. */
export function listItemSummary(item: unknown, spec: ListSpec, index: number): string {
  if (typeof item === 'object' && item !== null) {
    for (const field of spec.item.fields) {
      if (field.kind !== 'text' && field.kind !== 'rich') continue;
      const value = (item as Record<string, unknown>)[field.key];
      if (typeof value !== 'string' || !value.trim()) continue;
      return toPlainText(value).trim();
    }
  }
  return `Item ${index + 1}`;
}

/** The first problem with `value` for this field, in plain words; null when it is valid. */
export function fieldError(spec: FieldSpec, value: unknown): string | null {
  if (value === undefined && spec.optional) return null;
  const result = z.safeParse(spec.schema, value);
  if (result.success) return null;
  const issue = result.error.issues[0]!;
  if (issue.code === 'too_small' && issue.origin === 'string') {
    return Number(issue.minimum) <= 1 ? 'Required' : `At least ${issue.minimum} characters`;
  }
  if (issue.code === 'too_big' && issue.origin === 'string') {
    return `At most ${issue.maximum} characters`;
  }
  if (issue.code === 'too_small' && issue.origin === 'number') return `Minimum ${issue.minimum}`;
  if (issue.code === 'too_big' && issue.origin === 'number') return `Maximum ${issue.maximum}`;
  if (spec.kind === 'color') return 'Use a color like #2563EB';
  return issue.message;
}

const PATH_SEGMENT = /^(?:[A-Za-z][A-Za-z0-9]*|\d{1,3})$/;

/** 'items.2.title' → ['items', 2, 'title']; null unless ≤ 6 segments of [A-Za-z][A-Za-z0-9]* or ≤ 3 digits. */
export function parseFieldPath(path: string): PropPath | null {
  const segments = path.split('.');
  if (segments.length > 6 || !segments.every((segment) => PATH_SEGMENT.test(segment))) return null;
  return segments.map((segment) => (/^\d/.test(segment) ? Number(segment) : segment));
}

/** The field at a prop path, walking groups and list items; null if there is none. */
export function fieldSpecAt(fields: readonly FieldSpec[], path: PropPath): FieldSpec | null {
  const [head, ...rest] = path;
  if (typeof head !== 'string') return null;
  const spec = fields.find((field) => field.key === head);
  if (!spec || rest.length === 0) return spec ?? null;
  if (spec.kind === 'group') return fieldSpecAt(spec.fields, rest);
  if (spec.kind !== 'list') return null;
  const [index, ...after] = rest;
  if (typeof index !== 'number') return null;
  return after.length === 0 ? spec.item : fieldSpecAt(spec.item.fields, after);
}
