import { z } from 'zod';
import { getAtPath, type PropPath } from './structure';

/** Strips optional, default, prefault and nullable wrappers. */
export function unwrapSchema(schema: z.ZodType): z.ZodType {
  let current = schema;
  while (
    current instanceof z.ZodOptional ||
    current instanceof z.ZodDefault ||
    current instanceof z.ZodPrefault ||
    current instanceof z.ZodNullable
  ) {
    current = current.unwrap() as z.ZodType;
  }
  return current;
}

const literalOf = (schema: unknown) => (schema instanceof z.ZodLiteral ? schema.value : undefined);

/**
 * The schema declared for the field at `path` (wrappers included), or null when the path leaves
 * the schema. A union discriminated by `kind` resolves to the option matching the current value.
 */
export function schemaAt(root: z.ZodType, path: PropPath, current: unknown): z.ZodType | null {
  let declared = root;
  for (let i = 0; i < path.length; i += 1) {
    let node = unwrapSchema(declared);
    const key = path[i];
    if (node instanceof z.ZodDiscriminatedUnion) {
      const kind = (getAtPath(current, path.slice(0, i)) as { kind?: unknown } | undefined)?.kind;
      const option = (node.options as readonly unknown[]).find(
        (o): o is z.ZodObject => o instanceof z.ZodObject && literalOf(o.shape.kind) === kind,
      );
      if (!option) return null;
      node = option;
    }
    if (node instanceof z.ZodObject && typeof key === 'string') {
      if (!Object.hasOwn(node.shape, key)) return null;
      declared = node.shape[key] as z.ZodType;
    } else if (node instanceof z.ZodArray && typeof key === 'number') {
      declared = node.element as z.ZodType;
    } else {
      return null;
    }
  }
  return declared;
}
