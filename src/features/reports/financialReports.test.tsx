// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthContext, type AuthContextValue } from 'src/features/auth/auth-context';
import { clearSession } from 'src/lib/api/session';
import { createFetchMock, jsonResponse, testOrganization, testUser } from 'src/test/api-fixtures';
import { balanceSheetFixture, profitAndLossFixture } from 'src/test/financial-report-fixtures';
import { BalanceSheetPage } from './BalanceSheetPage';
import { ProfitAndLossPage } from './ProfitAndLossPage';

const auth: AuthContextValue = {
  status: 'authenticated', user: testUser, organization: testOrganization, role: 'VIEWER',
  membershipError: null, login: vi.fn(), register: vi.fn(), logout: vi.fn(),
};

const reports = [
  { name: 'profit and loss', path: '/api/v1/reports/profit-and-loss', Page: ProfitAndLossPage,
    fixture: profitAndLossFixture, accountName: 'Consulting revenue', dateLabel: 'From date', applyLabel: 'Apply dates',
    query: 'fromDate', totalLabel: 'Net profit / loss', lineField: 'revenueLines',
    empty: () => profitAndLossFixture({ revenueLines: [], expenseLines: [], totalRevenue: 0, totalExpenses: 0, netProfit: 0 }),
    emptyMessage: 'No posted revenue or expense activity in this date range.',
    permission: 'You do not have permission to load profit and loss.',
  },
  { name: 'balance sheet', path: '/api/v1/reports/balance-sheet', Page: BalanceSheetPage,
    fixture: balanceSheetFixture, accountName: 'Bank account', dateLabel: 'As-of date', applyLabel: 'Apply date',
    query: 'asOfDate', totalLabel: 'Total assets', lineField: 'assetLines',
    empty: () => balanceSheetFixture({ assetLines: [], liabilityLines: [], equityLines: [], totalAssets: 0, totalLiabilities: 0, totalEquity: 0 }),
    emptyMessage: 'No posted asset, liability or equity activity on or before this date.',
    permission: 'You do not have permission to load the balance sheet.',
  },
];

function renderPage(Page: typeof ProfitAndLossPage | typeof BalanceSheetPage, value = auth) {
  return render(<MemoryRouter><AuthContext.Provider value={value}><Page /></AuthContext.Provider></MemoryRouter>);
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-05-15T02:00:00Z')); // May 14 in the organization's timezone.
  clearSession();
});
afterEach(() => { cleanup(); clearSession(); vi.useRealTimers(); vi.unstubAllGlobals(); });

