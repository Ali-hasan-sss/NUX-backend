const EASTERN_ARABIC = '٠١٢٣٤٥٦٧٨٩';
const PERSIAN = '۰۱۲۳۴۵۶۷۸۹';

/** Eastern Arabic / Persian → ASCII 0-9 for PIN validation (JS `\d` is ASCII-only). */
export function normalizePaymentPinDigits(raw: string): string {
  const s = raw.replace(/\s/g, '').replace(/\u200c|\u200f/g, '');
  let out = '';
  for (const ch of s) {
    const e = EASTERN_ARABIC.indexOf(ch);
    if (e >= 0) {
      out += String(e);
      continue;
    }
    const p = PERSIAN.indexOf(ch);
    if (p >= 0) {
      out += String(p);
      continue;
    }
    out += ch;
  }
  return out;
}
