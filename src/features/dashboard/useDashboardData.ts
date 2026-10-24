import { useCallback, useEffect, useState } from 'react';
import { fetchDashboard, fetchExpenseSummary, fetchInvoiceSummary } from './api';
import { getDashboardErrorMessage } from './errors';
import type {
  DashboardResponse,
  ExpenseSummaryResponse,
  InvoiceSummaryResponse,
} from './types';

export type DashboardDataStatus = 'idle' | 'loading' | 'success' | 'error';

export interface DashboardData {
  dashboard: DashboardResponse;
  expenses: ExpenseSummaryResponse;
  invoices: InvoiceSummaryResponse;
}

interface DashboardDataState {
  status: DashboardDataStatus;
  data: DashboardData | null;
  error: string | null;
}

interface UseDashboardDataOptions {
  organizationId: string | null;
  fromDate: string;
  toDate: string;
}

const idleState: DashboardDataState = {
  status: 'idle',
  data: null,
  error: null,
};

function isAbortError(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'name' in error &&
    error.name === 'AbortError'
  );
}

export function useDashboardData({ organizationId, fromDate, toDate }: UseDashboardDataOptions) {
  const [state, setState] = useState<DashboardDataState>(idleState);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    if (!organizationId) {
      setState(idleState);
      return;
    }

    const controller = new AbortController();
    let active = true;
    const query = { fromDate, toDate };

    setState({ status: 'loading', data: null, error: null });

    void (async () => {
      try {
        const [dashboard, expenses, invoices] = await Promise.all([
          fetchDashboard(query, controller.signal),
          fetchExpenseSummary(query, controller.signal),
          fetchInvoiceSummary(query, controller.signal),
        ]);

        if (!active) return;

        setState({
          status: 'success',
          data: { dashboard, expenses, invoices },
          error: null,
        });
      } catch (error) {
        if (!active || isAbortError(error)) return;

        setState({
          status: 'error',
          data: null,
          error: getDashboardErrorMessage(error),
        });
      }
    })();

    return () => {
      active = false;
      controller.abort();
    };
  }, [organizationId, fromDate, toDate, reloadKey]);

  const retry = useCallback(() => {
    setReloadKey((key) => key + 1);
  }, []);

  return { ...state, retry };
}
