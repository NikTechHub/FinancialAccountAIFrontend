import { useCallback, useEffect, useState } from 'react';
import { getReportErrorMessage, type ReportRequestAction } from './errors';

export function useReportRequest<T>(
  request: (signal: AbortSignal) => Promise<T>,
  action: ReportRequestAction,
  enabled: boolean,
  scopeKey: string,
) {
  const [reloadKey, setReloadKey] = useState(0);
  const [state, setState] = useState<{
    status: 'loading' | 'success' | 'error';
    data: T | null;
    error: string | null;
    request: typeof request;
    scopeKey: string;
    reloadKey: number;
  } | null>(null);

  useEffect(() => {
    if (!enabled) return;
    const controller = new AbortController();
    let active = true;
    const identity = { request, scopeKey, reloadKey };
    setState({ ...identity, status: 'loading', data: null, error: null });
    void (async () => {
      try {
        const data = await request(controller.signal);
        if (active) setState({ ...identity, status: 'success', data, error: null });
      } catch (error) {
        if (!active || controller.signal.aborted) return;
        setState({ ...identity, status: 'error', data: null, error: getReportErrorMessage(error, action) });
      }
    })();
    return () => {
      active = false;
      controller.abort();
    };
  }, [request, action, enabled, scopeKey, reloadKey]);

  const refresh = useCallback(() => setReloadKey((key) => key + 1), []);
  // Also hide old data during the render before a changed request's effect runs.
  const current = enabled && state?.request === request && state.scopeKey === scopeKey && state.reloadKey === reloadKey
    ? state : null;
  return {
    status: current?.status ?? (enabled ? 'loading' : 'idle'),
    data: current?.data ?? null,
    error: current?.error ?? null,
    refresh,
  };
}
