import { format, parseISO } from 'date-fns';
import type { DateFormat } from '../../enums/dateFormat';

export const splitAddress = (
  addr?: string
): {
  street?: string;
  city?: string;
  postalZone?: string;
  countryCode?: string;
} => {
  // Best-effort parse: expect lines like "Street, City, Region Postal, COUNTRY"
  // We keep it simple: first comma -> street; last token with 2-3 uppercase -> country code if matches.
  if (!addr) return {};
  const parts = addr
    .split(',')
    .map(s => s.trim())
    .filter(Boolean);
  const out: {
    street?: string;
    city?: string;
    postalZone?: string;
    countryCode?: string;
  } = {};
  if (parts.length > 0) out.street = parts[0];
  if (parts.length > 1) out.city = parts[1];
  if (parts.length > 2) {
    // Try to find a postal code in the remainder (any 3-10 alnum token)
    const rest = parts.slice(2).join(' ');
    const m = rest.match(/([A-Z0-9\- ]{3,10})$/i);
    if (m) out.postalZone = m[1].trim();
  }
  // Country code heuristic: last 2 letters token
  const last = parts[parts.length - 1] || '';
  const cc = last.trim().toUpperCase();
  if (/^[A-Z]{2,3}$/.test(cc)) {
    out.countryCode = cc.length === 3 ? cc.slice(0, 2) : cc;
  }
  return out;
};

type Maybe<T> = T | undefined | null;

export const xmlEscape = (v: Maybe<string | number | boolean>): string => {
  if (v === undefined || v === null) return '';
  const s = String(v);
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\\"/g, '&quot;')
    .replace(/'/g, '&apos;');
};

export const formatDate = (date: string | Date, pattern: DateFormat) => {
  if (!date) return '';

  const d = typeof date === 'string' ? parseISO(date) : date;

  if (isNaN(d.getTime())) return '';

  return format(d, pattern);
};

// Lightweight XML formatter to produce consistent indentation
export const formatXml = (xml: string): string => {
  xml = xml.trim();
  xml = xml.replace(/>\s*</g, '>\n<');
  const lines = xml.split('\n');
  let indent = 0;
  const formatted = lines
    .map(line => line.trim())
    .filter(Boolean)
    .map(line => {
      const closingTag = /^<\/[^>]+>/;
      const openingTag = /^<[^\\/?][^>]*>$/;
      const selfClosing = /<[^>]+\/>$/;
      const declaration = /^<\?/;
      if (closingTag.test(line)) {
        indent = Math.max(indent - 1, 0);
      }
      const pad = '  '.repeat(indent);
      const out = pad + line;
      if (openingTag.test(line) && !selfClosing.test(line) && !declaration.test(line)) {
        indent++;
      }
      return out;
    })
    .join('\n');

  return formatted;
};
