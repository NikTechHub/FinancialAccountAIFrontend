import CardBox from '../../shared/CardBox';
import { Icon } from '@iconify/react/dist/iconify.js';
import { Progress } from 'src/components/ui/progress';
import type { InvoiceSummaryResponse } from 'src/features/dashboard/types';
import { getOutstandingPercent } from 'src/features/dashboard/adapters';
import {
  formatCount,
  formatCurrency,
  formatCurrencyCompact,
  formatPercent,
  pluralize,
} from 'src/features/dashboard/formatters';

interface InvoiceSummaryCardProps {
  invoices: InvoiceSummaryResponse;
  currency: string;
}

export const InvoiceSummaryCard = ({ invoices, currency }: InvoiceSummaryCardProps) => {
  const outstandingPercent = getOutstandingPercent(invoices);
  const hasInvoices = invoices.invoiceCount > 0;

  return (
    <CardBox className="p-0 mt-6">
      <div className="p-30 pb-0">
        <div className="grid grid-cols-12 gap-6">
          <div className="md:col-span-8 col-span-8">
            <h5 className="card-title mb-4">Invoicing</h5>
            <h4 className="text-xl mb-3">{formatCurrency(invoices.totalInvoiced, currency)}</h4>
            <div className="flex items-center gap-2">
              <span className="flex items-center justify-center rounded-full bg-lightprimary p-1 dark:bg-lightprimary">
                <Icon icon="tabler:file-invoice" className="text-primary" />
              </span>
              <p className="mb-0 text-muted-foreground">
                {formatCount(invoices.invoiceCount)}{' '}
                {pluralize(invoices.invoiceCount, 'invoice')} issued
              </p>
            </div>
          </div>
          <div className="md:col-span-4 col-span-4">
            <div className="flex justify-end">
              <div className="flex h-11 w-11 items-center justify-center rounded-full bg-secondary text-white">
                <Icon icon="tabler:file-invoice" className="text-xl" />
              </div>
            </div>
          </div>
        </div>

        {hasInvoices ? (
          <div className="mt-6">
            <div className="mb-2 flex items-center justify-between gap-2">
              <p className="mb-0 text-xs font-medium text-muted-foreground">Outstanding</p>
              <p className="mb-0 text-xs font-semibold text-foreground">
                {formatPercent(outstandingPercent)}
              </p>
            </div>
            <Progress value={outstandingPercent} variant="warning" className="h-2" />
            <p className="mt-2 mb-0 text-xs text-muted-foreground">
              {formatCurrencyCompact(invoices.totalOutstanding, currency)} of{' '}
              {formatCurrencyCompact(invoices.totalInvoiced, currency)} outstanding
            </p>
          </div>
        ) : (
          <p className="mt-6 mb-0 text-sm text-muted-foreground">
            No invoices issued in this period.
          </p>
        )}
      </div>
      <div className="h-6" />
    </CardBox>
  );
};
