/** Conservative OpenAI strict transport subset. Domain validation remains authoritative. */
const allowed = new Set([
  'type',
  'properties',
  'required',
  'additionalProperties',
  'items',
  'anyOf',
  '$defs',
  '$ref',
  'enum',
  'description',
  'title',
  'pattern',
  'format',
  'minimum',
  'maximum',
  'exclusiveMinimum',
  'exclusiveMaximum',
  'multipleOf',
  'minItems',
  'maxItems',
]);
type Schema = Record<string, unknown>;
const object = (v: unknown): v is Schema => !!v && typeof v === 'object' && !Array.isArray(v);
const escape = (s: string) => s.replaceAll('~', '~0').replaceAll('/', '~1');

export function strictSchemaIssues(root: unknown): string[] {
  const issues: string[] = [];
  function walk(value: unknown, path: string) {
    if (!object(value)) {
      issues.push(`${path}: schema must be an object`);
      return;
    }
    for (const key of Object.keys(value))
      if (!allowed.has(key)) issues.push(`${path}/${escape(key)}: unsupported transport keyword`);
    if (
      value.type === 'object' ||
      (Array.isArray(value.type) && value.type.includes('object')) ||
      value.properties
    ) {
      if (value.additionalProperties !== false)
        issues.push(`${path}/additionalProperties: must be false`);
      const keys = Object.keys(object(value.properties) ? value.properties : {});
      const required = value.required;
      if (
        !Array.isArray(required) ||
        keys.some((k) => !required.includes(k)) ||
        required.length !== keys.length
      )
        issues.push(`${path}/required: must list every property (including [] for empty objects)`);
    }
    for (const key of ['properties', '$defs'])
      if (object(value[key]))
        for (const [name, child] of Object.entries(value[key]))
          walk(child, `${path}/${key}/${escape(name)}`);
    if (Array.isArray(value.items)) {
      issues.push(`${path}/items: tuple arrays are unsupported; use one items schema`);
      value.items.forEach((child, i) => walk(child, `${path}/items/${i}`));
    } else if (value.items !== undefined) walk(value.items, `${path}/items`);
    if (Array.isArray(value.anyOf)) value.anyOf.forEach((s, i) => walk(s, `${path}/anyOf/${i}`));
    if (value.$ref !== undefined) {
      const ref = value.$ref;
      let target: unknown = root;
      if (typeof ref !== 'string' || !(ref === '#' || ref.startsWith('#/'))) {
        issues.push(`${path}/$ref: only local references supported`);
        return;
      }
      for (const key of ref === '#'
        ? []
        : ref
            .slice(2)
            .split('/')
            .map((k) => k.replaceAll('~1', '/').replaceAll('~0', '~')))
        target = object(target) ? target[key] : undefined;
      if (!object(target)) issues.push(`${path}/$ref: unresolved reference`);
      // All definitions are walked above, including unused ones. Do not recurse through refs (cycles are valid).
    }
  }
  if (!object(root) || root.type !== 'object' || root.anyOf)
    issues.push('#: root must be an object without anyOf');
  walk(root, '#');
  return issues;
}

export function toStrictTransportSchema(value: unknown): Schema {
  if (!object(value)) throw new Error('Invalid transport schema');
  const result: Schema = {};
  for (const [key, item] of Object.entries(value)) {
    if (item === undefined) continue;
    // These remain enforced by Zod after decoding; do not send dialect metadata.
    if (['$schema', 'minLength', 'maxLength'].includes(key)) continue;
    if (key === 'const') {
      result.enum = [item];
      continue;
    }
    if (!allowed.has(key)) throw new Error(`Unsupported transport schema keyword: ${key}`);
    if (key === 'properties' || key === '$defs') {
      if (!object(item)) throw new Error('Invalid schema map');
      const keys = Object.keys(item);
      if (key === 'properties')
        keys.sort(
          (a, b) => Number(['name', 'field'].includes(b)) - Number(['name', 'field'].includes(a)),
        );
      result[key] = Object.fromEntries(
        keys.map((name) => [name, toStrictTransportSchema(item[name])]),
      );
    } else if (key === 'items') {
      if (Array.isArray(item)) {
        const items = item.map(toStrictTransportSchema);
        if (!items.length || items.some((s) => JSON.stringify(s) !== JSON.stringify(items[0])))
          throw new Error('Heterogeneous tuple needs an explicit transport schema');
        result.items = items[0];
      } else result.items = toStrictTransportSchema(item);
    } else if (key === 'anyOf' && Array.isArray(item))
      result.anyOf = item.map(toStrictTransportSchema);
    else result[key] = item;
  }
  if (
    value.type === 'object' ||
    (Array.isArray(value.type) && value.type.includes('object')) ||
    value.properties
  ) {
    const properties = (result.properties ?? {}) as Record<string, Schema>;
    for (const key of Object.keys(properties)) {
      // An absent optional field travels as required/null, then is normalized at the adapter boundary.
      if (!Array.isArray(value.required) || !value.required.includes(key))
        properties[key] = { anyOf: [properties[key], { type: 'null' }] };
    }
    result.properties = properties;
    result.required = Object.keys(properties);
    result.additionalProperties = false;
  }
  return result;
}
