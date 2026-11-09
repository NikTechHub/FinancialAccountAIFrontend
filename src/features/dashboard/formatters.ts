import { format, isSameDay, isValid, parseISO } from 'date-fns';
import { formatMoney } from 'src/features/money/format';

const numberFormatter = new Intl.NumberFormat('en-US', {
  maximumFractionDigits: 0,
});

const percentFormatter = new Intl.NumberFormat('en-US', {
  maximumFractionDigits: 0,
});

function normalizeValue(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Object.is(value, -0) ? 0 : value;
}

export function formatCurrency(value: number, currency: string): string {
  return formatMoney(value, currency);
}

export function formatCurrencyCompact(value: number, currency: string): string {
  return formatMoney(value, currency, true);
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
