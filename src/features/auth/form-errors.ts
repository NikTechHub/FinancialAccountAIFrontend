import { ApiError } from 'src/lib/api/client';

export interface FormErrorState {
  message: string;
  fieldErrors?: Record<string, string>;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function toFormError(error: unknown, fallbackMessage: string): FormErrorState {
  if (!(error instanceof ApiError)) {
    return { message: fallbackMessage };
  }

  if (error.kind === 'network') {
    return {
      message: 'Unable to reach the server. Check your connection and try again.',
    };
  }

  if (error.kind === 'parse') {
    return {
      message: 'The server returned an unexpected response. Please try again.',
    };
  }

  if (error.status !== null && error.status >= 500) {
    return { message: 'Something went wrong. Please try again.' };
  }

  if (error.status !== null && error.status >= 400 && error.status < 500) {
    const payload = error.data;
    const message =
      isRecord(payload) && typeof payload.message === 'string' && payload.message.trim()
        ? payload.message
        : fallbackMessage;

    return { message, fieldErrors: error.fieldErrors };
  }

  return { message: fallbackMessage };
}
