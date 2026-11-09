import { useCallback, useEffect, useState } from 'react';
import type { PageResponse } from 'src/lib/api/types';
import { reportApi } from './api';
import { getReportErrorMessage } from './errors';
import type { GeneralLedgerLine, ReportApi } from './types';

type GeneralLedgerStatus = 'idle' | 'loading' | 'success' | 'error';

interface GeneralLedgerState {
  status: GeneralLedgerStatus;
  data: PageResponse<GeneralLedgerLine> | null;
  error: string | null;
}

interface UseGeneralLedgerOptions {
  api?: ReportApi;
  enabled: boolean;
  accountId: string;
  fromDate: string;
  toDate: string;
  page: number;
  size: number;
}

const idleState: GeneralLedgerState = {
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

export function useGeneralLedger({
  api = reportApi,
  enabled,
  accountId,
  fromDate,
  toDate,
  page,
  size,
}: UseGeneralLedgerOptions) {
  const [state, setState] = useState<GeneralLedgerState>(idleState);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    if (!enabled || !accountId) {
      setState(idleState);
      return;
    }

    const controller = new AbortController();
    let active = true;

    setState({ status: 'loading', data: null, error: null });

    void (async () => {
      try {
        const data = await api.generalLedger(
          { accountId, fromDate, toDate, page, size },
          controller.signal,
        );
        if (!active) return;
        setState({ status: 'success', data, error: null });
      } catch (error) {
        if (!active || isAbortError(error)) return;
        setState({
          status: 'error',
          data: null,
          error: getReportErrorMessage(error, 'load-general-ledger'),
        });
      }
    })();

    return () => {
      active = false;
      controller.abort();
    };
  }, [api, enabled, accountId, fromDate, toDate, page, size, reloadKey]);

  const refresh = useCallback(() => {
    setReloadKey((key) => key + 1);
  }, []);

  return { ...state, refresh };
}
