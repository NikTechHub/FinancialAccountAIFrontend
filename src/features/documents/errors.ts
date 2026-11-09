import { ApiError } from 'src/lib/api/client';

export type DocumentRequestAction =
  | 'load'
  | 'upload'
  | 'download'
  | 'delete'
  | 'ocr'
  | 'extraction'
  | 'review';

function actionText(action: DocumentRequestAction) {
  if (action === 'upload') return 'upload this document';
  if (action === 'download') return 'download this document';
  if (action === 'delete') return 'delete this document';
  if (action === 'ocr') return 'start OCR processing';
  if (action === 'extraction') return 'extract document data';
  if (action === 'review') return 'update this review';
  return 'load documents';
}

export function getDocumentErrorMessage(
  error: unknown,
  action: DocumentRequestAction = 'load',
) {
  if (error instanceof ApiError) {
    if (error.kind === 'network') {
      return 'Unable to reach the server. Check your connection and try again.';
    }
    if (error.kind === 'parse') {
      return 'The server returned an unexpected response. Refresh and try again.';
    }
    if (error.status === 400) {
      return error.message.trim() || 'Please check the document and try again.';
    }
    if (error.status === 401) {
      return 'Your session has expired. Please sign in again.';
    }
    if (error.status === 403) {
      return `You do not have permission to ${actionText(action)}.`;
    }
    if (error.status === 404) {
      return action === 'load'
        ? 'This document no longer exists. Refresh the list and try again.'
        : 'The requested document or processing result was not found.';
    }
    if (error.status === 409) {
      return (
        error.message.trim() ||
        'This document is in a state that cannot perform that action. Refresh and try again.'
      );
    }
    if (error.status === 413) {
      return 'The document is larger than the 10 MB upload limit.';
    }
    if (error.status === 415) {
      return 'That file type is not supported. Upload a PDF, JPEG, PNG, or WebP document.';
    }
    if (error.status === 503) {
      const knownQueueErrors = new Set([
        'Kafka is disabled. No OCR job was queued; enable the processing queue and retry.',
        'Kafka is disabled. No extraction job was queued; enable the processing queue and retry.',
        'Could not confirm that the OCR job reached Kafka. Refresh the document status, check Kafka, then retry.',
        'Could not confirm that the extraction job reached Kafka. Refresh the document status, check Kafka, then retry.',
      ]);
      if (knownQueueErrors.has(error.message.trim())) return error.message.trim();
      return 'Document processing is temporarily unavailable. Please try again later.';
    }
    if (error.status !== null && error.status >= 500) {
      if (action === 'ocr' || action === 'extraction') {
        return `The server could not complete the request to ${actionText(action)}. Refresh this document's status before retrying.`;
      }
      return `The server could not ${actionText(action)}. Refresh the document and retry if the action is still available.`;
    }
    if (error.message.trim()) return error.message;
  }

  return `Unable to ${actionText(action)}. Please try again.`;
}

export function isNotFound(error: unknown) {
  return error instanceof ApiError && error.status === 404;
}

export function isAbortError(error: unknown) {
  return (
    typeof error === 'object' &&
    error !== null &&
    'name' in error &&
    error.name === 'AbortError'
  );
}
