import { useCallback, useEffect, useState } from 'react';
import CardBox from 'src/components/shared/CardBox';
import { Alert, AlertDescription, AlertTitle } from 'src/components/ui/alert';
import { Badge } from 'src/components/ui/badge';
import { useAuth } from 'src/features/auth/useAuth';
import { formatDateRange } from 'src/features/dashboard/formatters';
import BreadcrumbComp from 'src/layouts/full/shared/breadcrumb/BreadcrumbComp';
import { reportApi } from './api';
import { reportAmountUnits } from './amounts';
import { validateReportDateRange, yearToDateRange } from './dates';
import { FinancialAccountTable, FinancialReportFeedback, FinancialReportScope, FinancialReportTotals } from './FinancialReportParts';
import { ReportDateRangeForm } from './ReportDateRangeForm';
import type { ReportApi } from './types';
import { useReportRequest } from './useReportRequest';

export function ProfitAndLossPage({ api = reportApi }: { api?: Pick<ReportApi, 'profitAndLoss'> }) {
  const { user, organization } = useAuth();
  const currency = organization?.currency ?? 'USD';
  const [draft, setDraft] = useState(() => yearToDateRange(new Date(), organization?.timezone));
  const [range, setRange] = useState(draft);
  const [dateError, setDateError] = useState<string | null>(null);
  const request = useCallback((signal: AbortSignal) => api.profitAndLoss(range, signal), [api, range]);
  const { status, data, error, refresh } = useReportRequest(
    request, 'load-profit-and-loss', Boolean(organization), `${user?.id}:${organization?.id}`,
  );

  useEffect(() => {
    const next = yearToDateRange(new Date(), organization?.timezone);
    setDraft(next);
    setRange((current) => current.fromDate === next.fromDate && current.toDate === next.toDate ? current : next);
    setDateError(null);
  }, [organization?.id, organization?.timezone]);

  function applyDates() {
    const error = validateReportDateRange(draft.fromDate, draft.toDate);
    setDateError(error);
    if (error) return;
    if (draft.fromDate === range.fromDate && draft.toDate === range.toDate) refresh();
    else setRange({ ...draft });
  }

  function resetPeriod() {
    const next = yearToDateRange(new Date(), organization?.timezone);
    setDraft(next);
    setDateError(null);
    if (next.fromDate === range.fromDate && next.toDate === range.toDate) refresh();
    else setRange(next);
  }

  const hasLines = Boolean(data && (data.revenueLines.length || data.expenseLines.length));
  const profit = data ? reportAmountUnits(data.netProfit) : null;
  const empty = data && !hasLines && [data.totalRevenue, data.totalExpenses, data.netProfit].every((value) => reportAmountUnits(value) === 0n);

  return (
    <>
      <BreadcrumbComp title="Profit & Loss" items={[{ title: 'Dashboard', to: '/' }, { title: 'Profit & Loss' }]} />
      {!organization ? (
        <Alert variant="lighterror"><AlertTitle>No organization available</AlertTitle>
          <AlertDescription>Sign in with an organization account to view profit and loss.</AlertDescription>
        </Alert>
      ) : (
        <CardBox className="min-w-0 overflow-hidden">
          <div className="flex flex-col gap-3 p-5">
            <div>
              <h5 className="text-lg font-semibold">Profit &amp; loss (Income Statement)</h5>
              <p className="mt-1 text-sm text-muted-foreground">
                {formatDateRange(data?.fromDate ?? range.fromDate, data?.toDate ?? range.toDate)} · inclusive reporting period
              </p>
            </div>
            <p className="text-xs text-muted-foreground">
              Revenue and expenses come from posted journal entries, including manual journals.
              Revenue is credits minus debits; expenses are debits minus credits.
              These expenses are not limited to records in the Expenses screen.
            </p>
            <FinancialReportScope currency={currency} />
          </div>
          <ReportDateRangeForm fromDate={draft.fromDate} toDate={draft.toDate} error={dateError}
            onFromDateChange={(value) => setDraft((current) => ({ ...current, fromDate: value }))}
            onToDateChange={(value) => setDraft((current) => ({ ...current, toDate: value }))}
            onApply={applyDates} onYearToDate={resetPeriod} />
          <FinancialReportFeedback status={status} error={error} title="profit and loss" onRetry={refresh} />
          {data && (
            <>
              <FinancialReportTotals items={[
                { label: 'Total revenue', amount: data.totalRevenue },
                { label: 'Total expenses', amount: data.totalExpenses },
                { label: 'Net profit / loss', amount: data.netProfit, detail: hasLines && profit !== null
                  ? <Badge variant={profit < 0n ? 'lightError' : profit > 0n ? 'lightSuccess' : 'gray'}>
                    {profit < 0n ? 'Loss' : profit > 0n ? 'Profit' : 'Break-even'}
                  </Badge> : undefined },
              ]} currency={currency} />
              {empty && <p className="px-4 pb-4 text-sm text-muted-foreground">No posted revenue or expense activity in this date range.</p>}
              <FinancialAccountTable title="Revenue" lines={data.revenueLines} total={data.totalRevenue} amountLabel="Revenue amount" currency={currency} />
              <FinancialAccountTable title="Expenses" lines={data.expenseLines} total={data.totalExpenses} amountLabel="Expense amount" currency={currency} />
              <p className="border-t border-border p-4 text-xs text-muted-foreground dark:border-white/10">
                All account lines are shown. Totals and net profit are supplied by the backend for the complete period.
              </p>
            </>
          )}
        </CardBox>
      )}
    </>
  );
}
