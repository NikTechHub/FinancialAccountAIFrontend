import { isValid, parseISO } from 'date-fns';
import { createReportPeriod } from 'src/features/dashboard/period';
import type { ReportDateRange } from './types';

function isRealIsoDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = parseISO(value);
  return isValid(parsed);
}

export function validateReportAsOfDate(value: string): string | null {
  if (!value) return 'Choose an as-of date.';
  return isRealIsoDate(value) ? null : 'Enter a valid as-of date.';
}

export function validateReportDateRange(
  fromDate: string,
  toDate: string,
): string | null {
  if (!fromDate) return 'Choose a start date.';
  if (!toDate) return 'Choose an end date.';
  if (!isRealIsoDate(fromDate)) return 'Enter a valid start date.';
  if (!isRealIsoDate(toDate)) return 'Enter a valid end date.';
  if (fromDate > toDate) return 'The start date must be on or before the end date.';
  return null;
}

export function yearToDateRange(
  today: Date = new Date(),
  timeZone?: string,
): ReportDateRange {
  const period = createReportPeriod('year', today, timeZone);
  return { fromDate: period.fromDate, toDate: period.toDate };
}
