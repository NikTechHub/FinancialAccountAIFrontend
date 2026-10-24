import { ApiError } from 'src/lib/api/client';
import type { InvoiceAction } from './types';

export type InvoiceRequestAction = 'load' | 'create' | 'update' | InvoiceAction;

function actionText(action: InvoiceRequestAction) {
  if (action === 'create') return 'save this invoice';
  if (action === 'update') return 'update this invoice';
  if (action === 'issue') return 'issue this invoice';
  if (action === 'void') return 'void this invoice';
  return 'load invoices';
}

export function getInvoiceErrorMessage(
  error: unknown,
  action: InvoiceRequestAction = 'load',
) {
  if (error instanceof ApiError) {
    if (error.kind === 'network') {
      return 'Unable to reach the server. Check your connection and try again.';
    }
    if (error.kind === 'parse') {
      return 'The server returned an unexpected response. Refresh and try again.';
    }
    if (error.status === 400) {
      return error.message.trim() || 'Please check the invoice details and try again.';
    }
    if (error.status === 401) {
      return 'Your session has expired. Please sign in again.';
    }
    if (error.status === 403) {
      return `You do not have permission to ${actionText(action)}.`;
    }
    if (error.status === 404) {
      return 'This invoice no longer exists. Refresh the list and try again.';
    }
    if (error.status === 409) {
      if (error.message.toLowerCase().includes('already exists')) {
        return 'An invoice with this number already exists. Use a different invoice number.';
      }
      return (
        error.message.trim() ||
        'This invoice changed or can no longer be modified. Refresh and try again.'
      );
    }
    if (error.status !== null && error.status >= 500) {
      return 'The invoice request could not be completed. Please try again.';
    }
    if (error.message.trim()) return error.message;
  }

  return `Unable to ${actionText(action)}. Please try again.`;
}

export function invoiceFieldErrors(error: unknown): Record<string, string> {
  if (!(error instanceof ApiError) || !error.fieldErrors) return {};

  return Object.fromEntries(
    Object.entries(error.fieldErrors).map(([field, message]) => [
      field.replace(/\[(\d+)\]/g, '.$1'),
      message,
    ]),
  );
}
