import type { ResourceSchema } from './types';
export function writablePayload(schema: ResourceSchema, values: Record<string,any>): Record<string,any> {
  const payload: Record<string,any> = {};
  for (const field of schema.fields) {
    if (field.readonly || !(field.key in values)) continue;
    let value = values[field.key];
    if ((field.type === 'date' || field.key.endsWith('_id')) && value === '') value = null;
    payload[field.key] = value;
  }
  return payload;
}
