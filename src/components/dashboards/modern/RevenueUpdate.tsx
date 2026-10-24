import CardBox from '../../shared/CardBox';
import Chart from 'react-apexcharts';
import { ApexOptions } from 'apexcharts';
import { Icon } from '@iconify/react/dist/iconify.js';
import type { DashboardResponse } from 'src/features/dashboard/types';
import { hasRevenueActivity } from 'src/features/dashboard/adapters';
import { formatCurrency, formatCurrencyCompact } from 'src/features/dashboard/formatters';

interface RevenueUpdateProps {
  dashboard: DashboardResponse;
  currency: string;
  periodLabel: string;
}

export const RevenueUpdate = ({ dashboard, currency, periodLabel }: RevenueUpdateProps) => {
  const hasActivity = hasRevenueActivity(dashboard);

  const categories = ['Revenue', 'Expenses', 'Net profit'];
  const values = [dashboard.totalRevenue, dashboard.totalExpenses, dashboard.netProfit];

  const ChartData: ApexOptions = {
    chart: {
      toolbar: { show: false },
      type: 'bar',
      fontFamily: 'inherit',
      foreColor: '#7C8FAC',
      height: 310,
      width: '100%',
      offsetX: -10,
    },
    colors: [
      'var(--color-primary)',
      'var(--color-secondary)',
      dashboard.netProfit >= 0 ? 'var(--color-success)' : 'var(--color-error)',
    ],
    plotOptions: {
      bar: {
        horizontal: false,
        columnWidth: '32%',
        borderRadius: 6,
        borderRadiusApplication: 'end',
        distributed: true,
      },
    },
    dataLabels: { enabled: false },
    legend: { show: false },
    grid: {
      borderColor: 'rgba(0,0,0,0.1)',
      strokeDashArray: 3,
    },
    xaxis: {
      categories,
      axisBorder: { show: false },
      axisTicks: { show: false },
      labels: {
        style: { fontSize: '12px' },
      },
    },
    yaxis: {
      labels: {
        formatter: (value: number) => formatCurrencyCompact(value, currency),
      },
    },
    tooltip: {
      theme: 'dark',
      y: {
        formatter: (value: number) => formatCurrency(value, currency),
      },
    },
  };

  return (
    <CardBox className="pb-0 h-full w-full">
      <div className="mb-6">
        <h5 className="card-title">Revenue updates</h5>
        <p className="text-sm text-muted-foreground font-normal">
          Revenue, expenses, and net profit · {periodLabel}
        </p>
      </div>
      {hasActivity ? (
        <Chart
          options={ChartData}
          series={[{ name: 'Amount', data: values }]}
          type="bar"
          height="316px"
          width={'100%'}
        />
      ) : (
        <div className="flex h-[316px] flex-col items-center justify-center gap-3 text-center">
          <Icon icon="tabler:chart-bar" className="text-4xl text-muted-foreground" />
          <div>
            <p className="font-medium text-foreground">No revenue or expenses recorded</p>
            <p className="text-sm text-muted-foreground">
              There is no posted financial activity for this period.
            </p>
          </div>
        </div>
      )}
    </CardBox>
  );
};
