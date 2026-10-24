import { describe, expect, it } from 'vitest';
import { createReportPeriod, REPORT_PERIOD_OPTIONS } from './period';

const may15 = new Date(2026, 4, 15, 12, 0, 0);

describe('createReportPeriod', () => {
  it('builds month-to-date dates', () => {
    expect(createReportPeriod('month', may15)).toMatchObject({
      label: 'Month to date',
      fromDate: '2026-05-01',
      toDate: '2026-05-15',
    });
  });

  it('builds quarter-to-date dates', () => {
    expect(createReportPeriod('quarter', may15)).toMatchObject({
      label: 'Quarter to date',
      fromDate: '2026-04-01',
      toDate: '2026-05-15',
    });
  });

  it('builds year-to-date dates', () => {
    expect(createReportPeriod('year', may15)).toMatchObject({
      label: 'Year to date',
      fromDate: '2026-01-01',
      toDate: '2026-05-15',
    });
  });

  it('uses the organization time zone for the current date', () => {
    const instant = new Date('2026-10-20T23:30:00Z');

    expect(createReportPeriod('month', instant, 'Asia/Kolkata')).toMatchObject({
      fromDate: '2026-10-01',
      toDate: '2026-10-21',
    });
    expect(createReportPeriod('month', instant, 'America/New_York')).toMatchObject({
      fromDate: '2026-10-01',
      toDate: '2026-10-20',
    });
  });

  it('handles a time zone year boundary', () => {
    const instant = new Date('2026-12-31T20:00:00Z');

    expect(createReportPeriod('year', instant, 'Asia/Kolkata')).toMatchObject({
      fromDate: '2027-01-01',
      toDate: '2027-01-01',
    });
  });

  it('exposes the supported options in display order', () => {
    expect(REPORT_PERIOD_OPTIONS.map((option) => option.id)).toEqual([
      'month',
      'quarter',
      'year',
    ]);
  });
});
