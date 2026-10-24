import { describe, expect, it } from 'vitest';
import {
  buildExpenseSegments,
  calculatePercent,
  getOutstandingPercent,
  getTopVendors,
  hasExpenseActivity,
  hasRevenueActivity,
} from './adapters';
import type { ExpenseAccountSummaryLine } from './types';
import {
  makeDashboardResponse,
  makeExpenseSummary,
  makeInvoiceSummary,
  makeVendorLine,
} from 'src/test/dashboard-fixtures';

function accountLine(
  id: string,
  name: string,
  amount: number,
): ExpenseAccountSummaryLine {
  return {
    expenseAccountId: id,
    expenseAccountCode: id.toUpperCase(),
    expenseAccountName: name,
    totalAmount: amount,
    expenseCount: 1,
  };
}

describe('dashboard adapters', () => {
  it('keeps all segments when they fit', () => {
    const segments = buildExpenseSegments([
      accountLine('a', 'Software', 100),
      accountLine('b', 'Travel', 50),
    ]);

    expect(segments.map((segment) => segment.label)).toEqual(['Software', 'Travel']);
  });

  it('sorts by amount and groups the remainder into Other', () => {
    const segments = buildExpenseSegments([
      accountLine('a', 'Software', 100),
      accountLine('b', 'Travel', 80),
      accountLine('c', 'Office', 60),
      accountLine('d', 'Meals', 40),
      accountLine('e', 'Utilities', 20),
    ]);

    expect(segments.map((segment) => segment.label)).toEqual([
      'Software',
      'Travel',
      'Office',
      'Other (2 accounts)',
    ]);
    expect(segments[3].amount).toBe(60);
  });

  it('ignores zero and negative account totals', () => {
    const segments = buildExpenseSegments([
      accountLine('a', 'Software', 100),
      accountLine('b', 'Zero', 0),
      accountLine('c', 'Negative', -10),
    ]);

    expect(segments.map((segment) => segment.label)).toEqual(['Software']);
  });

  it('sorts and limits vendors by spend', () => {
    const vendors = getTopVendors(
      [
        makeVendorLine({ vendorId: 'a', vendorName: 'Alpha', totalAmount: 10 }),
        makeVendorLine({ vendorId: 'b', vendorName: 'Beta', totalAmount: 40 }),
        makeVendorLine({ vendorId: 'c', vendorName: 'Gamma', totalAmount: 30 }),
      ],
      2,
    );

    expect(vendors.map((vendor) => vendor.vendorName)).toEqual(['Beta', 'Gamma']);
  });

  it('calculates bounded percentages', () => {
    expect(calculatePercent(25, 100)).toBe(25);
    expect(calculatePercent(100, 0)).toBe(0);
    expect(calculatePercent(150, 100)).toBe(100);
    expect(getOutstandingPercent(makeInvoiceSummary({
      totalInvoiced: 200,
      totalOutstanding: 50,
    }))).toBe(25);
  });

  it('detects real activity separately from zero totals', () => {
    expect(hasRevenueActivity(makeDashboardResponse())).toBe(false);
    expect(
      hasRevenueActivity(makeDashboardResponse({ totalRevenue: 0, totalExpenses: 1 })),
    ).toBe(true);
    expect(hasExpenseActivity(makeExpenseSummary())).toBe(false);
    expect(
      hasExpenseActivity(
        makeExpenseSummary({
          totalAmount: 10,
          byAccount: [accountLine('a', 'Software', 10)],
        }),
      ),
    ).toBe(true);
  });
});
