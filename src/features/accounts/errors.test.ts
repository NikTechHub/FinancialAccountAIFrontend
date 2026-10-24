import { describe, expect, it } from 'vitest';
import { ApiError } from 'src/lib/api/client';
import { getAccountErrorMessage } from './errors';

function apiError(status: number, message = 'Request failed'): ApiError {
  return new ApiError(message, { kind: 'http', status });
}

describe('account errors', () => {
  it('maps network and parse failures', () => {
    expect(
      getAccountErrorMessage(
        new ApiError('Network failed', { kind: 'network' }),
      ),
    ).toBe('Unable to reach the server. Check your connection and try again.');

    expect(
      getAccountErrorMessage(
        new ApiError('Invalid JSON', { kind: 'parse', status: 200 }),
      ),
    ).toBe(
      'The server returned an unexpected response. Refresh and try again.',
    );
  });

  it('maps authentication and permission failures', () => {
    expect(getAccountErrorMessage(apiError(401))).toBe(
      'Your session has expired. Please sign in again.',
    );
    expect(getAccountErrorMessage(apiError(403), 'create')).toBe(
      'You do not have permission to create accounts.',
    );
    expect(getAccountErrorMessage(apiError(403), 'load')).toBe(
      'You do not have permission to view the chart of accounts.',
    );
  });

  it('explains system-account deactivation failures', () => {
    expect(
      getAccountErrorMessage(
        apiError(403, 'Cannot deactivate system account'),
        'deactivate',
      ),
    ).toBe('System accounts cannot be deactivated.');
  });

  it('maps duplicate account codes', () => {
    expect(
      getAccountErrorMessage(
        apiError(409, 'Account already exists with code: 1000'),
        'create',
      ),
    ).toBe(
      'An account with this code already exists. Use a different code.',
    );
  });

  it('preserves backend validation and server-error messaging', () => {
    expect(
      getAccountErrorMessage(
        apiError(400, 'Parent account belongs to different organization'),
        'update',
      ),
    ).toBe('Parent account belongs to different organization');
    expect(getAccountErrorMessage(apiError(500), 'update')).toBe(
      'The account request could not be completed. Please try again.',
    );
  });
});
