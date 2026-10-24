import { ApiError } from 'src/lib/api/client';

export type AccountAction = 'load' | 'create' | 'update' | 'deactivate';

function actionText(action: AccountAction): string {
  if (action === 'create') return 'create accounts';
  if (action === 'update') return 'update this account';
  if (action === 'deactivate') return 'deactivate this account';
  return 'view the chart of accounts';
}

export function getAccountErrorMessage(
  error: unknown,
  action: AccountAction = 'load',
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
        'Please check the account details and try again.'
      );
    }

    if (error.status === 401) {
      return 'Your session has expired. Please sign in again.';
    }

    if (error.status === 403) {
      if (
        action === 'deactivate' &&
        error.message.toLowerCase().includes('system account')
      ) {
        return 'System accounts cannot be deactivated.';
      }
      return `You do not have permission to ${actionText(action)}.`;
    }

    if (error.status === 404) {
      return 'This account no longer exists. Refresh the list and try again.';
    }

    if (error.status === 409) {
      return 'An account with this code already exists. Use a different code.';
    }

    if (error.status !== null && error.status >= 500) {
      return 'The account request could not be completed. Please try again.';
    }

    if (error.message.trim()) return error.message;
  }

  return `Unable to ${actionText(action)}. Please try again.`;
}
