import { useCallback, useEffect, useState } from 'react';
import { reportApi } from './api';
import { getReportErrorMessage } from './errors';
import type { ReportApi, TrialBalanceResponse } from './types';

type TrialBalanceStatus = 'idle' | 'loading' | 'success' | 'error';

interface TrialBalanceState {
  status: TrialBalanceStatus;
  data: TrialBalanceResponse | null;
  error: string | null;
}

interface UseTrialBalanceOptions {
  api?: ReportApi;
  enabled: boolean;
  fromDate: string;
  toDate: string;
}

const idleState: TrialBalanceState = {
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

export function useTrialBalance({
  api = reportApi,
  enabled,
  fromDate,
  toDate,
}: UseTrialBalanceOptions) {
  const [state, setState] = useState<TrialBalanceState>(idleState);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    if (!enabled) {
      setState(idleState);
      return;
    }

    const controller = new AbortController();
    let active = true;

    setState({ status: 'loading', data: null, error: null });

    void (async () => {
      try {
        const data = await api.trialBalance(
          { fromDate, toDate },
          controller.signal,
        );
        if (!active) return;
        setState({ status: 'success', data, error: null });
      } catch (error) {
        if (!active || isAbortError(error)) return;
        setState({
          status: 'error',
          data: null,
          error: getReportErrorMessage(error, 'load-trial-balance'),
        });
      }
    })();

    return () => {
      active = false;
      controller.abort();
    };
  }, [api, enabled, fromDate, toDate, reloadKey]);

  const refresh = useCallback(() => {
    setReloadKey((key) => key + 1);
  }, []);

  return { ...state, refresh };
}
