import { ApiError } from 'src/lib/api/client';

export type ReportRequestAction =
  | 'load-accounts'
  | 'load-trial-balance'
  | 'load-profit-and-loss'
  | 'load-balance-sheet'
  | 'load-general-ledger';

function actionText(action: ReportRequestAction) {
  if (action === 'load-accounts') return 'load accounts';
  if (action === 'load-trial-balance') return 'load the trial balance';
  if (action === 'load-profit-and-loss') return 'load profit and loss';
  if (action === 'load-balance-sheet') return 'load the balance sheet';
  return 'load the general ledger';
}

export function getReportErrorMessage(
  error: unknown,
  action: ReportRequestAction,
): string {
  if (error instanceof ApiError) {
    if (error.kind === 'network') {
      return 'Unable to reach the server. Check your connection and try again.';
    }
    if (error.kind === 'parse') {
      return 'The server returned an unexpected response. Refresh and try again.';
    }
    if (error.status === 400) {
      return (
        error.message.trim() ||
        'Check the selected account and date range, then try again.'
      );
    }
    if (error.status === 401) {
      return 'Your session has expired. Please sign in again.';
    }
    if (error.status === 403) {
      return `You do not have permission to ${actionText(action)}.`;
    }
    if (error.status === 404) {
      return action === 'load-general-ledger'
        ? 'This account is no longer available. Refresh the accounts and try again.'
        : 'The requested report could not be found. Refresh and try again.';
    }
    if (error.status !== null && error.status >= 500) {
      return 'The report request could not be completed. Please try again.';
    }
    if (error.message.trim()) return error.message;
  }

  return `Unable to ${actionText(action)}. Please try again.`;
}
