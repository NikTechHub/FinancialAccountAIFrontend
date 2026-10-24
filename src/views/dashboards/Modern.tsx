import { useMemo, useState } from 'react';
import { TopCards } from 'src/components/dashboards/modern/TopCards';
import { RevenueUpdate } from 'src/components/dashboards/modern/RevenueUpdate';
import { ExpenseBreakdown } from 'src/components/dashboards/modern/ExpenseBreakdown';
import { InvoiceSummaryCard } from 'src/components/dashboards/modern/InvoiceSummaryCard';
import { PeriodSummary } from 'src/components/dashboards/modern/PeriodSummary';
import { VendorSpend } from 'src/components/dashboards/modern/VendorSpend';
import { Footer } from 'src/components/dashboards/modern/Footer';
import ProfileWelcome from 'src/components/dashboards/modern/ProfileWelcome';
import CardBox from 'src/components/shared/CardBox';
import { Alert, AlertDescription, AlertTitle } from 'src/components/ui/alert';
import { Button } from 'src/components/ui/button';
import { Skeleton } from 'src/components/ui/skeleton';
import { useAuth } from 'src/features/auth/useAuth';
import { createReportPeriod, type PeriodId } from 'src/features/dashboard/period';
import { useDashboardData } from 'src/features/dashboard/useDashboardData';

function DashboardLoading() {
  return (
    <>
      <span role="status" aria-live="polite" className="sr-only">
        Loading dashboard data
      </span>
      <div className="col-span-12 grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-7">
        {Array.from({ length: 7 }).map((_, index) => (
          <CardBox key={index} className="p-4">
            <Skeleton className="h-24 w-full" />
          </CardBox>
        ))}
      </div>
      <div className="lg:col-span-8 col-span-12 flex">
        <CardBox>
          <Skeleton className="h-[380px] w-full" />
        </CardBox>
      </div>
      <div className="lg:col-span-4 col-span-12">
        <CardBox>
          <Skeleton className="h-[220px] w-full" />
        </CardBox>
        <CardBox className="mt-6">
          <Skeleton className="h-[160px] w-full" />
        </CardBox>
      </div>
      <div className="lg:col-span-4 col-span-12">
        <CardBox>
          <Skeleton className="h-[360px] w-full" />
        </CardBox>
      </div>
      <div className="lg:col-span-8 col-span-12 flex">
        <CardBox>
          <Skeleton className="h-[360px] w-full" />
        </CardBox>
      </div>
    </>
  );
}

function DashboardError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="col-span-12">
      <Alert variant="lighterror">
        <AlertTitle>Unable to load dashboard</AlertTitle>
        <AlertDescription>
          <p>{message}</p>
          <Button
            type="button"
            variant="outlineerror"
            size="sm"
            className="mt-3"
            onClick={onRetry}
          >
            Try again
          </Button>
        </AlertDescription>
      </Alert>
    </div>
  );
}

const Moderndash = () => {
  const { organization } = useAuth();
  const [periodId, setPeriodId] = useState<PeriodId>('year');
  const period = useMemo(
    () => createReportPeriod(periodId, new Date(), organization?.timezone),
    [periodId, organization?.timezone],
  );
  const { status, data, error, retry } = useDashboardData({
    organizationId: organization?.id ?? null,
    fromDate: period.fromDate,
    toDate: period.toDate,
  });
  const currency = organization?.currency ?? 'USD';

  return (
    <>
      <div className="grid grid-cols-12 gap-6">
        <div className="col-span-12">
          <ProfileWelcome period={period} onPeriodChange={setPeriodId} />
        </div>

        {(status === 'idle' || status === 'loading') && <DashboardLoading />}

        {status === 'error' && (
          <DashboardError message={error ?? 'Unable to load dashboard data.'} onRetry={retry} />
        )}

        {status === 'success' && data && (
          <>
            <div className="col-span-12">
              <TopCards dashboard={data.dashboard} currency={currency} />
            </div>
            <div className="lg:col-span-8 col-span-12 flex">
              <RevenueUpdate
                dashboard={data.dashboard}
                currency={currency}
                periodLabel={period.label}
              />
            </div>
            <div className="lg:col-span-4 col-span-12">
              <ExpenseBreakdown expenses={data.expenses} currency={currency} />
              <InvoiceSummaryCard invoices={data.invoices} currency={currency} />
            </div>
            <div className="lg:col-span-4 col-span-12">
              <PeriodSummary
                dashboard={data.dashboard}
                currency={currency}
                periodLabel={period.label}
              />
            </div>
            <div className="lg:col-span-8 col-span-12 flex">
              <VendorSpend
                expenses={data.expenses}
                currency={currency}
                periodLabel={period.label}
              />
            </div>
          </>
        )}

        <div className="col-span-12">
          <Footer />
        </div>
      </div>
    </>
  );
};

export default Moderndash;
