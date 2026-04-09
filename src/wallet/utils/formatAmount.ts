import { Prisma } from '@prisma/client';

/**
 * API / UI display: fixed precision then trim trailing zeros (e.g. 10.0000 → 10, 12.50 → 12.5).
 */
export function formatWalletAmountForApi(value: Prisma.Decimal): string {
  const s = value.toFixed(4);
  if (!s.includes('.')) return s;
  const trimmed = s.replace(/\.?0+$/, '');
  return trimmed === '' ? '0' : trimmed;
}
