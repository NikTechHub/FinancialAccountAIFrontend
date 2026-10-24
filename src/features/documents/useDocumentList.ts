import { useCallback, useEffect, useState } from 'react';
import type { PageResponse } from 'src/lib/api/types';
import { documentApi } from './api';
import { getDocumentErrorMessage, isAbortError } from './errors';
import type { DocumentRecord } from './types';

type DocumentListStatus = 'idle' | 'loading' | 'success' | 'error';

interface DocumentListState {
  status: DocumentListStatus;
  data: PageResponse<DocumentRecord> | null;
  error: string | null;
}

interface UseDocumentListOptions {
  enabled: boolean;
  page: number;
  size: number;
  filename: string;
  sort: string;
}

const idleState: DocumentListState = {
  status: 'idle',
  data: null,
  error: null,
};

export function useDocumentList({
  enabled,
  page,
  size,
  filename,
  sort,
}: UseDocumentListOptions) {
  const [state, setState] = useState<DocumentListState>(idleState);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    if (!enabled) {
      setState(idleState);
      return;
    }

    const controller = new AbortController();
    let active = true;
    setState((current) => ({ status: 'loading', data: current.data, error: null }));

    void (async () => {
      try {
        const data = await documentApi.list(
          { page, size, filename, sort },
          controller.signal,
        );
        if (!active) return;
        setState({ status: 'success', data, error: null });
      } catch (error) {
        if (!active || isAbortError(error)) return;
        setState({
          status: 'error',
          data: null,
          error: getDocumentErrorMessage(error, 'load'),
        });
      }
    })();

    return () => {
      active = false;
      controller.abort();
    };
  }, [enabled, page, size, filename, sort, reloadKey]);

  const refresh = useCallback(() => {
    setReloadKey((key) => key + 1);
  }, []);

  return { ...state, refresh };
}
