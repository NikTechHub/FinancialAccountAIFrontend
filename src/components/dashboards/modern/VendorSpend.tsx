import CardBox from 'src/components/shared/CardBox';
import { Badge } from 'src/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from 'src/components/ui/table';
import type { ExpenseSummaryResponse } from 'src/features/dashboard/types';
import { calculatePercent, getTopVendors } from 'src/features/dashboard/adapters';
import {
  formatCount,
  formatCurrency,
  formatCurrencyCompact,
  formatPercent,
  pluralize,
} from 'src/features/dashboard/formatters';

const VENDOR_LIMIT = 5;

interface VendorSpendProps {
  expenses: ExpenseSummaryResponse;
  currency: string;
  periodLabel: string;
}

export const VendorSpend = ({ expenses, currency, periodLabel }: VendorSpendProps) => {
  const vendors = getTopVendors(expenses.byVendor, VENDOR_LIMIT);
  const hasVendors = vendors.length > 0;

  return (
    <CardBox>
      <div id="vendor-spend" className="mb-6">
        <h5 className="card-title">Vendor spend</h5>
        <p className="text-sm text-muted-foreground font-normal">
          Recorded expenses · {periodLabel}
        </p>
      </div>

      {hasVendors ? (
        <div className="flex flex-col">
          <div className="-m-1.5 overflow-x-auto">
            <div className="p-1.5 min-w-full inline-block align-middle">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-sm font-semibold">#</TableHead>
                      <TableHead className="text-sm font-semibold">Vendor</TableHead>
                      <TableHead className="text-sm font-semibold">Expenses</TableHead>
                      <TableHead className="text-sm font-semibold">Share</TableHead>
                      <TableHead className="text-sm font-semibold">Total</TableHead>
                    </TableRow>
                  </TableHeader>

                  <TableBody>
                    {vendors.map((vendor, index) => {
                      const share = calculatePercent(vendor.totalAmount, expenses.totalAmount);

                      return (
                        <TableRow key={vendor.vendorId} className="border-b border-border">
                          <TableCell>
                            <p className="text-muted-foreground font-medium text-sm">
                              {index + 1}
                            </p>
                          </TableCell>

                          <TableCell className="ps-0 min-w-[180px]">
                            <h6 className="text-sm font-semibold mb-1">{vendor.vendorName}</h6>
                          </TableCell>

                          <TableCell>
                            <Badge variant="lightPrimary">
                              {formatCount(vendor.expenseCount)}
                            </Badge>
                          </TableCell>

                          <TableCell>
                            <Badge variant="lightSecondary">{formatPercent(share)}</Badge>
                          </TableCell>

                          <TableCell>
                            <p
                              className="text-[15px] font-medium text-muted-foreground"
                              title={formatCurrency(vendor.totalAmount, currency)}
                            >
                              {formatCurrencyCompact(vendor.totalAmount, currency)}
                            </p>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </div>
          </div>

          <p className="mt-4 mb-0 text-xs text-muted-foreground">
            Showing {vendors.length} of {formatCount(expenses.byVendor.length)}{' '}
            {pluralize(expenses.byVendor.length, 'vendor')}. Shares use all recorded expenses;
            expenses without a vendor are excluded from this table.
          </p>
        </div>
      ) : (
        <div className="flex min-h-[220px] flex-col items-center justify-center gap-2 text-center">
          <p className="font-medium text-foreground">No vendor expenses recorded</p>
          <p className="text-sm text-muted-foreground">
            There is no vendor-linked spending for this period.
          </p>
        </div>
      )}
    </CardBox>
  );
};
