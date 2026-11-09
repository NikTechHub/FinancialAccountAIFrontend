import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { applyAuthResponse, clearSession, setTokenStorage } from 'src/lib/api/session';
import { createMemoryTokenStorage, type TokenStorage } from 'src/lib/auth/token-storage';
import type { PageResponse } from 'src/lib/api/types';
import {
  createFetchMock,
  jsonResponse,
  makeAuthResponse,
  testOrganization,
} from 'src/test/api-fixtures';
import { reportApi } from './api';
import { formatReportAmount } from './display';
import type {
  GeneralLedgerLine,
  ReportAccount,
  TrialBalanceLine,
} from './types';

const cashId = '66666666-6666-6666-6666-666666666666';
const revenueId = '77777777-7777-7777-7777-777777777777';
const entryId = '55555555-5555-5555-5555-555555555555';

function makePage<T>(content: T[], page = 0, size = 20): PageResponse<T> {
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

function makeAccount(overrides: Partial<ReportAccount> = {}): ReportAccount {
  return {
    id: cashId,
    organizationId: testOrganization.id,
    code: '1000',
    name: 'Cash',
    type: 'ASSET',
    active: true,
    ...overrides,
  };
}

function makeLedgerLine(overrides: Partial<GeneralLedgerLine> = {}): GeneralLedgerLine {
  return {
    journalEntryId: entryId,
    entryNumber: 'JE-1001',
    entryDate: '2026-01-05',
    description: 'Owner investment',
    reference: 'INV-1',
    accountId: cashId,
    accountCode: '1000',
    accountName: 'Cash',
    lineDescription: 'Opening cash',
    debitAmount: 5000,
    creditAmount: 0,
    ...overrides,
  };
}

const trialBalanceLine: TrialBalanceLine = {
  accountId: cashId,
  accountCode: '1000',
  accountName: 'Cash',
  accountType: 'ASSET',
  debitTotal: 7000,
  creditTotal: 400,
  netBalance: 6600,
};

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

describe('reports API', () => {
  it('loads all active accounts for the signed-in organization and deduplicates pages', async () => {
    const second = makeAccount({
      id: revenueId,
      code: '4000',
      name: 'Revenue',
      type: 'REVENUE',
    });

    const fetchMock = createFetchMock([
      {
        path: '/api/v1/accounts',
        handler: ({ headers, url }) => {
          expect(headers.get('Authorization')).toBe('Bearer access-token-1');
          const params = new URL(url, 'http://localhost').searchParams;
          expect(params.get('size')).toBe('200');
          expect(params.get('sort')).toBe('code,asc');

          const page = Number(params.get('page'));
          if (page === 0) {
            return jsonResponse({
              ...makePage(
                [
                  makeAccount(),
                  makeAccount(),
                  makeAccount({
                    id: 'inactive',
                    code: '1001',
                    active: false,
                  }),
                  makeAccount({
                    id: 'foreign',
                    organizationId: 'other-org',
                    code: '9000',
                  }),
                ],
                0,
                200,
              ),
              totalElements: 5,
              totalPages: 2,
              last: false,
            });
          }

          return jsonResponse({
            ...makePage([second], 1, 200),
            totalElements: 5,
            totalPages: 2,
            first: false,
            last: true,
          });
        },
      },
    ]);
    vi.stubGlobal('fetch', fetchMock);

    await expect(
      reportApi.activeAccounts(testOrganization.id),
    ).resolves.toEqual([makeAccount(), second]);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('requests and returns the trial balance with required date-only parameters', async () => {
    const fetchMock = createFetchMock([
      {
        path: '/api/v1/reports/trial-balance',
        handler: ({ url }) => {
          const params = new URL(url, 'http://localhost').searchParams;
          expect(params.get('fromDate')).toBe('2026-01-01');
          expect(params.get('toDate')).toBe('2026-12-31');
          expect(params.has('accountId')).toBe(false);
          return jsonResponse({
            fromDate: '2026-01-01',
            toDate: '2026-12-31',
            lines: [trialBalanceLine],
            totalDebits: 7000,
            totalCredits: 7000,
            totalDifference: 0,
          });
        },
      },
    ]);
    vi.stubGlobal('fetch', fetchMock);

    const result = await reportApi.trialBalance({
      fromDate: '2026-01-01',
      toDate: '2026-12-31',
    });

    expect(result.lines[0]).toEqual({ ...trialBalanceLine, debitTotal: '7000', creditTotal: '400', netBalance: '6600' });
    expect(result.totalDifference).toBe('0');
  });

  it('requests and returns a paged general ledger without unsupported sort parameters', async () => {
    const fetchMock = createFetchMock([
      {
        path: '/api/v1/reports/general-ledger',
        handler: ({ url }) => {
          const params = new URL(url, 'http://localhost').searchParams;
          expect(params.get('accountId')).toBe(cashId);
          expect(params.get('fromDate')).toBe('2026-01-01');
          expect(params.get('toDate')).toBe('2026-12-31');
          expect(params.get('page')).toBe('2');
          expect(params.get('size')).toBe('20');
          expect(params.has('sort')).toBe(false);
          return jsonResponse({ ...makePage([makeLedgerLine()], 2, 20), totalPages: 3, totalElements: 41 });
        },
      },
    ]);
    vi.stubGlobal('fetch', fetchMock);

    const result = await reportApi.generalLedger({
      accountId: cashId,
      fromDate: '2026-01-01',
      toDate: '2026-12-31',
      page: 2,
      size: 20,
    });

    expect(result.content[0]?.entryNumber).toBe('JE-1001');
    expect(result).toMatchObject({ number: 2, size: 20, totalPages: 3, totalElements: 41, last: true });
    expect(result.content[0]).toMatchObject({ debitAmount: '5000', creditAmount: '0' });
  });

  it('preserves raw BigDecimal tokens and descriptions without changing pagination numbers', async () => {
    const description = 'A "debitAmount":123 reference, 2026, café';
    const body = JSON.stringify(makePage([makeLedgerLine({ description, reference: null, lineDescription: null })]))
      .replace('"debitAmount":5000', '"debitAmount":999999999999999.9999');
    const fetchMock = createFetchMock([{
      path: '/api/v1/reports/general-ledger', handler: () => new Response(body),
    }]);
    vi.stubGlobal('fetch', fetchMock);
    const controller = new AbortController();
    const result = await reportApi.generalLedger({ accountId: cashId, fromDate: '2026-01-01', toDate: '2026-01-01', page: 0, size: 20 }, controller.signal);
    expect(result.content[0]).toMatchObject({ description, reference: null, lineDescription: null, debitAmount: '999999999999999.9999' });
    expect(formatReportAmount(result.content[0].debitAmount)).toBe('999,999,999,999,999.9999');
    expect(result.number).toBe(0);
    expect(fetchMock.mock.calls[0][1]?.signal).toBe(controller.signal);
  });

  it('preserves exact complete trial totals from numeric JSON', async () => {
    vi.stubGlobal('fetch', createFetchMock([{
      path: '/api/v1/reports/trial-balance',
      handler: () => new Response('{"fromDate":"2026-01-01","toDate":"2026-01-01","lines":[],"totalDebits":999999999999999.9999,"totalCredits":999999999999999.9998,"totalDifference":1E-4}'),
    }]));
    const result = await reportApi.trialBalance({ fromDate: '2026-01-01', toDate: '2026-01-01' });
    expect(result.totalDebits).toBe('999999999999999.9999');
    expect(result.totalCredits).toBe('999999999999999.9998');
    expect(formatReportAmount(result.totalDifference)).toBe('0.0001');
  });

  it.each([
    ['', '2026-01-01'], ['2026-02-30', '2026-03-01'], ['2026-03-01', '2026-02-01'],
  ])('rejects invalid dates %s to %s before sending either report request', async (fromDate, toDate) => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    await expect(reportApi.trialBalance({ fromDate, toDate })).rejects.toMatchObject({ status: 400 });
    await expect(reportApi.generalLedger({ fromDate, toDate, accountId: cashId, page: 0, size: 20 })).rejects.toMatchObject({ status: 400 });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it.each(['null', '{}', '{invalid', '{"content":[],"totalElements":0}', '{"fromDate":"2026-01-01","toDate":"2026-01-01","lines":[],"totalDebits":null,"totalCredits":0,"totalDifference":0}'])('rejects incomplete reports instead of manufacturing zeros: %s', async (body) => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(body)));
    await expect(reportApi.trialBalance({ fromDate: '2026-01-01', toDate: '2026-01-01' })).rejects.toMatchObject({ kind: 'parse' });
    await expect(reportApi.generalLedger({ fromDate: '2026-01-01', toDate: '2026-01-01', accountId: cashId, page: 0, size: 20 })).rejects.toMatchObject({ kind: 'parse' });
  });

  it('fails account loading at its safety limit instead of returning a truncated selector', async () => {
    const fetchMock = vi.fn(async () => jsonResponse({ ...makePage([makeAccount()]), totalPages: 101, last: false }));
    vi.stubGlobal('fetch', fetchMock);
    await expect(reportApi.activeAccounts(testOrganization.id)).rejects.toMatchObject({ kind: 'parse' });
    expect(fetchMock).toHaveBeenCalledTimes(100);
  });

  it.each([401, 403])('preserves report HTTP %s errors through the authenticated client', async (status) => {
    // No refresh token: an expired session must be surfaced, not retried with guessed credentials.
    clearSession();
    vi.stubGlobal('fetch', vi.fn(async () => jsonResponse({ message: 'Denied' }, status)));
    await expect(reportApi.trialBalance({ fromDate: '2026-01-01', toDate: '2026-01-01' })).rejects.toMatchObject({ status });
    await expect(reportApi.generalLedger({ fromDate: '2026-01-01', toDate: '2026-01-01', accountId: cashId, page: 0, size: 20 })).rejects.toMatchObject({ status });
  });
});
