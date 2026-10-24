// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { makeDashboardResponse } from 'src/test/dashboard-fixtures';
import { TopCards } from './TopCards';

afterEach(cleanup);

describe('TopCards', () => {
  it('shows the real dashboard totals and counts', () => {
    render(
      <TopCards
        currency="USD"
        dashboard={makeDashboardResponse({
          totalRevenue: 1250,
          totalExpenses: 450,
          netProfit: 800,
          totalInvoiced: 3000,
          totalOutstanding: 1000,
          customerCount: 4,
          vendorCount: 2,
        })}
      />,
    );

    expect(screen.getByText('Revenue')).toBeTruthy();
    expect(screen.getByTitle('$1,250.00')).toBeTruthy();
    expect(screen.getByText('Expenses')).toBeTruthy();
    expect(screen.getByTitle('$450.00')).toBeTruthy();
    expect(screen.getByText('Net profit')).toBeTruthy();
    expect(screen.getByTitle('$800.00')).toBeTruthy();
    expect(screen.getByText('Invoiced')).toBeTruthy();
    expect(screen.getByTitle('$3,000.00')).toBeTruthy();
    expect(screen.getByText('Outstanding')).toBeTruthy();
    expect(screen.getByTitle('$1,000.00')).toBeTruthy();
    expect(screen.getByText('Customers')).toBeTruthy();
    expect(screen.getByTitle('4 active customers')).toBeTruthy();
    expect(screen.getByText('Vendors')).toBeTruthy();
    expect(screen.getByTitle('2 active vendors')).toBeTruthy();
  });

  it('keeps genuine zero totals visible', () => {
    render(<TopCards currency="USD" dashboard={makeDashboardResponse()} />);

    expect(screen.getAllByText('$0').length).toBeGreaterThan(0);
    expect(screen.getByTitle('0 active customers')).toBeTruthy();
    expect(screen.getByTitle('0 active vendors')).toBeTruthy();
  });
});
