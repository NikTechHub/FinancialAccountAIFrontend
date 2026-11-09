import { describe, expect, it } from 'vitest';
import {
  formatCount,
  formatCurrency,
  formatCurrencyCompact,
  formatDateRange,
  formatPercent,
  pluralize,
} from './formatters';

describe('dashboard formatters', () => {
  it('formats full currency amounts', () => {
    expect(formatCurrency(1234.5, 'USD')).toBe('$1,234.50');
    expect(formatCurrency(500, 'INR')).toBe('₹500.00');
    expect(formatCurrency(-250, 'USD')).toBe('-$250.00');
    expect(formatCurrency(1250000, 'INR')).toBe('₹12,50,000.00');
  });

  it('formats compact currency amounts', () => {
    expect(formatCurrencyCompact(1234567, 'USD')).toBe('$1.2M');
    expect(formatCurrencyCompact(0, 'INR')).toBe('₹0');
  });

  it('formats counts and percentages', () => {
    expect(formatCount(1234567)).toBe('1,234,567');
    expect(formatPercent(12.6)).toBe('13%');
  });

  it('pluralizes count labels', () => {
    expect(pluralize(0, 'invoice')).toBe('invoices');
    expect(pluralize(1, 'invoice')).toBe('invoice');
    expect(pluralize(2, 'invoice')).toBe('invoices');
  });

  it('formats a date range within one year', () => {
    expect(formatDateRange('2026-01-01', '2026-10-20')).toBe('Jan 1 – Oct 20, 2026');
  });

  it('formats a date range across years', () => {
    expect(formatDateRange('2025-12-15', '2026-01-14')).toBe(
      'Dec 15, 2025 – Jan 14, 2026',
    );
  });

  it('formats a single-day range once', () => {
    expect(formatDateRange('2026-10-20', '2026-10-20')).toBe('Oct 20, 2026');
  });

  it('falls back to the raw range for invalid dates', () => {
    expect(formatDateRange('not-a-date', '2026-10-20')).toBe('not-a-date – 2026-10-20');
  });
});
