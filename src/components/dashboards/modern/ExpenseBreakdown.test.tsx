// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { makeExpenseSummary } from 'src/test/dashboard-fixtures';
import { ExpenseBreakdown } from './ExpenseBreakdown';

vi.mock('react-apexcharts', () => ({
  default: () => <div data-testid="apex-chart" />,
}));

afterEach(cleanup);

describe('ExpenseBreakdown', () => {
  it('shows recorded expenses grouped by account', () => {
    render(
      <ExpenseBreakdown
        currency="USD"
        expenses={makeExpenseSummary({
          totalAmount: 200,
          expenseCount: 2,
          byAccount: [
            {
              expenseAccountId: 'a',
              expenseAccountCode: '5000',
              expenseAccountName: 'Software',
              totalAmount: 150,
              expenseCount: 1,
            },
            {
              expenseAccountId: 'b',
              expenseAccountCode: '5100',
              expenseAccountName: 'Travel',
              totalAmount: 50,
              expenseCount: 1,
            },
          ],
        })}
      />,
    );

    expect(screen.getByText('Expenses')).toBeTruthy();
    expect(screen.getByText('By account')).toBeTruthy();
    expect(screen.getByText('$200.00')).toBeTruthy();
    expect(screen.getByText('2 recorded expenses')).toBeTruthy();
    expect(screen.getByText('Software')).toBeTruthy();
    expect(screen.getByText('Travel')).toBeTruthy();
    expect(screen.getByTestId('apex-chart')).toBeTruthy();
  });

  it('shows an empty state when no expenses were recorded', () => {
    render(<ExpenseBreakdown currency="USD" expenses={makeExpenseSummary()} />);

    expect(screen.getByText('No recorded expenses for this period.')).toBeTruthy();
    expect(screen.queryByTestId('apex-chart')).toBeNull();
  });
});
