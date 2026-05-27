/**
 * currency.ts — Safe currency formatting utilities.
 * Guards against NaN, null, undefined values in number displays.
 */

/**
 * Format a number as USD currency.
 * Returns "$0.00" instead of "NaN" or "$NaN" for invalid inputs.
 */
export function formatCurrency(
  value: number | null | undefined,
  options: { decimals?: number; prefix?: string } = {}
): string {
  const { decimals = 2, prefix = '$' } = options;
  const safe = typeof value === 'number' && isFinite(value) ? value : 0;
  return `${prefix}${safe.toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })}`;
}

/**
 * Safely convert a value to a number.
 * Returns fallback (default 0) for NaN, null, undefined, or non-numeric strings.
 */
export function safeNumber(value: unknown, fallback = 0): number {
  if (value === null || value === undefined) return fallback;
  const n = Number(value);
  return isFinite(n) ? n : fallback;
}

/**
 * Format a percentage safely.
 * Returns "0%" for invalid inputs.
 */
export function formatPercent(value: number | null | undefined, decimals = 1): string {
  const safe = typeof value === 'number' && isFinite(value) ? value : 0;
  return `${safe.toFixed(decimals)}%`;
}