describe.each(reports)('$name screen', ({ path, Page, fixture, accountName, dateLabel, applyLabel, query, totalLabel, lineField, empty, emptyMessage, permission }) => {
  function setup({ deferred = false, response = fixture() as unknown, failure = 0 } = {}) {
    let failStatus = failure;
    let currentResponse = response;
    let resolveFirst!: (value: Response) => void;
    const first = new Promise<Response>((resolve) => { resolveFirst = resolve; });
    const requests: URLSearchParams[] = [];
    const signals: (AbortSignal | null | undefined)[] = [];
    const fetchMock = createFetchMock([{
      path,
      handler: ({ url, signal }) => {
        const params = new URL(url, 'http://localhost').searchParams;
        requests.push(params); signals.push(signal);
        if (deferred && requests.length === 1) return first;
        return failStatus ? jsonResponse({ message: 'Request failed' }, failStatus) : jsonResponse(currentResponse);
      },
    }]);
    vi.stubGlobal('fetch', fetchMock);
    return { requests, signals, resolveFirst, fetchMock,
      setFailure: (status: number) => { failStatus = status; },
      setResponse: (value: unknown) => { currentResponse = value; },
    };
  }

  it('loads real mapped account amounts with organization-scope and currency disclosures', async () => {
    const { requests } = setup(); renderPage(Page);
    expect(await screen.findByText(accountName)).toBeTruthy();
    expect(screen.getByRole('region', { name: totalLabel })).toBeTruthy();
    expect(screen.getByText(/every organization you belong to/)).toBeTruthy();
    expect(screen.getByText(/no currency labels or conversion/)).toBeTruthy();
    expect(screen.queryByText(/USD|amounts in/)).toBeNull();
    expect(screen.queryByRole('button', { name: 'Next' })).toBeNull();
    expect(requests).toHaveLength(1);
    expect(requests[0].get(query)).toBe(query === 'fromDate' ? '2026-01-01' : '2026-05-14');
    if (query === 'fromDate') expect(requests[0].get('toDate')).toBe('2026-05-14');
  });

  it('shows loading without zeros, totals or fabricated account rows', async () => {
    const { resolveFirst } = setup({ deferred: true }); renderPage(Page);
    expect(screen.getByRole('status').textContent).toContain('Loading');
    expect(screen.queryByRole('region', { name: totalLabel })).toBeNull();
    expect(screen.queryByText('0.00')).toBeNull();
    expect(screen.queryByText(accountName)).toBeNull();
    await act(async () => resolveFirst(jsonResponse(fixture())));
    expect(await screen.findByText(accountName)).toBeTruthy();
  });

  it('shows an honest empty state without a profit or balanced conclusion', async () => {
    setup({ response: empty() }); renderPage(Page);
    expect(await screen.findByText(emptyMessage)).toBeTruthy();
    expect(screen.queryByText('Balanced')).toBeNull();
    expect(screen.queryByText('Profit')).toBeNull();
    expect(screen.queryByText(accountName)).toBeNull();
  });

  it('keeps draft dates local, validates them, then applies the new request', async () => {
    const { requests } = setup(); renderPage(Page); await screen.findByText(accountName);
    fireEvent.change(screen.getByLabelText(dateLabel), { target: { value: '' } });
    fireEvent.click(screen.getByRole('button', { name: applyLabel }));
    expect(screen.getByText(/Choose an (as-of|start) date.|Choose a start date./)).toBeTruthy();
    expect(requests).toHaveLength(1);
    fireEvent.change(screen.getByLabelText(dateLabel), { target: { value: '2026-02-01' } });
    expect(requests).toHaveLength(1);
    fireEvent.click(screen.getByRole('button', { name: applyLabel }));
    await waitFor(() => expect(requests).toHaveLength(2));
    expect(requests[1].get(query)).toBe('2026-02-01');
  });

  it('clears prior data on failure and retries the applied date while keeping unsubmitted edits', async () => {
    const { requests, setFailure } = setup(); renderPage(Page); await screen.findByText(accountName);
    setFailure(500);
    fireEvent.change(screen.getByLabelText(dateLabel), { target: { value: '2026-02-01' } });
    fireEvent.click(screen.getByRole('button', { name: applyLabel }));
    expect(await screen.findByText(/The report request could not be completed/)).toBeTruthy();
    expect(screen.queryByText(accountName)).toBeNull();
    expect(screen.queryByRole('region', { name: totalLabel })).toBeNull();
    fireEvent.change(screen.getByLabelText(dateLabel), { target: { value: '2026-03-01' } });
    setFailure(0);
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    await screen.findByText(accountName);
    expect(requests[requests.length - 1].get(query)).toBe('2026-02-01');
    expect((screen.getByLabelText(dateLabel) as HTMLInputElement).value).toBe('2026-03-01');
  });

  it.each([401, 403])('handles HTTP %s without fabricated amounts', async (status) => {
    setup({ failure: status }); renderPage(Page);
    expect(await screen.findByText(status === 401 ? 'Your session has expired. Please sign in again.' : permission)).toBeTruthy();
    expect(screen.queryByRole('table')).toBeNull();
    expect(screen.queryByText('0.00')).toBeNull();
    expect(screen.queryByText('Balanced')).toBeNull();
  });

  it('treats missing monetary values as an error rather than an empty report', async () => {
    setup({ response: { ...fixture(), totalRevenue: undefined, totalAssets: undefined } }); renderPage(Page);
    expect(await screen.findByText('The server returned an unexpected response. Refresh and try again.')).toBeTruthy();
    expect(screen.queryByText(emptyMessage)).toBeNull();
    expect(screen.queryByText('0.00')).toBeNull();
  });

  it.each([false, true])('ignores stale success/error responses after a date change (error=%s)', async (lateError) => {
    const { requests, signals, resolveFirst } = setup({ deferred: true }); renderPage(Page);
    await waitFor(() => expect(requests).toHaveLength(1));
    fireEvent.change(screen.getByLabelText(dateLabel), { target: { value: '2026-02-01' } });
    fireEvent.click(screen.getByRole('button', { name: applyLabel }));
    await screen.findByText(accountName);
    expect(signals[0]?.aborted).toBe(true);
    const stale = fixture() as unknown as Record<string, unknown>;
    stale[lineField] = [{ ...(stale[lineField] as Record<string, unknown>[])[0], accountName: 'Stale account' }];
    await act(async () => resolveFirst(lateError ? jsonResponse({ message: 'Old failure' }, 500) : jsonResponse(stale)));
    expect(screen.getByText(accountName)).toBeTruthy();
    expect(screen.queryByText('Stale account')).toBeNull();
    expect(screen.queryByText(/The report request could not be completed/)).toBeNull();
  });

  it('makes no report request without an organization', () => {
    const { fetchMock } = setup(); renderPage(Page, { ...auth, organization: null });
    expect(screen.getByText('No organization available')).toBeTruthy();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('statement financial meaning', () => {
  it('shows revenue, expense breakdowns and server net income, including loss', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => jsonResponse(profitAndLossFixture({ totalRevenue: 25, totalExpenses: 30.0001, netProfit: '-5.0001' }))));
    renderPage(ProfitAndLossPage);
    await screen.findByText('Loss');
    expect(within(screen.getByRole('region', { name: 'Net profit / loss' })).getByText('-5.0001')).toBeTruthy();
    expect(within(screen.getByRole('region', { name: 'Total revenue' })).getByText('25.00')).toBeTruthy();
    expect(within(screen.getByRole('region', { name: 'Total expenses' })).getByText('30.0001')).toBeTruthy();
    expect(within(screen.getByRole('table', { name: 'Revenue accounts' })).getByText('1,500.1256')).toBeTruthy();
    expect(within(screen.getByRole('table', { name: 'Expenses accounts' })).getByText('300.0255')).toBeTruthy();
    expect(screen.getByText(/including manual journals/)).toBeTruthy();
  });

  it('blocks reversed periods and displays the response reporting period', async () => {
    const fetchMock = vi.fn(async () => jsonResponse(profitAndLossFixture())); vi.stubGlobal('fetch', fetchMock);
    renderPage(ProfitAndLossPage); await screen.findByText('Profit');
    fireEvent.change(screen.getByLabelText('From date'), { target: { value: '2026-06-01' } });
    fireEvent.click(screen.getByRole('button', { name: 'Apply dates' }));
    expect(screen.getByText('The start date must be on or before the end date.')).toBeTruthy();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(screen.getByText(/inclusive reporting period/).textContent).toContain('May 15');
  });

  it('displays negative account amounts and exact large net profit', async () => {
    const data = profitAndLossFixture({ netProfit: '999999999999999.9999' });
    data.revenueLines[0].amount = '-0.0001';
    vi.stubGlobal('fetch', vi.fn(async () => jsonResponse(data)));
    renderPage(ProfitAndLossPage);
    expect(await screen.findByText('999,999,999,999,999.9999')).toBeTruthy();
    expect(screen.getByText('-0.0001')).toBeTruthy();
    expect(screen.getByText('Profit')).toBeTruthy();
  });

  it('shows every balance-sheet category and reconciles the actual reported totals', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => jsonResponse(balanceSheetFixture())));
    renderPage(BalanceSheetPage);
    expect(await screen.findByText('Balanced')).toBeTruthy();
    expect(within(screen.getByRole('table', { name: 'Assets accounts' })).getByText('Bank account')).toBeTruthy();
    expect(within(screen.getByRole('table', { name: 'Liabilities accounts' })).getByText('Accounts payable')).toBeTruthy();
    expect(within(screen.getByRole('table', { name: 'Equity accounts' })).getByText('Owner capital')).toBeTruthy();
    expect(screen.getByText(/Equity includes only EQUITY accounts/)).toBeTruthy();
    expect(screen.getByText(/As of May 15, 2026/)).toBeTruthy();
  });

  it('shows discrepancies from complete server totals without modifying account balances', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => jsonResponse(balanceSheetFixture({ totalAssets: '999999999999999.9999', totalLiabilities: '999999999999999.9998', totalEquity: 0 }))));
    renderPage(BalanceSheetPage); await screen.findByText('Discrepancy');
    const equation = screen.getByRole('region', { name: 'Accounting equation' });
    expect(within(equation).getByText('0.0001')).toBeTruthy();
    expect(within(screen.getByRole('region', { name: 'Total assets' })).getByText('999,999,999,999,999.9999')).toBeTruthy();
    expect(within(screen.getByRole('table', { name: 'Assets accounts' })).getByText('1,500.1256')).toBeTruthy();
    expect(screen.queryByText('Balanced')).toBeNull();
  });

  it('handles negative equity and a negative discrepancy without changing the sign', async () => {
    const data = balanceSheetFixture({ totalAssets: 0.2999, totalLiabilities: 0.4, totalEquity: -0.1 });
    data.equityLines[0].balance = -0.1;
    vi.stubGlobal('fetch', vi.fn(async () => jsonResponse(data)));
    renderPage(BalanceSheetPage); await screen.findByText('Discrepancy');
    expect(within(screen.getByRole('region', { name: 'Total equity' })).getByText('-0.10')).toBeTruthy();
    expect(screen.getByText('-0.0001')).toBeTruthy();
  });
});
