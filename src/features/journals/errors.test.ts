import { describe, expect, it } from 'vitest';
import { ApiError } from 'src/lib/api/client';
import {
  getJournalEntryErrorMessage,
  journalEntryFieldErrors,
  mapJournalEntryFieldErrors,
} from './errors';

function apiError(
  status: number,
  message: string,
  fieldErrors?: Record<string, string>,
) {
  return new ApiError(message, {
    kind: 'http',
    status,
    fieldErrors,
    url: '/api/v1/journal-entries',
  });
}

describe('journal entry error messages', () => {
  it('maps 401, 403, 404, 409, and server errors truthfully', () => {
    expect(getJournalEntryErrorMessage(apiError(401, 'Unauthorized'))).toBe(
      'Your session has expired. Please sign in again.',
    );
    expect(getJournalEntryErrorMessage(apiError(403, 'Forbidden'), 'create')).toBe(
      'You do not have permission to create this journal entry.',
    );
    expect(getJournalEntryErrorMessage(apiError(404, 'Not found'))).toBe(
      'This journal entry no longer exists. Refresh the list and try again.',
    );
    expect(
      getJournalEntryErrorMessage(apiError(404, 'Not found'), 'lookup'),
    ).toBe(
      'One or more accounts are no longer available. Refresh the accounts and try again.',
    );
    expect(
      getJournalEntryErrorMessage(
        apiError(409, 'Entry is already VOID'),
        'void',
      ),
    ).toBe('Entry is already VOID');
    expect(getJournalEntryErrorMessage(apiError(500, 'Failed'))).toBe(
      'The journal entry request could not be completed. Please try again.',
    );
  });

  it('returns backend validation messages for 400 responses', () => {
    expect(
      getJournalEntryErrorMessage(
        apiError(400, 'Journal entry must have at least 2 lines'),
        'create',
      ),
    ).toBe('Journal entry must have at least 2 lines');
  });

  it('returns field errors and maps nested line errors', () => {
    const error = apiError(400, 'Validation failed', {
      entryNumber: 'entryNumber must not be blank',
      'lines[1].accountId': 'accountId must not be null',
      'lines[1].creditAmount': 'must be positive',
      lines: 'journal entry must have at least 2 lines',
      ignored: 'ignored',
    });

    expect(journalEntryFieldErrors(error)).toEqual({
      entryNumber: 'entryNumber must not be blank',
      'lines[1].accountId': 'accountId must not be null',
      'lines[1].creditAmount': 'must be positive',
      lines: 'journal entry must have at least 2 lines',
      ignored: 'ignored',
    });

    expect(mapJournalEntryFieldErrors(error)).toEqual({
      entryNumber: 'entryNumber must not be blank',
      lines: 'journal entry must have at least 2 lines',
      lineErrors: [
        undefined,
        {
          accountId: 'accountId must not be null',
          creditAmount: 'must be positive',
        },
      ],
    });
  });
});
