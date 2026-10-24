import { ApiError } from 'src/lib/api/client';

export function getDashboardErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.kind === 'network') {
      return 'Unable to reach the server. Check your connection and try again.';
    }

    if (error.kind === 'parse') {
      return 'The server returned an unexpected response. Please try again.';
    }

    if (error.status === 401) {
      return 'Your session has expired. Please sign in again.';
    }

    if (error.status === 403) {
      return 'You do not have permission to view reports for this organization.';
    }

    if (error.status !== null && error.status >= 500) {
      return 'Something went wrong. Please try again.';
    }
  }

  return 'Unable to load dashboard data. Please try again.';
}
