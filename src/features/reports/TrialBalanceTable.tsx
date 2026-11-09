import { Alert, AlertDescription, AlertTitle } from 'src/components/ui/alert';
import { Badge } from 'src/components/ui/badge';
import { Button } from 'src/components/ui/button';
import { Skeleton } from 'src/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from 'src/components/ui/table';
import { accountTypeMeta } from 'src/features/accounts/display';
import type { TrialBalanceResponse } from './types';
import {
  formatReportAmount,
  formatReportDate,
} from './display';
import { reportTotalsBalance } from './amounts';

interface TrialBalanceTableProps {
  data: TrialBalanceResponse | null;
  isLoading: boolean;
  onResetPeriod: () => void;
}

export function TrialBalanceTable({
  data,
  isLoading,
  onResetPeriod,
}: TrialBalanceTableProps) {
  const columnCount = 6;
  const lines = data?.lines ?? [];
  const hasActivity = lines.length > 0;
  const isBalanced = data && reportTotalsBalance(data.totalDebits, data.totalCredits, data.totalDifference);

  const status = !data
    ? null
    : !hasActivity
      ? { label: 'No activity', variant: 'gray' as const }
      : isBalanced
        ? { label: 'Balanced', variant: 'lightSuccess' as const }
        : { label: 'Out of balance', variant: 'lightError' as const };

  return (
    <div>
      {isLoading && (
        <span role="status" className="sr-only">
          Loading trial balance...
        </span>
      )}

      {data && (
        <div className="grid gap-4 border-t border-border p-4 sm:grid-cols-3 dark:border-white/10">
          <div className="rounded-lg border border-border p-4 dark:border-white/10">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Total debits
            </p>
            <p className="mt-2 break-all text-lg font-semibold tabular-nums">
              {formatReportAmount(data.totalDebits)}
            </p>
          </div>
          <div className="rounded-lg border border-border p-4 dark:border-white/10">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Total credits
            </p>
            <p className="mt-2 break-all text-lg font-semibold tabular-nums">
              {formatReportAmount(data.totalCredits)}
            </p>
          </div>
          <div className="rounded-lg border border-border p-4 dark:border-white/10">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Difference (debits − credits)
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <p className="break-all text-lg font-semibold tabular-nums">
                {formatReportAmount(data.totalDifference)}
              </p>
              {status && <Badge variant={status.variant}>{status.label}</Badge>}
            </div>
          </div>
        </div>
      )}

      <div className="border-t border-border dark:border-white/10">
        <Table aria-label="Trial balance table">
          <TableHeader>
            <TableRow>
              <TableHead className="min-w-[110px]">Code</TableHead>
              <TableHead className="min-w-[220px]">Account</TableHead>
              <TableHead className="min-w-[120px]">Type</TableHead>
              <TableHead className="min-w-[140px] text-right">
                Debits
              </TableHead>
              <TableHead className="min-w-[140px] text-right">
                Credits
              </TableHead>
              <TableHead className="min-w-[150px] text-right">
                Net balance
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading &&
              Array.from({ length: 6 }).map((_, index) => (
                <TableRow key={`skeleton-${index}`}>
                  {Array.from({ length: columnCount }).map((__, cellIndex) => (
                    <TableCell key={cellIndex}>
                      <Skeleton className="h-5 w-full max-w-[150px]" />
                    </TableCell>
                  ))}
                </TableRow>
              ))}

            {!isLoading && data && lines.length === 0 && (
              <TableRow>
                <TableCell colSpan={columnCount} className="p-10 text-center">
                  <p className="text-base font-medium">
                    No posted activity in this date range
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    No accounts had posted journal lines between{' '}
                    {formatReportDate(data.fromDate)} and{' '}
                    {formatReportDate(data.toDate)}.
                  </p>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="mt-4"
                    onClick={onResetPeriod}
                  >
                    Reset to year to date
                  </Button>
                </TableCell>
              </TableRow>
            )}

            {!isLoading &&
              lines.map((line) => {
                const type = accountTypeMeta[line.accountType];
                return (
                  <TableRow key={line.accountId}>
                    <TableCell className="font-medium">{line.accountCode}</TableCell>
                    <TableCell>{line.accountName}</TableCell>
                    <TableCell>
                      <Badge variant={type.variant}>{type.label}</Badge>
                    </TableCell>
                    <TableCell className="text-right font-medium tabular-nums">
                      {formatReportAmount(line.debitTotal)}
                    </TableCell>
                    <TableCell className="text-right font-medium tabular-nums">
                      {formatReportAmount(line.creditTotal)}
                    </TableCell>
                    <TableCell className="text-right font-medium tabular-nums">
                      {formatReportAmount(line.netBalance)}
                    </TableCell>
                  </TableRow>
                );
              })}
          </TableBody>
        </Table>
      </div>

      {!isLoading && data && (
        <div className="border-t border-border p-4 text-xs text-muted-foreground dark:border-white/10">
          <p>
            Totals are supplied by the API for the complete report range and are
            not calculated from visible rows. Net balances follow normal
            account balances: assets and expenses are debit-normal; liabilities,
            equity, and revenue are credit-normal.
          </p>
        </div>
      )}

      {!data && !isLoading && (
        <Alert variant="lightwarning" className="m-4">
          <AlertTitle>Trial balance unavailable</AlertTitle>
          <AlertDescription>
            The requested report did not return any data.
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}
