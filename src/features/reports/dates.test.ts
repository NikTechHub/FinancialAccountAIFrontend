import { describe, expect, it } from 'vitest';
import { validateReportDateRange, yearToDateRange } from './dates';

describe('report date ranges', () => {
  it('accepts valid inclusive date ranges and rejects invalid ones', () => {
    expect(validateReportDateRange('2026-01-01', '2026-01-31')).toBeNull();
    expect(validateReportDateRange('2026-02-30', '2026-03-01')).toBe(
      'Enter a valid start date.',
    );
    expect(validateReportDateRange('2026-03-01', '2026-02-28')).toBe(
      'The start date must be on or before the end date.',
    );
    expect(validateReportDateRange('', '2026-02-28')).toBe(
      'Choose a start date.',
    );
    expect(validateReportDateRange('2026-01-01', '')).toBe('Choose an end date.');
  });

  it('builds a year-to-date default in the organization timezone', () => {
    const instant = new Date('2026-05-15T02:00:00Z');
    expect(yearToDateRange(instant, 'Asia/Kolkata')).toEqual({
      fromDate: '2026-01-01',
      toDate: '2026-05-15',
    });
    expect(yearToDateRange(instant, 'America/New_York')).toEqual({
      fromDate: '2026-01-01',
      toDate: '2026-05-14',
    });
  });
});
