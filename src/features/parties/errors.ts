import { ApiError } from 'src/lib/api/client';
import type { PartyLabels } from './types';

export type PartyAction = 'load' | 'create' | 'update' | 'deactivate';

function actionText(action: PartyAction, labels: PartyLabels): string {
  if (action === 'create') return `create ${labels.lowerPlural}`;
  if (action === 'update') return `update ${labels.lowerPlural}`;
  if (action === 'deactivate') return `deactivate ${labels.lowerPlural}`;
  return `view ${labels.lowerPlural}`;
}

export function getPartyErrorMessage(
  error: unknown,
  labels: PartyLabels,
  action: PartyAction = 'load',
): string {
  if (error instanceof ApiError) {
    if (error.kind === 'network') {
      return 'Unable to reach the server. Check your connection and try again.';
    }

    if (error.kind === 'parse') {
      return 'The server returned an unexpected response. Please try again.';
    }

    if (error.status === 400) {
      return `Please correct the highlighted fields and try again.`;
    }

    if (error.status === 401) {
      return 'Your session has expired. Please sign in again.';
    }

    if (error.status === 403) {
      return `You do not have permission to ${actionText(action, labels)}.`;
    }

    if (error.status === 404) {
      return `This ${labels.lowerSingular} no longer exists. Refresh the list and try again.`;
    }

    if (error.status === 409) {
      return `A ${labels.lowerSingular} with this name already exists.`;
    }

    if (error.status !== null && error.status >= 500) {
      return 'Something went wrong. Please try again.';
    }

    if (error.message.trim()) return error.message;
  }

  return `Unable to ${actionText(action, labels)}. Please try again.`;
}
