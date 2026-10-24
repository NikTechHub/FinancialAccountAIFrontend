import { format, startOfMonth, startOfQuarter, startOfYear } from 'date-fns';

export type PeriodId = 'month' | 'quarter' | 'year';

export interface ReportPeriod {
  id: PeriodId;
  label: string;
  fromDate: string;
  toDate: string;
}

const PERIOD_LABELS: Record<PeriodId, string> = {
  month: 'Month to date',
  quarter: 'Quarter to date',
  year: 'Year to date',
};

const PERIOD_STARTS: Record<PeriodId, (date: Date) => Date> = {
  month: startOfMonth,
  quarter: startOfQuarter,
  year: startOfYear,
};

export const REPORT_PERIOD_OPTIONS: ReadonlyArray<{ id: PeriodId; label: string }> = [
  { id: 'month', label: PERIOD_LABELS.month },
  { id: 'quarter', label: PERIOD_LABELS.quarter },
  { id: 'year', label: PERIOD_LABELS.year },
];

function dateInTimeZone(instant: Date, timeZone: string): Date | null {
  try {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(instant);

    const year = Number(parts.find((part) => part.type === 'year')?.value);
    const month = Number(parts.find((part) => part.type === 'month')?.value);
    const day = Number(parts.find((part) => part.type === 'day')?.value);

    if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) {
      return null;
    }

    return new Date(year, month - 1, day, 12, 0, 0);
  } catch {
    return null;
  }
}

export function createReportPeriod(
  id: PeriodId,
  today: Date = new Date(),
  timeZone?: string,
): ReportPeriod {
  const reference = (timeZone ? dateInTimeZone(today, timeZone) : null) ?? today;
  const start = PERIOD_STARTS[id](reference);

  return {
    id,
    label: PERIOD_LABELS[id],
    fromDate: format(start, 'yyyy-MM-dd'),
    toDate: format(reference, 'yyyy-MM-dd'),
  };
}
