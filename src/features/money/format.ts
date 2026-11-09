const currencyFormatters = new Map<string, Intl.NumberFormat>();
const compactCurrencyFormatters = new Map<string, Intl.NumberFormat>();

const localeByCurrency: Record<string, string> = {
  AED: 'en-AE',
  AUD: 'en-AU',
  CAD: 'en-CA',
  EUR: 'de-DE',
  GBP: 'en-GB',
  INR: 'en-IN',
  USD: 'en-US',
};

export function formatMoney(
  value: number,
  currency: string,
  compact = false,
  maximumFractionDigits = 2,
): string {
  if (!Number.isFinite(value)) return '—';
  const code = currency.trim().toUpperCase();
  const cache = compact ? compactCurrencyFormatters : currencyFormatters;
  const cacheKey = `${code}:${maximumFractionDigits}`;
  let formatter = cache.get(cacheKey);
  if (!formatter) {
    try {
      formatter = new Intl.NumberFormat(localeByCurrency[code] ?? 'en', {
        style: 'currency',
        currency: code,
        ...(compact
          ? { notation: 'compact', maximumFractionDigits: 1 }
          : { minimumFractionDigits: 2, maximumFractionDigits }),
      });
      cache.set(cacheKey, formatter);
    } catch {
      return `${currency} ${value.toFixed(compact ? 1 : maximumFractionDigits)}`;
    }
  }
  return formatter.format(Object.is(value, -0) ? 0 : value);
}

export function formatMoneyValue(value: number, locale = 'en-US'): string {
  if (!Number.isFinite(value)) return '—';
  return new Intl.NumberFormat(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Object.is(value, -0) ? 0 : value);
}
