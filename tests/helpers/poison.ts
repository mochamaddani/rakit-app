// Registry-wide XSS check helper: builds the most hostile version of a block's props, guided by the
// block's JSON Schema rather than only by its defaults. User-text fields (control: text|rich) get
// hostile markup, `url`/`src` strings get a javascript: URL, every link becomes a url link, optional
// objects are filled in and empty lists get one element, so fields a block's defaults leave out are
// still exercised. Enums, ids, numbers and booleans stay valid so rendering does not crash.
import { z } from 'zod';
import type { AnyBlockDefinition } from '@/lib/blocks/types';
import { sequentialIds, type IdFactory } from '@/lib/schema/ids';

export const HOSTILE_TEXT = '"><img src=x onerror=alert(1)><script>alert(1)</script>';
export const HOSTILE_URL = 'javascript:alert(1)';

interface JsonSchema {
  type?: string;
  control?: string;
  const?: unknown;
  enum?: unknown[];
  default?: unknown;
  minimum?: number;
  properties?: Record<string, JsonSchema>;
  items?: JsonSchema;
  anyOf?: JsonSchema[];
  oneOf?: JsonSchema[];
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/** For `kind` unions the url branch (the riskiest); for other unions, the first option. */
function pickBranch(schema: JsonSchema): JsonSchema {
  const options = schema.oneOf ?? schema.anyOf;
  if (!options || options.length === 0) return schema;
  return options.find((option) => option.properties?.kind?.const === 'url') ?? options[0]!;
}

function hostile(
  value: unknown,
  schema: JsonSchema | undefined,
  key: string,
  ids: IdFactory,
): unknown {
  if (!schema) return value;
  const node = pickBranch(schema);

  if (node.properties) {
    // A link of another kind ('default', 'section') is replaced by a hostile url link.
    const switchesKind =
      node.properties.kind?.const !== undefined &&
      isRecord(value) &&
      value.kind !== node.properties.kind.const;
    const current = isRecord(value) && !switchesKind ? value : {};
    return Object.fromEntries(
      Object.entries(node.properties).map(([name, child]) => [
        name,
        hostile(current[name], child, name, ids),
      ]),
    );
  }
  if (node.items) {
    const list = Array.isArray(value) && value.length > 0 ? value : [undefined];
    return list.map((item) => hostile(item, node.items, key, ids));
  }
  if (node.const !== undefined) return node.const;
  if (node.type === 'string') {
    if (key === 'url' || key === 'src') return HOSTILE_URL;
    if (node.control === 'text' || node.control === 'rich') return HOSTILE_TEXT;
    if (typeof value === 'string') return value;
    if (node.enum) return node.enum[0];
    return key === 'id' ? ids() : (node.default ?? 'x');
  }
  if (value !== undefined) return value;
  if (node.enum) return node.enum[0];
  if (node.type === 'number' || node.type === 'integer') return node.default ?? node.minimum ?? 1;
  if (node.type === 'boolean') return node.default ?? true;
  return node.default;
}

export function poisonProps(definition: AnyBlockDefinition): unknown {
  const schema = z.toJSONSchema(definition.schema, { io: 'input' }) as JsonSchema;
  return hostile(definition.defaultProps(sequentialIds()), schema, '', sequentialIds('x'));
}
