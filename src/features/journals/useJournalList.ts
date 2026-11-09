import { useCallback, useEffect, useState } from 'react';
import type { PageResponse } from 'src/lib/api/types';
import { journalEntryApi } from './api';
import { getJournalEntryErrorMessage } from './errors';
import type {
  JournalEntryApi,
  JournalEntryRecord,
  JournalEntryStatus,
} from './types';

type JournalListStatus = 'idle' | 'loading' | 'success' | 'error';

interface JournalListState {
  status: JournalListStatus;
  data: PageResponse<JournalEntryRecord> | null;
  error: string | null;
}

interface UseJournalListOptions {
  api?: JournalEntryApi;
  enabled: boolean;
  page: number;
  size: number;
  status: JournalEntryStatus | '';
  entryDate: string;
  entryNumber: string;
  reference: string;
  sort: string;
}

const idleState: JournalListState = {
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

export function useJournalList({
  api = journalEntryApi,
  enabled,
  page,
  size,
  status,
  entryDate,
  entryNumber,
  reference,
  sort,
}: UseJournalListOptions) {
  const [state, setState] = useState<JournalListState>(idleState);
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
        const data = await api.list(
          {
            page,
            size,
            status,
            entryDate,
            entryNumber,
            reference,
            sort,
          },
          controller.signal,
        );
        if (!active) return;

        setState({ status: 'success', data, error: null });
      } catch (error) {
        if (!active || isAbortError(error)) return;

        setState({
          status: 'error',
          data: null,
          error: getJournalEntryErrorMessage(error, 'load'),
        });
      }
    })();

    return () => {
      active = false;
      controller.abort();
    };
  }, [
    api,
    enabled,
    page,
    size,
    status,
    entryDate,
    entryNumber,
    reference,
    sort,
    reloadKey,
  ]);

  const refresh = useCallback(() => {
    setReloadKey((key) => key + 1);
  }, []);

  return { ...state, refresh };
}
