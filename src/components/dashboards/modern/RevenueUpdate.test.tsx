// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { makeDashboardResponse } from 'src/test/dashboard-fixtures';
import { RevenueUpdate } from './RevenueUpdate';

vi.mock('react-apexcharts', () => ({
  default: () => <div data-testid="apex-chart" />,
}));

afterEach(cleanup);

describe('RevenueUpdate', () => {
  it('renders the chart when revenue activity exists', () => {
    render(
      <RevenueUpdate
        currency="USD"
        periodLabel="Year to date"
        dashboard={makeDashboardResponse({
          totalRevenue: 1200,
          totalExpenses: 450,
          netProfit: 750,
        })}
      />,
    );

    expect(screen.getByText('Revenue updates')).toBeTruthy();
    expect(screen.getByText('Revenue, expenses, and net profit · Year to date')).toBeTruthy();
    expect(screen.getByTestId('apex-chart')).toBeTruthy();
  });

  it('shows an empty state instead of a zero chart', () => {
    render(
      <RevenueUpdate
        currency="USD"
        periodLabel="Year to date"
        dashboard={makeDashboardResponse()}
      />,
    );

    expect(screen.getByText('No revenue or expenses recorded')).toBeTruthy();
    expect(screen.queryByTestId('apex-chart')).toBeNull();
  });
});
