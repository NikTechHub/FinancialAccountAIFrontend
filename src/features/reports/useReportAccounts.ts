import { useCallback, useEffect, useState } from 'react';
import { reportApi } from './api';
import { getReportErrorMessage } from './errors';
import type { ReportAccount, ReportApi } from './types';

type ReportAccountsStatus = 'idle' | 'loading' | 'success' | 'error';

interface ReportAccountsState {
  status: ReportAccountsStatus;
  accounts: ReportAccount[];
  error: string | null;
}

interface UseReportAccountsOptions {
  api?: ReportApi;
  organizationId: string | null;
  enabled: boolean;
}

const idleState: ReportAccountsState = {
  status: 'idle',
  accounts: [],
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

export function useReportAccounts({
  api = reportApi,
  organizationId,
  enabled,
}: UseReportAccountsOptions) {
  const [state, setState] = useState<ReportAccountsState>(idleState);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    if (!enabled || !organizationId) {
      setState(idleState);
      return;
    }

    const controller = new AbortController();
    let active = true;

    setState({ status: 'loading', accounts: [], error: null });

    void (async () => {
      try {
        const accounts = await api.activeAccounts(organizationId, controller.signal);
        if (!active) return;
        setState({ status: 'success', accounts, error: null });
      } catch (error) {
        if (!active || isAbortError(error)) return;
        setState({
          status: 'error',
          accounts: [],
          error: getReportErrorMessage(error, 'load-accounts'),
        });
      }
    })();

    return () => {
      active = false;
      controller.abort();
    };
  }, [api, enabled, organizationId, reloadKey]);

  const refresh = useCallback(() => {
    setReloadKey((key) => key + 1);
  }, []);

  return { ...state, refresh };
}
