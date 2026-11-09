import { describe, expect, it } from 'vitest';
import {
  formatReportAmount,
  formatReportDate,
  isZeroDecimal,
} from './display';
import { reportAmountUnits, reportTotalsBalance } from './amounts';

describe('report display helpers', () => {
  it('formats amounts without floating-point artifacts and handles negative zero', () => {
    expect(formatReportAmount(1234.5)).toBe('1,234.50');
    expect(formatReportAmount(0.0001)).toBe('0.0001');
    expect(formatReportAmount(-0)).toBe('0.00');
    expect(formatReportAmount(Number.NaN)).toBe('—');
  });

  it('compares decimal zero without floating-point coercion', () => {
    expect(isZeroDecimal(0)).toBe(true);
    expect(isZeroDecimal(-0)).toBe(true);
    expect(isZeroDecimal('0.0000')).toBe(true);
    expect(isZeroDecimal('-0.00')).toBe(true);
    expect(isZeroDecimal(0.0001)).toBe(false);
    expect(isZeroDecimal('100.00')).toBe(false);
    expect(isZeroDecimal('not-a-number')).toBe(false);
  });

  it('formats date-only values as calendar dates', () => {
    expect(formatReportDate('2026-01-05')).toBe('Jan 5, 2026');
    expect(formatReportDate('not-a-date')).toBe('not-a-date');
  });

  it('preserves four decimals and aggregate amounts beyond Number precision', () => {
    expect(formatReportAmount('999999999999999.9999')).toBe('999,999,999,999,999.9999');
    expect(formatReportAmount('-10000000000000000.0001')).toBe('-10,000,000,000,000,000.0001');
    expect(formatReportAmount('1E-4')).toBe('0.0001');
    expect(formatReportAmount('1E+3')).toBe('1,000.00');
    expect(formatReportAmount('invalid')).toBe('—');
    expect(formatReportAmount(Infinity)).toBe('—');
    expect(formatReportAmount('0.00001')).toBe('—');
    expect(reportAmountUnits('0.1')! + reportAmountUnits('0.2')!).toBe(reportAmountUnits('0.3'));
    expect(reportTotalsBalance('999999999999999.9999', '999999999999999.9998', '0')).toBe(false);
    expect(reportTotalsBalance('0.30', '0.3000', '-0.0000')).toBe(true);
  });
});
