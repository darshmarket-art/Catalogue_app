import type { ProductField } from './merchant';
import { HttpError } from './http';

/** Checks the merchant-defined extra details of a product against the fields this merchant configured. */
export function parseExtras(fields: ProductField[], raw: unknown): Record<string, string | number> {
  const input = raw && typeof raw === 'object' && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};
  const out: Record<string, string | number> = {};

  for (const field of fields) {
    const value = input[field.key];
    const blank = value === undefined || value === null || String(value).trim() === '';
    if (blank) {
      if (field.required) throw new HttpError(400, `${field.label} is required.`);
      continue;
    }
    if (field.type === 'number') {
      const n = Number(value);
      if (!Number.isFinite(n) || n < 0 || n > 1e9) throw new HttpError(400, `${field.label} must be a number.`);
      out[field.key] = n;
    } else {
      const text = String(value).trim();
      if (text.length > 200) throw new HttpError(400, `${field.label} is too long.`);
      if (field.type === 'select' && !field.options?.includes(text)) throw new HttpError(400, `${field.label} must be one of the listed options.`);
      out[field.key] = text;
    }
  }
  return out;
}
