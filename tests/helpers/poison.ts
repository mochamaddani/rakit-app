// Registry-wide XSS check helper: fills a block's default props with hostile input, guided by the
// block's JSON Schema so only user-text fields (control: text|rich) and URLs (url/src) change.
// Enums, ids, numbers and booleans keep their valid values.
import { z } from 'zod';
import type { AnyBlockDefinition } from '@/lib/blocks/types';
import { sequentialIds } from '@/lib/schema/ids';

export const HOSTILE_TEXT = '"><img src=x onerror=alert(1)><script>alert(1)</script>';
export const HOSTILE_URL = 'javascript:alert(1)';

interface JsonSchema {
  type?: string;
  control?: string;
  const?: unknown;
  properties?: Record<string, JsonSchema>;
  items?: JsonSchema;
  anyOf?: JsonSchema[];
  oneOf?: JsonSchema[];
}

/** For unions, the branch matching the value's `kind`; otherwise the schema itself. */
function resolve(schema: JsonSchema, value: unknown): JsonSchema {
  const branches = schema.oneOf ?? schema.anyOf;
  if (!branches || typeof value !== 'object' || value === null || !('kind' in value)) return schema;
  return branches.find((b) => b.properties?.kind?.const === value.kind) ?? schema;
}

function poison(value: unknown, schema: JsonSchema | undefined, key: string): unknown {
  if (!schema) return value;
  const resolved = resolve(schema, value);
  if (typeof value === 'string') {
    if (key === 'url' || key === 'src') return HOSTILE_URL;
    return resolved.control === 'text' || resolved.control === 'rich' ? HOSTILE_TEXT : value;
  }
  if (Array.isArray(value)) return value.map((item) => poison(item, resolved.items, key));
  if (typeof value === 'object' && value !== null) {
    return Object.fromEntries(
      Object.entries(value).map(([k, v]) => [k, poison(v, resolved.properties?.[k], k)]),
    );
  }
  return value;
}

export function poisonProps(definition: AnyBlockDefinition): unknown {
  const schema = z.toJSONSchema(definition.schema, { io: 'input' }) as JsonSchema;
  return poison(definition.defaultProps(sequentialIds()), schema, '');
}
