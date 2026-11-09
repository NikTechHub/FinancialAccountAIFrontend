// @vitest-environment jsdom
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthContext, type AuthContextValue } from 'src/features/auth/auth-context';
import type { MembershipRole } from 'src/lib/api/types';
import { clearSession } from 'src/lib/api/session';
import {
  createFetchMock,
  jsonResponse,
  testOrganization,
  testUser,
} from 'src/test/api-fixtures';
import { TrialBalancePage } from './TrialBalancePage';
import { yearToDateRange } from './dates';
import type { TrialBalanceLine, TrialBalanceResponse } from './types';

const cashId = '66666666-6666-6666-6666-666666666666';
const arId = '77777777-7777-7777-7777-777777777777';
const revenueId = '88888888-8888-8888-8888-888888888888';

const lines: TrialBalanceLine[] = [
  {
    accountId: cashId,
    accountCode: '1000',
    accountName: 'Cash',
    accountType: 'ASSET',
    debitTotal: 7000,
    creditTotal: 400,
    netBalance: 6600,
  },
  {
    accountId: arId,
    accountCode: '1100',
    accountName: 'Accounts Receivable',
    accountType: 'ASSET',
    debitTotal: 1000,
    creditTotal: 0,
    netBalance: 1000,
  },
  {
    accountId: revenueId,
    accountCode: '4000',
    accountName: 'Service Revenue',
    accountType: 'REVENUE',
    debitTotal: 0,
    creditTotal: 1000,
    netBalance: 1000,
  },
];

function makeResponse(
  overrides: Partial<TrialBalanceResponse> = {},
): TrialBalanceResponse {
  return {
    fromDate: '2026-01-01',
    toDate: '2026-12-31',
    lines,
    totalDebits: 8400,
    totalCredits: 8400,
    totalDifference: 0,
    ...overrides,
  };
}

function createAuthValue(role: MembershipRole | null = 'OWNER'): AuthContextValue {
  return {
    status: 'authenticated',
    user: testUser,
    organization: testOrganization,
    role,
    membershipError: null,
    login: vi.fn(async () => undefined),
    register: vi.fn(async () => undefined),
    logout: vi.fn(),
  };
}

function renderPage() {
  render(
    <MemoryRouter initialEntries={['/reports/trial-balance']}>
      <AuthContext.Provider value={createAuthValue()}>
        <TrialBalancePage />
      </AuthContext.Provider>
    </MemoryRouter>,
  );
}

function setupRoutes(options: { failure?: number | null; response?: TrialBalanceResponse; deferFirst?: boolean } = {}) {
  let failure = options.failure ?? null;
  let response = options.response ?? makeResponse();
  const requests: URLSearchParams[] = [];
  let resolveFirst!: (response: Response) => void;
  const first = new Promise<Response>((resolve) => { resolveFirst = resolve; });

  const fetchMock = createFetchMock([
    {
      path: '/api/v1/reports/trial-balance',
      handler: ({ url }) => {
        const params = new URL(url, 'http://localhost').searchParams;
        requests.push(params);
        if (options.deferFirst && requests.length === 1) return first;
        if (failure) {
          return jsonResponse({ message: 'Report failed' }, failure);
        }
        return jsonResponse(response);
      },
    },
  ]);
  vi.stubGlobal('fetch', fetchMock);

  return {
    fetchMock,
    requests,
    resolveFirst,
    setFailure: (status: number | null) => {
      failure = status;
    },
    setResponse: (next: TrialBalanceResponse) => {
      response = next;
    },
  };
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-05-15T12:00:00Z'));
  clearSession();
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  clearSession();
  vi.unstubAllGlobals();
});

