import { ApiError } from 'src/lib/api/client';
import type { JournalEntryFormErrors, JournalEntryLineErrors } from './validation';

export type JournalEntryRequestAction =
  | 'load'
  | 'create'
  | 'update'
  | 'post'
  | 'void'
  | 'lookup';

function actionText(action: JournalEntryRequestAction) {
  if (action === 'create') return 'create this journal entry';
  if (action === 'update') return 'update this journal entry';
  if (action === 'post') return 'post this journal entry';
  if (action === 'void') return 'void this journal entry';
  if (action === 'lookup') return 'load accounts';
  return 'load journal entries';
}

export function getJournalEntryErrorMessage(
  error: unknown,
  action: JournalEntryRequestAction = 'load',
): string {
  if (error instanceof ApiError) {
    if (error.kind === 'network') {
      return 'Unable to reach the server. Check your connection and try again.';
    }
    if (error.kind === 'parse') {
      return 'The server returned an unexpected response. Refresh and try again.';
    }
    if (error.status === 400) {
      return error.message.trim() || 'Please check the journal entry details and try again.';
    }
    if (error.status === 401) {
      return 'Your session has expired. Please sign in again.';
    }
    if (error.status === 403) {
      return `You do not have permission to ${actionText(action)}.`;
    }
    if (error.status === 404) {
      return action === 'lookup'
        ? 'One or more accounts are no longer available. Refresh the accounts and try again.'
        : 'This journal entry no longer exists. Refresh the list and try again.';
    }
    if (error.status === 409) {
      return (
        error.message.trim() ||
        'This journal entry changed or can no longer be modified. Refresh and try again.'
      );
    }
    if (error.status !== null && error.status >= 500) {
      return 'The journal entry request could not be completed. Please try again.';
    }
    if (error.message.trim()) return error.message;
  }
  return `Unable to ${actionText(action)}. Please try again.`;
}

export function journalEntryFieldErrors(error: unknown) {
  return error instanceof ApiError ? error.fieldErrors ?? {} : {};
}

const LINE_FIELD_PATTERN = /^lines\[(\d+)\]\.(accountId|description|debitAmount|creditAmount)$/;
const HEADER_FIELDS = new Set([
  'entryNumber',
  'entryDate',
  'description',
  'reference',
]);

export function mapJournalEntryFieldErrors(
  error: unknown,
): JournalEntryFormErrors {
  const serverErrors = journalEntryFieldErrors(error);
  const result: JournalEntryFormErrors = {};
  const lineErrors: JournalEntryLineErrors[] = [];

  for (const [field, message] of Object.entries(serverErrors)) {
    const lineMatch = LINE_FIELD_PATTERN.exec(field);
    if (lineMatch) {
      const index = Number(lineMatch[1]);
      const lineField = lineMatch[2] as keyof JournalEntryLineErrors;
      const entry = lineErrors[index] ?? {};
      entry[lineField] = message;
      lineErrors[index] = entry;
      continue;
    }

    if (field === 'lines') {
      result.lines = message;
      continue;
    }

    if (HEADER_FIELDS.has(field)) {
      result[field as 'entryNumber' | 'entryDate' | 'description' | 'reference'] =
        message;
    }
  }

  if (lineErrors.some(Boolean)) result.lineErrors = lineErrors;
  return result;
}
