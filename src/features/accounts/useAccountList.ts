import { useCallback, useEffect, useState } from 'react';
import type { PageResponse } from 'src/lib/api/types';
import { getAccountErrorMessage } from './errors';
import type { AccountApi, AccountListParams, AccountRecord } from './types';

export type AccountListStatus = 'idle' | 'loading' | 'success' | 'error';

interface AccountListState {
  status: AccountListStatus;
  data: PageResponse<AccountRecord> | null;
  error: string | null;
}

interface UseAccountListOptions {
  api: AccountApi;
  enabled: boolean;
  params: AccountListParams;
}

const idleState: AccountListState = {
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

export function useAccountList({
  api,
  enabled,
  params,
}: UseAccountListOptions) {
  const [state, setState] = useState<AccountListState>(idleState);
  const [reloadKey, setReloadKey] = useState(0);
  const { page, size, search, type, sort } = params;

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
        const data = await api.list(
          { page, size, search, type, sort },
          controller.signal,
        );
        if (!active) return;

        setState({ status: 'success', data, error: null });
      } catch (error) {
        if (!active || isAbortError(error)) return;

        setState({
          status: 'error',
          data: null,
          error: getAccountErrorMessage(error),
        });
      }
    })();

    return () => {
      active = false;
      controller.abort();
    };
  }, [api, enabled, page, size, search, type, sort, reloadKey]);

  const refresh = useCallback(() => {
    setReloadKey((key) => key + 1);
  }, []);

  return { ...state, refresh };
}
