import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { applyAuthResponse, clearSession, setTokenStorage } from 'src/lib/api/session';
import { createMemoryTokenStorage, type TokenStorage } from 'src/lib/auth/token-storage';
import type { PageResponse } from 'src/lib/api/types';
import {
  createFetchMock,
  jsonResponse,
  makeAuthResponse,
  testOrganization,
  testUser,
} from 'src/test/api-fixtures';
import { journalEntryApi } from './api';
import type {
  AccountOption,
  CreateJournalEntryInput,
  JournalEntryRecord,
} from './types';

const entryId = '55555555-5555-5555-5555-555555555555';
const accountId = '66666666-6666-6666-6666-666666666666';

function makeEntry(
  overrides: Partial<JournalEntryRecord> = {},
): JournalEntryRecord {
  return {
    id: entryId,
    organizationId: testOrganization.id,
    organizationName: testOrganization.name,
    entryNumber: 'JE-1001',
    entryDate: '2026-10-25',
    description: 'Monthly accrual',
    reference: 'ACCR-10',
    status: 'DRAFT',
    createdBy: testUser.id,
    createdByEmail: testUser.email,
    createdAt: '2026-10-25T12:00:00Z',
    updatedAt: '2026-10-25T12:00:00Z',
    lines: [
      {
        id: 'line-1',
        accountId,
        accountCode: '1000',
        accountName: 'Cash',
        description: 'Debit',
        debitAmount: 100,
        creditAmount: 0,
      },
      {
        id: 'line-2',
        accountId: '77777777-7777-7777-7777-777777777777',
        accountCode: '4000',
        accountName: 'Revenue',
        description: null,
        debitAmount: 0,
        creditAmount: 100,
      },
    ],
    totalDebits: 100,
    totalCredits: 100,
    ...overrides,
  };
}

function makePage<T>(content: T[], page = 0, size = 10): PageResponse<T> {
  const totalPages = content.length ? Math.ceil(content.length / size) : 0;
  return {
    content,
    totalElements: content.length,
    totalPages,
    number: page,
    size,
    first: page === 0,
    last: page + 1 >= totalPages,
    numberOfElements: content.length,
    empty: content.length === 0,
  };
}

function makeAccount(overrides: Partial<AccountOption> = {}): AccountOption {
  return {
    id: accountId,
    organizationId: testOrganization.id,
    code: '1000',
    name: 'Cash',
    type: 'ASSET',
    active: true,
    ...overrides,
  };
}

let storage: TokenStorage;

beforeEach(() => {
  vi.stubEnv('VITE_API_BASE_URL', '/api/v1');
  storage = createMemoryTokenStorage();
  setTokenStorage(storage);
  clearSession();
  applyAuthResponse(makeAuthResponse());
});

