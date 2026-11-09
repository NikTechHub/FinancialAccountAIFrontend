import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { applyAuthResponse, clearSession, setTokenStorage } from 'src/lib/api/session';
import { createMemoryTokenStorage } from 'src/lib/auth/token-storage';
import { createFetchMock, jsonResponse, makeAuthResponse } from 'src/test/api-fixtures';
import { balanceSheetFixture, profitAndLossFixture } from 'src/test/financial-report-fixtures';
import { reportApi } from './api';
import { reconcileBalanceSheet } from './amounts';
import { formatReportAmount } from './display';

beforeEach(() => {
  vi.stubEnv('VITE_API_BASE_URL', '/api/v1');
  setTokenStorage(createMemoryTokenStorage());
  applyAuthResponse(makeAuthResponse());
});
afterEach(() => { clearSession(); vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

const period = { fromDate: '2026-01-01', toDate: '2026-05-15' };
const asOf = { asOfDate: '2026-05-15' };

describe('financial statement APIs', () => {
  it('maps the exact P&L fields and sends only the required inclusive date range', async () => {
    const controller = new AbortController();
    vi.stubGlobal('fetch', createFetchMock([{
      path: '/api/v1/reports/profit-and-loss',
      handler: ({ url, headers, signal }) => {
        expect(Object.fromEntries(new URL(url, 'http://localhost').searchParams)).toEqual(period);
        expect(headers.get('Authorization')).toBe('Bearer access-token-1');
        expect(headers.has('X-Organization-Id')).toBe(false);
        expect(signal).toBe(controller.signal);
        return jsonResponse(profitAndLossFixture());
      },
    }]));
    const report = await reportApi.profitAndLoss(period, controller.signal);
    expect(report).toMatchObject({ ...period, totalRevenue: '1500.1256', totalExpenses: '300.0255', netProfit: '1200.1001' });
    expect(report.revenueLines[0]).toEqual({ ...profitAndLossFixture().revenueLines[0], amount: '1500.1256' });
    expect(report.expenseLines[0].amount).toBe('300.0255');
  });

  it('maps the exact balance-sheet fields and sends only asOfDate', async () => {
    const controller = new AbortController();
    vi.stubGlobal('fetch', createFetchMock([{
      path: '/api/v1/reports/balance-sheet',
      handler: ({ url, headers, signal }) => {
        expect(Object.fromEntries(new URL(url, 'http://localhost').searchParams)).toEqual(asOf);
        expect(headers.get('Authorization')).toBe('Bearer access-token-1');
        expect(headers.has('X-Organization-Id')).toBe(false);
        expect(signal).toBe(controller.signal);
        return jsonResponse(balanceSheetFixture());
      },
    }]));
    const report = await reportApi.balanceSheet(asOf, controller.signal);
    expect(report).toMatchObject({ ...asOf, totalAssets: '1500.1256', totalLiabilities: '300.0255', totalEquity: '1200.1001' });
    expect(report.assetLines[0]).toEqual({ ...balanceSheetFixture().assetLines[0], balance: '1500.1256' });
    expect(report.liabilityLines[0].balance).toBe('300.0255');
    expect(report.equityLines[0].balance).toBe('1200.1001');
  });

  it('preserves large negative JSON decimals in both lines and server totals', async () => {
    const body = JSON.stringify(profitAndLossFixture({ netProfit: -123 }))
      .split('1500.1256').join('999999999999999.9999').replace('-123', '-999999999999999.9998');
    vi.stubGlobal('fetch', vi.fn(async () => new Response(body)));
    const result = await reportApi.profitAndLoss(period);
    expect(result.totalRevenue).toBe('999999999999999.9999');
    expect(result.revenueLines[0].amount).toBe('999999999999999.9999');
    expect(formatReportAmount(result.netProfit)).toBe('-999,999,999,999,999.9998');
  });

  it('preserves balance-sheet decimals before deriving a one-unit discrepancy', async () => {
    const body = JSON.stringify(balanceSheetFixture({ totalEquity: 0, totalLiabilities: 123 }))
      .split('1500.1256').join('999999999999999.9999').replace('"totalLiabilities":123', '"totalLiabilities":999999999999999.9998');
    vi.stubGlobal('fetch', vi.fn(async () => new Response(body)));
    const result = await reportApi.balanceSheet(asOf);
    expect(result.assetLines[0].balance).toBe('999999999999999.9999');
    expect(reconcileBalanceSheet(result)).toEqual({ liabilitiesAndEquity: '999999999999999.9998', difference: '0.0001', balanced: false });
  });

  it.each(['', '2026-02-30', '2026-1-1', '2026-01-01T00:00:00Z'])('rejects invalid date %s before requesting either report', async (date) => {
    const fetchMock = vi.fn(); vi.stubGlobal('fetch', fetchMock);
    await expect(reportApi.balanceSheet({ asOfDate: date })).rejects.toMatchObject({ status: 400 });
    await expect(reportApi.profitAndLoss({ fromDate: date, toDate: '2026-12-31' })).rejects.toMatchObject({ status: 400 });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('rejects reversed periods but permits a single inclusive day and leap day', async () => {
    const fetchMock = vi.fn(async () => jsonResponse(profitAndLossFixture()));
    vi.stubGlobal('fetch', fetchMock);
    await expect(reportApi.profitAndLoss({ fromDate: '2026-02-01', toDate: '2026-01-01' })).rejects.toMatchObject({ status: 400 });
    expect(fetchMock).not.toHaveBeenCalled();
    await reportApi.profitAndLoss({ fromDate: '2024-02-29', toDate: '2024-02-29' });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  describe.each([
    { name: 'P&L', fixture: profitAndLossFixture, call: () => reportApi.profitAndLoss(period), total: 'netProfit', lines: 'revenueLines', amount: 'amount' },
    { name: 'balance sheet', fixture: balanceSheetFixture, call: () => reportApi.balanceSheet(asOf), total: 'totalAssets', lines: 'assetLines', amount: 'balance' },
  ])('$name invalid responses', ({ fixture, call, total, lines, amount }) => {
    it.each([undefined, null, 'invalid', '', true, {}, 'Infinity', '0.00001'])('rejects missing/invalid monetary value %s in totals and lines', async (invalid) => {
      const response: Record<string, unknown> = { ...fixture(), [total]: invalid };
      vi.stubGlobal('fetch', vi.fn(async () => jsonResponse(response)));
      await expect(call()).rejects.toMatchObject({ kind: 'parse' });
      Object.assign(response, fixture());
      response[lines] = [{ ...(response[lines] as Record<string, unknown>[])[0], [amount]: invalid }];
      await expect(call()).rejects.toMatchObject({ kind: 'parse' });
    });
    it.each(['', 'null', '{}', '{invalid', '{"content":[]}'])('rejects malformed or partial payload %s', async (body) => {
      vi.stubGlobal('fetch', vi.fn(async () => new Response(body)));
      await expect(call()).rejects.toMatchObject({ kind: 'parse' });
    });
    it.each([401, 403, 500])('propagates HTTP %s without fabricated data', async (status) => {
      clearSession();
      vi.stubGlobal('fetch', vi.fn(async () => jsonResponse({ message: 'Request failed' }, status)));
      await expect(call()).rejects.toMatchObject({ status });
    });
  });

  it('rejects missing breakdowns and incorrectly classified balance-sheet accounts', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => jsonResponse({ ...balanceSheetFixture(), assetLines: [{ ...balanceSheetFixture().assetLines[0], accountType: 'REVENUE' }] })));
    await expect(reportApi.balanceSheet(asOf)).rejects.toMatchObject({ kind: 'parse' });
    vi.stubGlobal('fetch', vi.fn(async () => jsonResponse({ ...profitAndLossFixture(), expenseLines: undefined })));
    await expect(reportApi.profitAndLoss(period)).rejects.toMatchObject({ kind: 'parse' });
  });
});

describe('balance-sheet reconciliation', () => {
  it('uses precise complete totals, including negative equity, without floating point arithmetic', () => {
    expect(reconcileBalanceSheet({ totalAssets: '0.3', totalLiabilities: '0.1', totalEquity: '0.2' })).toEqual({ liabilitiesAndEquity: '0.3000', difference: '0.0000', balanced: true });
    expect(reconcileBalanceSheet({ totalAssets: '0.3', totalLiabilities: '0.4', totalEquity: '-0.1' })?.balanced).toBe(true);
    expect(reconcileBalanceSheet({ totalAssets: '-0.3001', totalLiabilities: '0.1', totalEquity: '-0.4' })?.difference).toBe('-0.0001');
    expect(reconcileBalanceSheet({ totalAssets: 'invalid', totalLiabilities: 0, totalEquity: 0 })).toBeNull();
  });
});
