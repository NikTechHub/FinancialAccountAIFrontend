import { ApiError } from 'src/lib/api/client';
import type { ExpenseAction } from './types';

export type ExpenseRequestAction = 'load' | 'create' | 'update' | ExpenseAction;

function actionText(action: ExpenseRequestAction) {
  if (action === 'create') return 'save this expense';
  if (action === 'update') return 'update this expense';
  if (action === 'record') return 'record this expense';
  if (action === 'void') return 'void this expense';
  return 'load expenses';
}

export function getExpenseErrorMessage(
  error: unknown,
  action: ExpenseRequestAction = 'load',
) {
  if (error instanceof ApiError) {
    if (error.kind === 'network') {
      return 'Unable to reach the server. Check your connection and try again.';
    }
    if (error.kind === 'parse') {
      return 'The server returned an unexpected response. Refresh and try again.';
    }
    if (error.status === 400) {
      return error.message.trim() || 'Please check the expense details and try again.';
    }
    if (error.status === 401) {
      return 'Your session has expired. Please sign in again.';
    }
    if (error.status === 403) {
      return `You do not have permission to ${actionText(action)}.`;
    }
    if (error.status === 404) {
      return 'This expense no longer exists. Refresh the list and try again.';
    }
    if (error.status === 409) {
      return (
        error.message.trim() ||
        'This expense changed or can no longer be modified. Refresh and try again.'
      );
    }
    if (error.status !== null && error.status >= 500) {
      return 'The expense request could not be completed. Please try again.';
    }
    if (error.message.trim()) return error.message;
  }

  return `Unable to ${actionText(action)}. Please try again.`;
}

export function expenseFieldErrors(error: unknown) {
  return error instanceof ApiError ? error.fieldErrors ?? {} : {};
}
