// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { makeExpenseSummary, makeVendorLine } from 'src/test/dashboard-fixtures';
import { VendorSpend } from './VendorSpend';

afterEach(cleanup);

describe('VendorSpend', () => {
  it('shows vendor expenses from the real report', () => {
    render(
      <VendorSpend
        currency="USD"
        periodLabel="Year to date"
        expenses={makeExpenseSummary({
          totalAmount: 300,
          expenseCount: 2,
          byVendor: [
            makeVendorLine({
              vendorId: 'a',
              vendorName: 'Acme Supplies',
              totalAmount: 200,
              expenseCount: 1,
            }),
            makeVendorLine({
              vendorId: 'b',
              vendorName: 'Beta Travel',
              totalAmount: 100,
              expenseCount: 1,
            }),
          ],
        })}
      />,
    );

    expect(screen.getByText('Vendor spend')).toBeTruthy();
    expect(screen.getByText('Acme Supplies')).toBeTruthy();
    expect(screen.getByText('Beta Travel')).toBeTruthy();
    expect(screen.getByTitle('$200.00')).toBeTruthy();
    expect(screen.getByTitle('$100.00')).toBeTruthy();
    expect(screen.getByText('67%')).toBeTruthy();
    expect(screen.getByText('33%')).toBeTruthy();
    expect(
      screen.getByText(
        'Showing 2 of 2 vendors. Shares use all recorded expenses; expenses without a vendor are excluded from this table.',
      ),
    ).toBeTruthy();
  });

  it('shows an empty state when no vendor spend exists', () => {
    render(
      <VendorSpend
        currency="USD"
        periodLabel="Year to date"
        expenses={makeExpenseSummary()}
      />,
    );

    expect(screen.getByText('No vendor expenses recorded')).toBeTruthy();
  });
});
