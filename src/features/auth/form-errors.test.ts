import { describe, expect, it } from 'vitest';
import { ApiError } from 'src/lib/api/client';
import { toFormError } from './form-errors';

describe('toFormError', () => {
  it('uses safe backend validation messages and field errors', () => {
    const error = new ApiError('Validation failed', {
      kind: 'http',
      status: 400,
      fieldErrors: { email: 'must be valid' },
      data: { message: 'Validation failed', fieldErrors: { email: 'must be valid' } },
    });

    expect(toFormError(error, 'fallback')).toEqual({
      message: 'Validation failed',
      fieldErrors: { email: 'must be valid' },
    });
  });

  it('uses a connection message for network failures', () => {
    const error = new ApiError('Unable to reach the server.', { kind: 'network' });

    expect(toFormError(error, 'Invalid email or password.').message).toContain(
      'Unable to reach the server',
    );
  });

  it('hides server details and falls back for unknown failures', () => {
    const serverError = new ApiError('Internal Server Error', {
      kind: 'http',
      status: 500,
      data: { message: 'Internal details' },
    });

    expect(toFormError(serverError, 'Fallback message').message).toBe(
      'Something went wrong. Please try again.',
    );
    expect(toFormError(new Error('boom'), 'Fallback message').message).toBe('Fallback message');
  });
});
