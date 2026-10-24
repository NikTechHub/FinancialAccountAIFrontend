import { useCallback, useEffect, useState } from 'react';
import type { PageResponse } from 'src/lib/api/types';
import { getPartyErrorMessage } from './errors';
import type { PartyApi, PartyLabels, PartyRecord } from './types';

export type PartyListStatus = 'idle' | 'loading' | 'success' | 'error';

interface PartyListState {
  status: PartyListStatus;
  data: PageResponse<PartyRecord> | null;
  error: string | null;
}

interface UsePartyListOptions {
  api: PartyApi;
  labels: PartyLabels;
  enabled: boolean;
  page: number;
  size: number;
  search: string;
  sort: string;
}

const idleState: PartyListState = {
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

export function usePartyList({
  api,
  labels,
  enabled,
  page,
  size,
  search,
  sort,
}: UsePartyListOptions) {
  const [state, setState] = useState<PartyListState>(idleState);
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
        const data = await api.list({ page, size, search, sort }, controller.signal);
        if (!active) return;

        setState({ status: 'success', data, error: null });
      } catch (error) {
        if (!active || isAbortError(error)) return;

        setState({
          status: 'error',
          data: null,
          error: getPartyErrorMessage(error, labels),
        });
      }
    })();

    return () => {
      active = false;
      controller.abort();
    };
  }, [api, labels, enabled, page, size, search, sort, reloadKey]);

  const refresh = useCallback(() => {
    setReloadKey((key) => key + 1);
  }, []);

  return { ...state, refresh };
}
