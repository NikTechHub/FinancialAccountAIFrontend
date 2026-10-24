import { useCallback, useEffect, useState } from 'react';
import type { PageResponse } from 'src/lib/api/types';
import { expenseApi } from './api';
import { getExpenseErrorMessage } from './errors';
import type { ExpenseRecord, ExpenseStatus } from './types';

type ExpenseListStatus = 'idle' | 'loading' | 'success' | 'error';

interface ExpenseListState {
  status: ExpenseListStatus;
  data: PageResponse<ExpenseRecord> | null;
  error: string | null;
}

interface UseExpenseListOptions {
  enabled: boolean;
  page: number;
  size: number;
  search: string;
  status: ExpenseStatus | '';
  sort: string;
}

const idleState: ExpenseListState = {
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

export function useExpenseList({
  enabled,
  page,
  size,
  search,
  status,
  sort,
}: UseExpenseListOptions) {
  const [state, setState] = useState<ExpenseListState>(idleState);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    if (!enabled) {
      setState(idleState);
      return;
    }

    const controller = new AbortController();
    let active = true;

    setState((current) => ({
      status: 'loading',
      data: current.data,
      error: null,
    }));

    void (async () => {
      try {
        const data = await expenseApi.list(
          { page, size, reference: search, status, sort },
          controller.signal,
        );
        if (!active) return;

        setState({ status: 'success', data, error: null });
      } catch (error) {
        if (!active || isAbortError(error)) return;

        setState({
          status: 'error',
          data: null,
          error: getExpenseErrorMessage(error, 'load'),
        });
      }
    })();

    return () => {
      active = false;
      controller.abort();
    };
  }, [enabled, page, size, search, status, sort, reloadKey]);

  const refresh = useCallback(() => {
    setReloadKey((key) => key + 1);
  }, []);

  return { ...state, refresh };
}
