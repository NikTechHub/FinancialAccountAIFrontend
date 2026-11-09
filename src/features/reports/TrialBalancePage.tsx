import { useEffect, useState } from 'react';
import { Alert, AlertDescription, AlertTitle } from 'src/components/ui/alert';
import { Button } from 'src/components/ui/button';
import CardBox from 'src/components/shared/CardBox';
import { useAuth } from 'src/features/auth/useAuth';
import { formatDateRange } from 'src/features/dashboard/formatters';
import BreadcrumbComp from 'src/layouts/full/shared/breadcrumb/BreadcrumbComp';
import { ReportDateRangeForm } from './ReportDateRangeForm';
import { TrialBalanceTable } from './TrialBalanceTable';
import { reportApi } from './api';
import { validateReportDateRange, yearToDateRange } from './dates';
import type { ReportApi, ReportDateRange } from './types';
import { useTrialBalance } from './useTrialBalance';

interface TrialBalancePageProps {
  api?: ReportApi;
}

export function TrialBalancePage({ api = reportApi }: TrialBalancePageProps) {
  const { organization } = useAuth();

  const [draftRange, setDraftRange] = useState<ReportDateRange>(() =>
    yearToDateRange(new Date(), organization?.timezone),
  );
  const [range, setRange] = useState<ReportDateRange>(draftRange);
  const [dateError, setDateError] = useState<string | null>(null);

  const { status, data, error, refresh } = useTrialBalance({
    api,
    enabled: Boolean(organization?.id),
    fromDate: range.fromDate,
    toDate: range.toDate,
  });

  useEffect(() => {
    if (!organization?.id) return;
    const next = yearToDateRange(new Date(), organization.timezone);
    setDraftRange(next);
    setRange(next);
    setDateError(null);
  }, [organization?.id, organization?.timezone]);

  function applyRange() {
    const nextError = validateReportDateRange(
      draftRange.fromDate,
      draftRange.toDate,
    );
    if (nextError) {
      setDateError(nextError);
      return;
    }

    setDateError(null);
    setRange({ ...draftRange });
  }

  function resetToYearToDate() {
    const next = yearToDateRange(new Date(), organization?.timezone);
    setDraftRange(next);
    setRange(next);
    setDateError(null);
  }

  const isLoading = status === 'idle' || status === 'loading';

  return (
    <>
      <BreadcrumbComp
        title="Trial Balance"
        items={[{ title: 'Dashboard', to: '/' }, { title: 'Trial Balance' }]}
      />

      {!organization && (
        <Alert variant="lighterror">
          <AlertTitle>No organization available</AlertTitle>
          <AlertDescription>
            Sign in with an organization account to view the trial balance.
          </AlertDescription>
        </Alert>
      )}

      {organization && (
        <CardBox className="min-w-0 overflow-hidden">
          <div className="flex flex-col gap-3 p-5">
            <div>
              <h5 className="text-lg font-semibold">Trial balance</h5>
              <p className="mt-1 text-sm text-muted-foreground">
                Posted journal activity across all your organizations ·{' '}
                {formatDateRange(data?.fromDate ?? range.fromDate, data?.toDate ?? range.toDate)}
              </p>
            </div>
            <p className="text-xs text-muted-foreground">
              Only posted entries are included. Accounts appear when they have
              posted activity in the selected range, including inactive accounts.
              Debits and credits are activity totals for this period, not closing
              debit and credit balances.
            </p>
            <p className="text-xs text-muted-foreground">
              This report includes every organization you belong to. It cannot be
              filtered to {organization.name}. Amounts are returned without currency
              labels or conversion; if your organizations use different currencies,
              these totals are not a consolidated balance in a single currency.
            </p>
          </div>

          <ReportDateRangeForm
            fromDate={draftRange.fromDate}
            toDate={draftRange.toDate}
            error={dateError}
            onFromDateChange={(value) =>
              setDraftRange((current) => ({ ...current, fromDate: value }))
            }
            onToDateChange={(value) =>
              setDraftRange((current) => ({ ...current, toDate: value }))
            }
            onApply={applyRange}
            onYearToDate={resetToYearToDate}
          />

          {status === 'error' && (
            <div className="border-t border-border p-4 dark:border-white/10">
              <Alert variant="lighterror">
                <AlertTitle>Unable to load trial balance</AlertTitle>
                <AlertDescription>
                  <p>{error}</p>
                  <Button
                    type="button"
                    variant="outlineerror"
                    size="sm"
                    className="mt-3"
                    onClick={refresh}
                  >
                    Try again
                  </Button>
                </AlertDescription>
              </Alert>
            </div>
          )}

          {status !== 'error' && (
            <TrialBalanceTable
              data={status === 'success' ? data : null}
              isLoading={isLoading}
              onResetPeriod={resetToYearToDate}
            />
          )}
        </CardBox>
      )}
    </>
  );
}
