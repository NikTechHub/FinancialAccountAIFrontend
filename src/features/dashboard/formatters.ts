import { format, isSameDay, isValid, parseISO } from 'date-fns';

const numberFormatter = new Intl.NumberFormat('en-US', {
  maximumFractionDigits: 0,
});

const percentFormatter = new Intl.NumberFormat('en-US', {
  maximumFractionDigits: 0,
});

const currencyFormatters = new Map<string, Intl.NumberFormat>();

function normalizeValue(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Object.is(value, -0) ? 0 : value;
}

function getCurrencyFormatter(currency: string, compact: boolean): Intl.NumberFormat | null {
  const code = currency.trim().toUpperCase();
  if (!/^[A-Z]{3}$/.test(code)) return null;

  const key = `${code}:${compact ? 'compact' : 'full'}`;
  const cached = currencyFormatters.get(key);
  if (cached) return cached;

  const formatter = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: code,
    ...(compact
      ? { notation: 'compact', maximumFractionDigits: 1 }
      : { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
  });
  currencyFormatters.set(key, formatter);
  return formatter;
}

export function formatCurrency(value: number, currency: string): string {
  const normalized = normalizeValue(value);
  const formatter = getCurrencyFormatter(currency, false);
  return formatter ? formatter.format(normalized) : `${currency} ${normalized.toFixed(2)}`;
}

export function formatCurrencyCompact(value: number, currency: string): string {
  const normalized = normalizeValue(value);
  const formatter = getCurrencyFormatter(currency, true);
  return formatter ? formatter.format(normalized) : `${currency} ${normalized.toFixed(1)}`;
}

export function formatCount(value: number): string {
  return numberFormatter.format(normalizeValue(value));
}

export function formatPercent(value: number): string {
  return `${percentFormatter.format(normalizeValue(value))}%`;
}

export function pluralize(count: number, singular: string, plural = `${singular}s`): string {
  return count === 1 ? singular : plural;
}

export function formatDateRange(fromDate: string, toDate: string): string {
  const from = parseISO(fromDate);
  const to = parseISO(toDate);

  if (!isValid(from) || !isValid(to)) {
    return `${fromDate} – ${toDate}`;
  }

  if (isSameDay(from, to)) {
    return format(from, 'MMM d, yyyy');
  }

  if (from.getFullYear() === to.getFullYear()) {
    return `${format(from, 'MMM d')} – ${format(to, 'MMM d, yyyy')}`;
  }

  return `${format(from, 'MMM d, yyyy')} – ${format(to, 'MMM d, yyyy')}`;
}
