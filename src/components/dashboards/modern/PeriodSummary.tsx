import CardBox from 'src/components/shared/CardBox';
import type { DashboardResponse } from 'src/features/dashboard/types';
import { formatCount, formatCurrency, pluralize } from 'src/features/dashboard/formatters';

interface PeriodSummaryProps {
  dashboard: DashboardResponse;
  currency: string;
  periodLabel: string;
}

export const PeriodSummary = ({ dashboard, currency, periodLabel }: PeriodSummaryProps) => {
  const timelineData = [
    {
      key: 'invoices',
      label: 'Invoices',
      value: `${formatCount(dashboard.invoiceCount)} ${pluralize(dashboard.invoiceCount, 'invoice')} issued`,
      borderColor: 'border-primary',
    },
    {
      key: 'expenses',
      label: 'Expenses',
      value: `${formatCount(dashboard.expenseCount)} ${pluralize(dashboard.expenseCount, 'expense')} recorded`,
      borderColor: 'border-secondary',
    },
    {
      key: 'customers',
      label: 'Customers',
      value: `${formatCount(dashboard.customerCount)} active ${pluralize(dashboard.customerCount, 'customer')}`,
      borderColor: 'border-info',
    },
    {
      key: 'vendors',
      label: 'Vendors',
      value: `${formatCount(dashboard.vendorCount)} active ${pluralize(dashboard.vendorCount, 'vendor')}`,
      borderColor: 'border-warning',
    },
    {
      key: 'netProfit',
      label: 'Net profit',
      value: formatCurrency(dashboard.netProfit, currency),
      borderColor: dashboard.netProfit >= 0 ? 'border-success' : 'border-error',
    },
  ];

  return (
    <CardBox className="h-full w-full">
      <div>
        <h5 className="card-title">Period summary</h5>
        <p className="text-sm text-muted-foreground font-normal">
          Activity recorded · {periodLabel}
        </p>
      </div>

      <div className="mt-6">
        {timelineData.map((item, index) => {
          const isLastItem = index === timelineData.length - 1;

          return (
            <div key={item.key} className="flex gap-x-3">
              <div className="w-1/3 text-end">
                <span className="font-medium text-foreground dark:text-muted-foreground">
                  {item.label}
                </span>
              </div>
              <div
                className={`relative ${
                  isLastItem ? 'after:hidden' : ''
                } after:absolute after:top-7 after:bottom-0 after:start-3.5 after:w-px after:-translate-x-[0.5px] after:bg-border`}
              >
                <div className="relative z-1 w-7 h-7 flex justify-center items-center">
                  <div
                    className={`h-3 w-3 rounded-full bg-transparent border-2 ${item.borderColor}`}
                  />
                </div>
              </div>
              <div className="w-2/3 grow pt-0.5 pb-6">
                <p className="font-medium text-foreground dark:text-muted-foreground">
                  {item.value}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </CardBox>
  );
};
