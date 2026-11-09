import type { ReactNode } from 'react';
import { Alert, AlertDescription, AlertTitle } from 'src/components/ui/alert';
import { Button } from 'src/components/ui/button';
import { Skeleton } from 'src/components/ui/skeleton';
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from 'src/components/ui/table';
import { formatReportAmount } from './display';
import type { ProfitAndLossLine, ReportAmount } from './types';

export function FinancialReportScope({ currency }: { currency: string }) {
  return (
    <p className="text-xs text-muted-foreground">
      This report includes every organization you belong to and cannot be filtered to a single organization.
      The backend blocks mixed-currency report requests. Accepted results are shown in {currency}.
      Inactive accounts with posted activity are included.
    </p>
  );
}

export function FinancialReportFeedback({ status, error, title, onRetry }: {
  status: string;
  error: string | null;
  title: string;
  onRetry: () => void;
}) {
  if (status === 'loading') return (
    <div className="space-y-4 border-t border-border p-4 dark:border-white/10">
      <p role="status" className="text-sm text-muted-foreground">Loading {title}...</p>
      {Array.from({ length: 4 }, (_, index) => <Skeleton key={index} className="h-8 w-full" />)}
    </div>
  );
  if (status !== 'error') return null;
  return (
    <div className="border-t border-border p-4 dark:border-white/10">
      <Alert variant="lighterror">
        <AlertTitle>Unable to load {title}</AlertTitle>
        <AlertDescription>
          <p>{error}</p>
          <Button type="button" variant="outlineerror" size="sm" className="mt-3" onClick={onRetry}>
            Try again
          </Button>
        </AlertDescription>
      </Alert>
    </div>
  );
}

export function FinancialReportTotals({ items, currency }: {
  items: { label: string; amount: ReportAmount; detail?: ReactNode }[];
  currency: string;
}) {
  return (
    <div className="grid gap-4 border-t border-border p-4 sm:grid-cols-3 dark:border-white/10">
      {items.map(({ label, amount, detail }) => (
        <section key={label} aria-label={label} className="min-w-0 rounded-lg border border-border p-4 dark:border-white/10">
          <h6 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</h6>
          <p className="mt-2 break-all text-lg font-semibold tabular-nums">{formatReportAmount(amount, currency)}</p>
          {detail && <div className="mt-2">{detail}</div>}
        </section>
      ))}
    </div>
  );
}

export function FinancialAccountTable({ title, lines, total, amountLabel, currency }: {
  title: string;
  lines: ProfitAndLossLine[];
  total: ReportAmount;
  amountLabel: string;
  currency: string;
}) {
  return (
    <section className="min-w-0 border-t border-border dark:border-white/10" aria-label={title}>
      <h5 className="p-4 text-base font-semibold">{title}</h5>
      <Table aria-label={`${title} accounts`}>
        <TableHeader>
          <TableRow>
            <TableHead className="min-w-[110px]">Code</TableHead>
            <TableHead className="min-w-[220px]">Account</TableHead>
            <TableHead className="min-w-[170px] text-right">{amountLabel}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {lines.length === 0 && (
            <TableRow><TableCell colSpan={3} className="p-6 text-center whitespace-normal text-muted-foreground">
              No {title.toLowerCase()} accounts with posted activity for this report.
            </TableCell></TableRow>
          )}
          {lines.map((line) => (
            <TableRow key={line.accountId}>
              <TableCell className="font-medium">{line.accountCode}</TableCell>
              <TableCell className="max-w-[400px] whitespace-normal break-words">{line.accountName}</TableCell>
              <TableCell className="text-right font-medium tabular-nums">{formatReportAmount(line.amount, currency)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
        <TableFooter><TableRow>
          <TableCell colSpan={2}>Total {title.toLowerCase()}</TableCell>
          <TableCell className="text-right tabular-nums">{formatReportAmount(total, currency)}</TableCell>
        </TableRow></TableFooter>
      </Table>
    </section>
  );
}
