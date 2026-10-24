// @vitest-environment jsdom
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createMemoryTokenStorage, type TokenStorage } from 'src/lib/auth/token-storage';
import { applyAuthResponse, clearSession, setTokenStorage } from 'src/lib/api/session';
import {
  createFetchMock,
  jsonResponse,
  makeAuthResponse,
} from 'src/test/api-fixtures';
import {
  makeDashboardResponse,
  makeExpenseSummary,
  makeInvoiceSummary,
} from 'src/test/dashboard-fixtures';
import { useDashboardData } from './useDashboardData';

const organizationId = '22222222-2222-2222-2222-222222222222';

let storage: TokenStorage;

function authorized(headers: Headers) {
  expect(headers.get('Authorization')).toBe('Bearer access-token-1');
}

interface ExpectedDates {
  fromDate: string;
  toDate: string;
}

function reportRoutes(
  shouldFail: () => boolean = () => false,
  expected: ExpectedDates = { fromDate: '2026-01-01', toDate: '2026-10-20' },
) {
  return createFetchMock([
    {
      path: '/api/v1/reports/dashboard',
      handler: ({ headers, url }) => {
        authorized(headers);
        const params = new URL(url, 'http://localhost').searchParams;
        expect(params.get('fromDate')).toBe(expected.fromDate);
        expect(params.get('toDate')).toBe(expected.toDate);

        if (shouldFail()) {
          return new Response(JSON.stringify({ message: 'Server error' }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
          });
        }

        return jsonResponse(
          makeDashboardResponse({
            totalRevenue: 1200,
            totalExpenses: 450,
            netProfit: 750,
            customerCount: 3,
          }),
        );
      },
    },
    {
      path: '/api/v1/reports/expenses',
      handler: ({ headers }) => {
        authorized(headers);
        return jsonResponse(
          makeExpenseSummary({
            totalAmount: 450,
            expenseCount: 2,
            byVendor: [
              {
                vendorId: 'vendor-1',
                vendorName: 'Acme Supplies',
                totalAmount: 450,
                expenseCount: 2,
              },
            ],
          }),
        );
      },
    },
    {
      path: '/api/v1/reports/invoices',
      handler: ({ headers }) => {
        authorized(headers);
        return jsonResponse(
          makeInvoiceSummary({
            invoiceCount: 4,
            totalInvoiced: 3000,
            totalOutstanding: 1000,
          }),
        );
      },
    },
  ]);
}

beforeEach(() => {
  vi.stubEnv('VITE_API_BASE_URL', '/api/v1');
  storage = createMemoryTokenStorage();
  setTokenStorage(storage);
  clearSession();
  applyAuthResponse(makeAuthResponse());
});

afterEach(() => {
  cleanup();
  clearSession();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe('useDashboardData', () => {
  it('loads the dashboard, expense, and invoice summaries', async () => {
    const fetchMock = reportRoutes();
    vi.stubGlobal('fetch', fetchMock);

    const { result } = renderHook(() =>
      useDashboardData({
        organizationId,
        fromDate: '2026-01-01',
        toDate: '2026-10-20',
      }),
    );

    await waitFor(() => expect(result.current.status).toBe('success'));

    expect(result.current.error).toBeNull();
    expect(result.current.data?.dashboard.totalRevenue).toBe(1200);
    expect(result.current.data?.expenses.totalAmount).toBe(450);
    expect(result.current.data?.invoices.totalOutstanding).toBe(1000);
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it('shows a safe error and can retry', async () => {
    let shouldFail = true;
    const fetchMock = reportRoutes(() => shouldFail);
    vi.stubGlobal('fetch', fetchMock);

    const { result } = renderHook(() =>
      useDashboardData({
        organizationId,
        fromDate: '2026-01-01',
        toDate: '2026-10-20',
      }),
    );

    await waitFor(() => expect(result.current.status).toBe('error'));
    expect(result.current.error).toBe('Something went wrong. Please try again.');

    shouldFail = false;
    act(() => result.current.retry());

    await waitFor(() => expect(result.current.status).toBe('success'));
    expect(result.current.data?.dashboard.netProfit).toBe(750);
    expect(fetchMock).toHaveBeenCalledTimes(6);
  });

  it('refetches when the selected period changes', async () => {
    const expected = { fromDate: '2026-01-01', toDate: '2026-10-20' };
    const fetchMock = reportRoutes(() => false, expected);
    vi.stubGlobal('fetch', fetchMock);

    const { result, rerender } = renderHook(
      ({ fromDate }: { fromDate: string }) =>
        useDashboardData({
          organizationId,
          fromDate,
          toDate: '2026-10-20',
        }),
      { initialProps: { fromDate: '2026-01-01' } },
    );

    await waitFor(() => expect(result.current.status).toBe('success'));
    expect(fetchMock).toHaveBeenCalledTimes(3);

    expected.fromDate = '2026-10-01';
    rerender({ fromDate: '2026-10-01' });

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(6));
    await waitFor(() => expect(result.current.status).toBe('success'));
  });

  it('does not request data without an organization', () => {
    const fetchMock = reportRoutes();
    vi.stubGlobal('fetch', fetchMock);

    const { result } = renderHook(() =>
      useDashboardData({
        organizationId: null,
        fromDate: '2026-01-01',
        toDate: '2026-10-20',
      }),
    );

    expect(result.current.status).toBe('idle');
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
