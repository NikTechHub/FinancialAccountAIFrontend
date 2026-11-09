import { useCallback, useEffect, useState } from 'react';
import CardBox from 'src/components/shared/CardBox';
import { Alert, AlertDescription, AlertTitle } from 'src/components/ui/alert';
import { Badge } from 'src/components/ui/badge';
import { useAuth } from 'src/features/auth/useAuth';
import BreadcrumbComp from 'src/layouts/full/shared/breadcrumb/BreadcrumbComp';
import { reportApi } from './api';
import { reconcileBalanceSheet, reportAmountUnits } from './amounts';
import { validateReportAsOfDate, yearToDateRange } from './dates';
import { formatReportAmount, formatReportDate } from './display';
import { FinancialAccountTable, FinancialReportFeedback, FinancialReportScope, FinancialReportTotals } from './FinancialReportParts';
import { ReportAsOfDateForm } from './ReportAsOfDateForm';
import type { ReportApi } from './types';
import { useReportRequest } from './useReportRequest';

export function BalanceSheetPage({ api = reportApi }: { api?: Pick<ReportApi, 'balanceSheet'> }) {
  const { user, organization } = useAuth();
  const [draftDate, setDraftDate] = useState(() => yearToDateRange(new Date(), organization?.timezone).toDate);
  const [asOfDate, setAsOfDate] = useState(draftDate);
  const [dateError, setDateError] = useState<string | null>(null);
  const request = useCallback((signal: AbortSignal) => api.balanceSheet({ asOfDate }, signal), [api, asOfDate]);
  const { status, data, error, refresh } = useReportRequest(
    request, 'load-balance-sheet', Boolean(organization), `${user?.id}:${organization?.id}`,
  );

  useEffect(() => {
    const next = yearToDateRange(new Date(), organization?.timezone).toDate;
    setDraftDate(next);
    setAsOfDate(next);
    setDateError(null);
  }, [organization?.id, organization?.timezone]);

  function applyDate() {
    const error = validateReportAsOfDate(draftDate);
    setDateError(error);
    if (error) return;
    if (draftDate === asOfDate) refresh();
    else setAsOfDate(draftDate);
  }

  function resetToday() {
    const next = yearToDateRange(new Date(), organization?.timezone).toDate;
    setDraftDate(next);
    setDateError(null);
    if (next === asOfDate) refresh();
    else setAsOfDate(next);
  }

  const hasLines = Boolean(data && (data.assetLines.length || data.liabilityLines.length || data.equityLines.length));
  const empty = data && !hasLines && [data.totalAssets, data.totalLiabilities, data.totalEquity].every((value) => reportAmountUnits(value) === 0n);
  const reconciliation = data ? reconcileBalanceSheet(data) : null;

  return (
    <>
      <BreadcrumbComp title="Balance Sheet" items={[{ title: 'Dashboard', to: '/' }, { title: 'Balance Sheet' }]} />
      {!organization ? (
        <Alert variant="lighterror"><AlertTitle>No organization available</AlertTitle>
          <AlertDescription>Sign in with an organization account to view the balance sheet.</AlertDescription>
        </Alert>
      ) : (
        <CardBox className="min-w-0 overflow-hidden">
          <div className="flex flex-col gap-3 p-5">
            <div>
              <h5 className="text-lg font-semibold">Balance sheet</h5>
              <p className="mt-1 text-sm text-muted-foreground">As of {formatReportDate(data?.asOfDate ?? asOfDate)} · inclusive</p>
            </div>
            <p className="text-xs text-muted-foreground">
              Posted journal balances on or before the as-of date. Assets use debits minus credits;
              liabilities and equity use credits minus debits. Draft and void entries are excluded.
            </p>
            <FinancialReportScope />
            <Alert variant="lightwarning">
              <AlertTitle>Equity calculation limitation</AlertTitle>
              <AlertDescription>
                Equity includes only EQUITY accounts. The backend does not automatically add retained earnings
                or current-period profit, apply closing entries, or supply opening balances.
                Assets may therefore differ from liabilities plus equity. Figures are shown as reported.
              </AlertDescription>
            </Alert>
          </div>
          <ReportAsOfDateForm value={draftDate} error={dateError} onChange={setDraftDate} onApply={applyDate} onToday={resetToday} />
          <FinancialReportFeedback status={status} error={error} title="balance sheet" onRetry={refresh} />
          {data && (
            <>
              <FinancialReportTotals items={[
                { label: 'Total assets', amount: data.totalAssets },
                { label: 'Total liabilities', amount: data.totalLiabilities },
                { label: 'Total equity', amount: data.totalEquity },
              ]} />
              {empty && <p className="px-4 pb-4 text-sm text-muted-foreground">No posted asset, liability or equity activity on or before this date.</p>}
              {reconciliation && (
                <section aria-label="Accounting equation" className="space-y-2 border-t border-border p-4 dark:border-white/10">
                  <h5 className="text-base font-semibold">Accounting equation</h5>
                  <p className="break-words text-sm">Assets: {formatReportAmount(data.totalAssets)} · Liabilities + equity: {formatReportAmount(reconciliation.liabilitiesAndEquity)}</p>
                  <p className="break-words text-sm">Difference (assets − liabilities − equity): <span className="font-semibold tabular-nums">{formatReportAmount(reconciliation.difference)}</span></p>
                  <Badge variant={empty ? 'gray' : reconciliation.balanced ? 'lightSuccess' : 'lightError'}>
                    {empty ? 'No activity' : reconciliation.balanced ? 'Balanced' : 'Discrepancy'}
                  </Badge>
                  <p className="text-xs text-muted-foreground">Reconciliation is calculated exactly from the complete reported totals. Account balances are not adjusted.</p>
                </section>
              )}
              <FinancialAccountTable title="Assets" lines={data.assetLines.map((line) => ({ ...line, amount: line.balance }))} total={data.totalAssets} amountLabel="Balance" />
              <FinancialAccountTable title="Liabilities" lines={data.liabilityLines.map((line) => ({ ...line, amount: line.balance }))} total={data.totalLiabilities} amountLabel="Balance" />
              <FinancialAccountTable title="Equity" lines={data.equityLines.map((line) => ({ ...line, amount: line.balance }))} total={data.totalEquity} amountLabel="Balance" />
              <p className="border-t border-border p-4 text-xs text-muted-foreground dark:border-white/10">
                All account lines are shown. Asset, liability and equity totals are supplied by the backend.
                No current/noncurrent classifications are provided.
              </p>
            </>
          )}
        </CardBox>
      )}
    </>
  );
}