afterEach(() => {
  clearSession();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe('journal entries API', () => {
  it('lists entries with paging, sorting, and supported filters', async () => {
    const fetchMock = createFetchMock([
      {
        path: '/api/v1/journal-entries',
        handler: ({ headers, url }) => {
          expect(headers.get('Authorization')).toBe('Bearer access-token-1');
          const params = new URL(url, 'http://localhost').searchParams;
          expect(params.get('page')).toBe('2');
          expect(params.get('size')).toBe('20');
          expect(params.get('status')).toBe('POSTED');
          expect(params.get('entryDate')).toBe('2026-10-25');
          expect(params.get('entryNumber')).toBe('JE-1001');
          expect(params.get('reference')).toBe('JE-1001');
          expect(params.get('sort')).toBe('entryDate,desc');
          return jsonResponse(makePage([makeEntry({ status: 'POSTED' })]));
        },
      },
    ]);
    vi.stubGlobal('fetch', fetchMock);

    const page = await journalEntryApi.list({
      page: 2,
      size: 20,
      status: 'POSTED',
      entryDate: '2026-10-25',
      entryNumber: ' JE-1001 ',
      reference: ' JE-1001 ',
      sort: 'entryDate,desc',
    });

    expect(page.content[0]?.entryNumber).toBe('JE-1001');
  });

  it('omits empty filters and status', async () => {
    const fetchMock = createFetchMock([
      {
        path: '/api/v1/journal-entries',
        handler: ({ url }) => {
          const params = new URL(url, 'http://localhost').searchParams;
          expect(params.get('page')).toBe('0');
          expect(params.get('size')).toBe('10');
          expect(params.has('status')).toBe(false);
          expect(params.has('entryDate')).toBe(false);
          expect(params.has('entryNumber')).toBe(false);
          expect(params.has('reference')).toBe(false);
          expect(params.get('sort')).toBe('createdAt,desc');
          return jsonResponse(makePage([]));
        },
      },
    ]);
    vi.stubGlobal('fetch', fetchMock);

    await journalEntryApi.list({
      page: 0,
      size: 10,
      status: '',
      entryDate: '',
      entryNumber: '   ',
      reference: '',
      sort: 'createdAt,desc',
    });
  });

  it('gets one entry and sends supported mutations', async () => {
    const createInput: CreateJournalEntryInput = {
      entryNumber: 'JE-2001',
      entryDate: '2026-10-26',
      description: '',
      reference: '',
      lines: [
        { accountId, description: '', debitAmount: 10.5, creditAmount: 0 },
        {
          accountId: '77777777-7777-7777-7777-777777777777',
          description: '',
          debitAmount: 0,
          creditAmount: 10.5,
        },
      ],
    };
    const updateInput = { reference: 'UPDATED' };

    const fetchMock = createFetchMock([
      {
        path: `/api/v1/journal-entries/${entryId}`,
        handler: () => jsonResponse(makeEntry()),
      },
      {
        method: 'POST',
        path: '/api/v1/journal-entries',
        handler: ({ body }) => {
          expect(body).toEqual(createInput);
          return jsonResponse(makeEntry({ entryNumber: 'JE-2001' }), 201);
        },
      },
      {
        method: 'PUT',
        path: `/api/v1/journal-entries/${entryId}`,
        handler: ({ body }) => {
          expect(body).toEqual(updateInput);
          return jsonResponse(makeEntry({ reference: 'UPDATED' }));
        },
      },
      {
        method: 'POST',
        path: `/api/v1/journal-entries/${entryId}/post`,
        handler: () => jsonResponse(makeEntry({ status: 'POSTED' })),
      },
      {
        method: 'DELETE',
        path: `/api/v1/journal-entries/${entryId}`,
        handler: () => jsonResponse(makeEntry({ status: 'VOID' })),
      },
    ]);
    vi.stubGlobal('fetch', fetchMock);

    const entry = await journalEntryApi.get(entryId);
    const created = await journalEntryApi.create(createInput);
    const updated = await journalEntryApi.update(entryId, updateInput);
    const posted = await journalEntryApi.post(entryId);
    const voided = await journalEntryApi.void(entryId);

    expect(entry.id).toBe(entryId);
    expect(created.entryNumber).toBe('JE-2001');
    expect(updated.reference).toBe('UPDATED');
    expect(posted.status).toBe('POSTED');
    expect(voided.status).toBe('VOID');
  });

  it('loads every account lookup page and removes duplicates', async () => {
    const secondAccount = makeAccount({
      id: '88888888-8888-8888-8888-888888888888',
      code: '4000',
      name: 'Revenue',
      type: 'REVENUE',
    });

    const fetchMock = createFetchMock([
      {
        path: '/api/v1/accounts',
        handler: ({ url }) => {
          const params = new URL(url, 'http://localhost').searchParams;
          expect(params.get('size')).toBe('200');
          expect(params.get('sort')).toBe('code,asc');
          const page = Number(params.get('page'));

          if (page === 0) {
            return jsonResponse({
              ...makePage([makeAccount(), makeAccount()], 0, 200),
              totalElements: 3,
              totalPages: 2,
              last: false,
            });
          }

          return jsonResponse({
            ...makePage([secondAccount], 1, 200),
            totalElements: 3,
            totalPages: 2,
            first: false,
            last: true,
          });
        },
      },
    ]);
    vi.stubGlobal('fetch', fetchMock);

    const lookups = await journalEntryApi.lookups();

    expect(lookups.accounts).toEqual([makeAccount(), secondAccount]);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
