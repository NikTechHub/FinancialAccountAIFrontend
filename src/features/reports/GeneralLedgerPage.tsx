import { useEffect, useState } from 'react';
import { Alert, AlertDescription, AlertTitle } from 'src/components/ui/alert';
import { Badge } from 'src/components/ui/badge';
import { Button } from 'src/components/ui/button';
import { Label } from 'src/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from 'src/components/ui/select';
import CardBox from 'src/components/shared/CardBox';
import { useAuth } from 'src/features/auth/useAuth';
import { accountTypeMeta } from 'src/features/accounts/display';
import { formatDateRange } from 'src/features/dashboard/formatters';
import BreadcrumbComp from 'src/layouts/full/shared/breadcrumb/BreadcrumbComp';
import { GeneralLedgerTable } from './GeneralLedgerTable';
import { ReportDateRangeForm } from './ReportDateRangeForm';
import { reportApi } from './api';
import { validateReportDateRange, yearToDateRange } from './dates';
import type { ReportApi, ReportDateRange } from './types';
import { useGeneralLedger } from './useGeneralLedger';
import { useReportAccounts } from './useReportAccounts';

interface GeneralLedgerPageProps {
  api?: ReportApi;
}

export function GeneralLedgerPage({ api = reportApi }: GeneralLedgerPageProps) {
  const { organization } = useAuth();
  const organizationId = organization?.id ?? null;
  const currency = organization?.currency ?? 'USD';

  const [draftRange, setDraftRange] = useState<ReportDateRange>(() =>
    yearToDateRange(new Date(), organization?.timezone),
  );
  const [range, setRange] = useState<ReportDateRange>(draftRange);
  const [dateError, setDateError] = useState<string | null>(null);
  const [accountId, setAccountId] = useState('');
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(20);

  const accountsState = useReportAccounts({
    api,
    organizationId,
    enabled: Boolean(organizationId),
  });
  const selectedAccount =
    accountsState.accounts.find((account) => account.id === accountId) ?? null;
  const reportEnabled =
    Boolean(organizationId) &&
    accountsState.status === 'success' &&
    Boolean(selectedAccount);

  const { status, data, error, refresh } = useGeneralLedger({
    api,
    enabled: reportEnabled,
    accountId,
    fromDate: range.fromDate,
    toDate: range.toDate,
    page,
    size: pageSize,
  });

  useEffect(() => {
    if (!organization?.id) return;
    const next = yearToDateRange(new Date(), organization.timezone);
    setDraftRange(next);
    setRange(next);
    setPage(0);
    setDateError(null);
  }, [organization?.id, organization?.timezone]);

  useEffect(() => {
    if (accountsState.status !== 'success') return;
    if (accountId && accountsState.accounts.some((account) => account.id === accountId)) {
      return;
    }
    setAccountId(accountsState.accounts[0]?.id ?? '');
    setPage(0);
  }, [accountsState.status, accountsState.accounts, accountId]);

  useEffect(() => {
    if (status !== 'success' || !data) return;
    if (data.totalPages === 0 && page > 0) {
      setPage(0);
    } else if (data.totalPages > 0 && page >= data.totalPages) {
      setPage(data.totalPages - 1);
    }
  }, [status, data, page]);

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
    setPage(0);
  }

  function resetToYearToDate() {
    const next = yearToDateRange(new Date(), organization?.timezone);
    setDraftRange(next);
    setRange(next);
    setDateError(null);
    setPage(0);
  }

  function handleAccountChange(value: string) {
    setAccountId(value);
    setPage(0);
  }

  function handlePageSizeChange(value: number) {
    setPageSize(value);
    setPage(0);
  }

  const isReportLoading =
    reportEnabled && (status === 'idle' || status === 'loading');
  const showAccountLoading =
    accountsState.status === 'idle' || accountsState.status === 'loading';

  return (
    <>
      <BreadcrumbComp
        title="General Ledger"
        items={[{ title: 'Dashboard', to: '/' }, { title: 'General Ledger' }]}
      />

      {!organization && (
        <Alert variant="lighterror">
          <AlertTitle>No organization available</AlertTitle>
          <AlertDescription>
            Sign in with an organization account to view the general ledger.
          </AlertDescription>
        </Alert>
      )}

      {organization && (
        <CardBox className="min-w-0 overflow-hidden">
          <div className="flex flex-col gap-3 p-5">
            <div>
              <h5 className="text-lg font-semibold">General ledger</h5>
              <p className="mt-1 text-sm text-muted-foreground">
                Posted journal lines for {organization.name} ·{' '}
                {formatDateRange(range.fromDate, range.toDate)} · amounts in {currency}
              </p>
            </div>
            <p className="text-xs text-muted-foreground">
              Only posted entries are included. Entries are ordered by date,
              entry number, then line. A running balance is not provided by the
              report API.
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

          <div className="border-t border-border p-4 dark:border-white/10">
            <div className="w-full max-w-md">
              <Label htmlFor="general-ledger-account">Account</Label>
              <Select
                value={accountId}
                onValueChange={handleAccountChange}
                disabled={showAccountLoading || accountsState.accounts.length === 0}
              >
                <SelectTrigger
                  id="general-ledger-account"
                  className="mt-1 w-full min-w-0 [&>span]:truncate"
                  aria-label="General ledger account"
                >
                  <SelectValue
                    placeholder={
                      showAccountLoading ? 'Loading accounts...' : 'Choose an account'
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  {accountsState.accounts.map((account) => (
                    <SelectItem key={account.id} value={account.id}>
                      {account.code} — {account.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="mt-1 text-xs text-muted-foreground">
                Active accounts only. Inactive accounts with historical activity
                are not available in this selector.
              </p>
            </div>
          </div>

          {showAccountLoading && (
            <div className="border-t border-border p-4 dark:border-white/10">
              <span role="status" className="text-sm text-muted-foreground">
                Loading accounts...
              </span>
            </div>
          )}

          {accountsState.status === 'error' && (
            <div className="border-t border-border p-4 dark:border-white/10">
              <Alert variant="lighterror">
                <AlertTitle>Unable to load accounts</AlertTitle>
                <AlertDescription>
                  <p>{accountsState.error}</p>
                  <Button
                    type="button"
                    variant="outlineerror"
                    size="sm"
                    className="mt-3"
                    onClick={accountsState.refresh}
                  >
                    Try again
                  </Button>
                </AlertDescription>
              </Alert>
            </div>
          )}

          {accountsState.status === 'success' &&
            accountsState.accounts.length === 0 && (
              <div className="border-t border-border p-4 dark:border-white/10">
                <Alert variant="lightwarning">
                  <AlertTitle>No active accounts</AlertTitle>
                  <AlertDescription>
                    No active accounts are available for {organization.name}.
                    Inactive accounts cannot be selected here.
                  </AlertDescription>
                </Alert>
              </div>
            )}

          {selectedAccount && (
            <div className="flex flex-col gap-2 border-t border-border p-4 sm:flex-row sm:items-center sm:justify-between dark:border-white/10">
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Account
                </p>
                <p className="mt-1 break-words font-medium">
                  {selectedAccount.code} — {selectedAccount.name}
                </p>
              </div>
              <Badge variant={accountTypeMeta[selectedAccount.type].variant}>
                {accountTypeMeta[selectedAccount.type].label}
              </Badge>
            </div>
          )}

          {status === 'error' && (
            <div className="border-t border-border p-4 dark:border-white/10">
              <Alert variant="lighterror">
                <AlertTitle>Unable to load general ledger</AlertTitle>
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

          {reportEnabled && status !== 'error' && (
            <div className="border-t border-border dark:border-white/10">
              <GeneralLedgerTable
                lines={status === 'success' ? (data?.content ?? []) : []}
                isLoading={isReportLoading}
                currency={currency}
                fromDate={range.fromDate}
                toDate={range.toDate}
                page={data?.number ?? page}
                pageSize={data?.size ?? pageSize}
                totalPages={data?.totalPages ?? 0}
                totalElements={data?.totalElements ?? 0}
                onPageChange={setPage}
                onPageSizeChange={handlePageSizeChange}
                onResetPeriod={resetToYearToDate}
              />
            </div>
          )}
        </CardBox>
      )}
    </>
  );
}
