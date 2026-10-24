import CardBox from 'src/components/shared/CardBox';
import Chart from 'react-apexcharts';
import { ApexOptions } from 'apexcharts';
import { Icon } from '@iconify/react/dist/iconify.js';
import type { ExpenseSummaryResponse } from 'src/features/dashboard/types';
import {
  buildExpenseSegments,
  hasExpenseActivity,
} from 'src/features/dashboard/adapters';
import {
  formatCurrency,
  formatCurrencyCompact,
  formatCount,
  pluralize,
} from 'src/features/dashboard/formatters';

interface ExpenseBreakdownProps {
  expenses: ExpenseSummaryResponse;
  currency: string;
}

export const ExpenseBreakdown = ({ expenses, currency }: ExpenseBreakdownProps) => {
  const segments = buildExpenseSegments(expenses.byAccount);
  const hasActivity = hasExpenseActivity(expenses) && segments.length > 0;

  const ChartData: ApexOptions = {
    series: segments.map((segment) => segment.amount),
    labels: segments.map((segment) => segment.label),
    colors: segments.map((segment) => segment.color),
    chart: {
      type: 'donut',
      fontFamily: 'inherit',
      foreColor: '#adb0bb',
      height: 170,
      toolbar: { show: false },
    },
    plotOptions: {
      pie: {
        startAngle: 0,
        endAngle: 360,
        donut: {
          size: '72%',
          labels: {
            show: true,
            name: {
              show: true,
              fontSize: '12px',
              color: '#7C8FAC',
            },
            value: {
              show: true,
              fontSize: '15px',
              fontWeight: 600,
              color: '#2A3547',
              formatter: (value: string) => formatCurrencyCompact(Number(value), currency),
            },
            total: {
              show: true,
              showAlways: true,
              label: 'Expenses',
              fontSize: '12px',
              color: '#7C8FAC',
              formatter: () => formatCurrencyCompact(expenses.totalAmount, currency),
            },
          },
        },
      },
    },
    stroke: { show: false },
    dataLabels: { enabled: false },
    legend: { show: false },
    tooltip: {
      theme: 'dark',
      y: {
        formatter: (value: number) => formatCurrency(value, currency),
      },
    },
  };

  return (
    <CardBox>
      <div className="grid grid-cols-12 gap-4">
        <div className="col-span-7">
          <h5 className="card-title mb-1 whitespace-nowrap">Expenses</h5>
          <p className="mb-3 text-xs text-muted-foreground">By account</p>
          <h4 className="text-xl mb-2">{formatCurrency(expenses.totalAmount, currency)}</h4>
          <div className="flex items-center gap-2">
            <span className="rounded-full bg-lightsuccess p-1 dark:bg-darksuccess">
              <Icon icon="tabler:receipt" className="text-success" />
            </span>
            <p className="text-muted-foreground mb-0">
              {formatCount(expenses.expenseCount)} recorded{' '}
              {pluralize(expenses.expenseCount, 'expense')}
            </p>
          </div>

          {hasActivity ? (
            <div className="mt-4 flex flex-col gap-2">
              {segments.map((segment) => (
                <div key={segment.key} className="flex items-center justify-between gap-2">
                  <div className="flex min-w-0 items-center gap-2">
                    <span
                      className="h-2.5 w-2.5 shrink-0 rounded-full"
                      style={{ backgroundColor: segment.color }}
                    />
                    <span className="truncate text-xs text-muted-foreground" title={segment.label}>
                      {segment.label}
                    </span>
                  </div>
                  <span className="shrink-0 text-xs font-medium text-foreground">
                    {formatCurrencyCompact(segment.amount, currency)}
                  </span>
                </div>
              ))}
            </div>
          ) : null}
        </div>

        <div className="col-span-5 flex items-center justify-center">
          {hasActivity ? (
            <Chart
              options={ChartData}
              series={ChartData.series}
              type="donut"
              height={170}
              width={170}
            />
          ) : (
            <div className="flex flex-col items-center gap-3 text-center">
              <Icon icon="tabler:receipt" className="text-3xl text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                No recorded expenses for this period.
              </p>
            </div>
          )}
        </div>
      </div>
    </CardBox>
  );
};
