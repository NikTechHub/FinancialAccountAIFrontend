import { format, isValid, parseISO } from 'date-fns';
import { reportAmountUnits } from './amounts';
import type { ReportAmount } from './types';

export function formatReportAmount(value: ReportAmount): string {
  const units = reportAmountUnits(value);
  if (units === null) return '—';
  const absolute = units < 0n ? -units : units;
  const whole = (absolute / 10000n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  const fraction = (absolute % 10000n).toString().padStart(4, '0').replace(/0+$/, '').padEnd(2, '0');
  return `${units < 0n ? '-' : ''}${whole}.${fraction}`;
}

export function formatReportDate(value: string): string {
  const parsed = parseISO(value);
  if (!isValid(parsed)) return value;
  return format(parsed, 'MMM d, yyyy');
}

export function isZeroDecimal(value: number | string): boolean {
  return reportAmountUnits(value) === 0n;
}
