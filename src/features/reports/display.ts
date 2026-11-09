import { format, isValid, parseISO } from 'date-fns';
import { reportAmountUnits } from './amounts';
import type { ReportAmount } from './types';

const reportLocaleByCurrency: Record<string, string> = {
  AED: 'en-AE', AUD: 'en-AU', CAD: 'en-CA', EUR: 'de-DE', GBP: 'en-GB', INR: 'en-IN', USD: 'en-US',
};

export function formatReportAmount(value: ReportAmount, currency?: string): string {
  const units = reportAmountUnits(value);
  if (units === null) return '—';
  const absolute = units < 0n ? -units : units;
  const whole = absolute / 10000n;
  const fraction = (absolute % 10000n).toString().padStart(4, '0').replace(/0+$/, '').padEnd(2, '0');
  if (currency) {
    try {
      const code = currency.trim().toUpperCase();
      const locale = reportLocaleByCurrency[code] ?? 'en';
      const formatter = new Intl.NumberFormat(locale, {
        style: 'currency', currency: code, minimumFractionDigits: 2, maximumFractionDigits: 4,
      });
      return formatter.formatToParts(units < 0n ? -whole : whole)
        .map((part) => part.type === 'fraction' ? fraction : part.value).join('');
    } catch {
      // Keep exact decimal rendering for legacy or unsupported stored codes.
      return `${currency} ${formatReportAmount(value)}`;
    }
  }
  const groupedWhole = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(whole);
  return `${units < 0n ? '-' : ''}${groupedWhole}.${fraction}`;
}

export function formatReportDate(value: string): string {
  const parsed = parseISO(value);
  if (!isValid(parsed)) return value;
  return format(parsed, 'MMM d, yyyy');
}

export function isZeroDecimal(value: number | string): boolean {
  return reportAmountUnits(value) === 0n;
}
