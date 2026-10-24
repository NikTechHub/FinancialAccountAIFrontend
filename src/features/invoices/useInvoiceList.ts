import { useCallback, useEffect, useState } from 'react';
import type { PageResponse } from 'src/lib/api/types';
import { invoiceApi } from './api';
import { getInvoiceErrorMessage } from './errors';
import type { InvoiceListParams, InvoiceRecord } from './types';

type InvoiceListStatus = 'idle' | 'loading' | 'success' | 'error';

interface InvoiceListState {
  status: InvoiceListStatus;
  data: PageResponse<InvoiceRecord> | null;
  error: string | null;
}

type UseInvoiceListOptions = InvoiceListParams & { enabled: boolean };

const idleState: InvoiceListState = {
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

export function useInvoiceList(options: UseInvoiceListOptions) {
  const [state, setState] = useState<InvoiceListState>(idleState);
  const [reloadKey, setReloadKey] = useState(0);
  const {
    enabled,
    page,
    size,
    status: statusFilter,
    customerId,
    invoiceNumber,
    invoiceDate,
    dueDate,
    sort,
  } = options;

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
        const data = await invoiceApi.list(
          {
            page,
            size,
            status: statusFilter,
            customerId,
            invoiceNumber,
            invoiceDate,
            dueDate,
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
          error: getInvoiceErrorMessage(error, 'load'),
        });
      }
    })();

    return () => {
      active = false;
      controller.abort();
    };
  }, [
    enabled,
    page,
    size,
    statusFilter,
    customerId,
    invoiceNumber,
    invoiceDate,
    dueDate,
    sort,
    reloadKey,
  ]);

  const refresh = useCallback(() => {
    setReloadKey((key) => key + 1);
  }, []);

  return { ...state, refresh };
}