describe('TrialBalancePage', () => {
  it('shows loading without totals and ignores an older response after applying dates', async () => {
    const { resolveFirst, requests } = setupRoutes({ deferFirst: true });
    renderPage();
    expect(screen.getByRole('status').textContent).toContain('Loading trial balance');
    expect(screen.queryByText('Balanced')).toBeNull();
    expect(screen.queryByText('0.00')).toBeNull();
    fireEvent.change(screen.getByLabelText('From date'), { target: { value: '2026-02-01' } });
    expect(requests).toHaveLength(1);
    fireEvent.click(screen.getByRole('button', { name: 'Apply dates' }));
    await screen.findByText('Service Revenue');
    await act(async () => resolveFirst(jsonResponse(makeResponse({
      lines: [{ ...lines[0], accountName: 'STALE ACCOUNT' }], totalDebits: 123,
    }))));
    expect(screen.queryByText('STALE ACCOUNT')).toBeNull();
    expect(screen.queryByText('123.00')).toBeNull();
    expect(screen.getByText('Service Revenue')).toBeTruthy();
  });

  it('discloses the complete membership scope without assigning the current currency to totals', async () => {
    setupRoutes();
    renderPage();
    await screen.findByText('Service Revenue');
    expect(screen.getByText(/every organization you belong to/)).toBeTruthy();
    expect(screen.getByText(/including inactive accounts/)).toBeTruthy();
    expect(screen.queryByText(/amounts in USD/)).toBeNull();
    expect(screen.queryByText(/Total debits \(USD\)/)).toBeNull();
  });

  it('does not call unequal complete totals balanced even if the reported difference is zero', async () => {
    setupRoutes({ response: makeResponse({ totalDebits: '999999999999999.9999', totalCredits: '999999999999999.9998', totalDifference: '0' }) });
    renderPage();
    expect(await screen.findByText('999,999,999,999,999.9999')).toBeTruthy();
    expect(screen.getByText('Out of balance')).toBeTruthy();
    expect(screen.queryByText('Balanced')).toBeNull();
  });

  it('shows a permission state without totals or sample data', async () => {
    setupRoutes({ failure: 403 });
    renderPage();
    expect(await screen.findByText('You do not have permission to load the trial balance.')).toBeTruthy();
    expect(screen.queryByRole('table')).toBeNull();
    expect(screen.queryByText('Balanced')).toBeNull();
    expect(screen.queryByText('0.00')).toBeNull();
  });

  it('treats a malformed successful response as an error, not an empty or balanced report', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => jsonResponse({ lines: [] })));
    renderPage();
    expect(await screen.findByText('The server returned an unexpected response. Refresh and try again.')).toBeTruthy();
    expect(screen.queryByText('Balanced')).toBeNull();
    expect(screen.queryByText('No activity')).toBeNull();
    expect(screen.queryByText('0.00')).toBeNull();
  });

  it('renders the complete API response, natural-balance badges, and balanced totals', async () => {
    setupRoutes();
    renderPage();

    const table = await screen.findByRole('table', { name: 'Trial balance table' });
    expect(within(table).getByText('1000')).toBeTruthy();
    expect(within(table).getByText('Cash')).toBeTruthy();
    expect(within(table).getByText('Accounts Receivable')).toBeTruthy();
    expect(within(table).getByText('Service Revenue')).toBeTruthy();
    expect(within(table).getByText('6,600.00')).toBeTruthy();
    expect(within(table).getAllByText('1,000.00')).toHaveLength(4);
    expect(screen.getAllByText('8,400.00')).toHaveLength(2);
    expect(screen.getAllByText('0.00')).toHaveLength(3);
    expect(screen.getByText('Balanced')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Next' })).toBeNull();
    expect(screen.queryByText('Rows per page')).toBeNull();
  });

  it('uses API totals instead of recalculating from the visible rows', async () => {
    setupRoutes({
      response: makeResponse({
        totalDebits: 9999,
        totalCredits: 5677.75,
        totalDifference: 4321.25,
      }),
    });
    renderPage();

    expect(await screen.findByText('9,999.00')).toBeTruthy();
    expect(screen.getByText('5,677.75')).toBeTruthy();
    expect(screen.getByText('4,321.25')).toBeTruthy();
    expect(screen.getByText('Out of balance')).toBeTruthy();
  });

  it('applies validated date filters and keeps the API echoed range', async () => {
    const { requests } = setupRoutes();
    renderPage();

    await screen.findByRole('table', { name: 'Trial balance table' });
    const defaultRange = yearToDateRange(new Date(), testOrganization.timezone);
    await waitFor(() => {
      expect(requests[0]?.get('fromDate')).toBe(defaultRange.fromDate);
      expect(requests[0]?.get('toDate')).toBe(defaultRange.toDate);
    });

    fireEvent.change(screen.getByLabelText('From date'), {
      target: { value: '2026-02-01' },
    });
    fireEvent.change(screen.getByLabelText('To date'), {
      target: { value: '2026-02-28' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Apply dates' }));

    await waitFor(() => {
      expect(requests[requests.length - 1]?.get('fromDate')).toBe('2026-02-01');
      expect(requests[requests.length - 1]?.get('toDate')).toBe('2026-02-28');
      expect(requests[requests.length - 1]?.has('accountId')).toBe(false);
    });
  });

  it('blocks an invalid date range before making a request', async () => {
    const { requests } = setupRoutes();
    renderPage();

    await screen.findByRole('table', { name: 'Trial balance table' });
    const initialCount = requests.length;

    fireEvent.change(screen.getByLabelText('From date'), {
      target: { value: '2026-03-01' },
    });
    fireEvent.change(screen.getByLabelText('To date'), {
      target: { value: '2026-02-01' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Apply dates' }));

    expect(
      await screen.findByText(
        'The start date must be on or before the end date.',
      ),
    ).toBeTruthy();
    expect(requests).toHaveLength(initialCount);
  });

  it('shows empty activity without claiming the report is balanced', async () => {
    setupRoutes({
      response: makeResponse({
        lines: [],
        totalDebits: 0,
        totalCredits: 0,
        totalDifference: 0,
      }),
    });
    renderPage();

    expect(
      await screen.findByText('No posted activity in this date range'),
    ).toBeTruthy();
    expect(screen.getByText('No activity')).toBeTruthy();
    expect(screen.queryByText('Balanced')).toBeNull();
    expect(screen.queryByText('Out of balance')).toBeNull();
  });

  it('retries a failed request without retaining old report rows', async () => {
    const { setFailure, requests } = setupRoutes();
    renderPage();

    expect(await screen.findByText('Service Revenue')).toBeTruthy();
    setFailure(500);

    fireEvent.change(screen.getByLabelText('From date'), {
      target: { value: '2026-02-01' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Apply dates' }));

    expect(
      await screen.findByText('Unable to load trial balance'),
    ).toBeTruthy();
    expect(screen.queryByText('Service Revenue')).toBeNull();
    expect(
      (screen.getByLabelText('From date') as HTMLInputElement).value,
    ).toBe('2026-02-01');

    setFailure(null);
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));

    expect(await screen.findByText('Service Revenue')).toBeTruthy();
    expect(requests[requests.length - 1]?.get('fromDate')).toBe('2026-02-01');
  });

  it('reports an expired session from the API', async () => {
    setupRoutes({ failure: 401 });
    renderPage();

    expect(
      await screen.findByText('Your session has expired. Please sign in again.'),
    ).toBeTruthy();
    expect(screen.queryByText('Service Revenue')).toBeNull();
    expect(screen.queryByText('Balanced')).toBeNull();
  });
});
