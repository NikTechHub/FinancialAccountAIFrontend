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
  type MockRoute,
} from 'src/test/api-fixtures';
import { GeneralLedgerPage } from './GeneralLedgerPage';
import { yearToDateRange } from './dates';
import type { GeneralLedgerLine, ReportAccount } from './types';

const cashId = '66666666-6666-6666-6666-666666666666';
const revenueId = '77777777-7777-7777-7777-777777777777';
const entryId = '55555555-5555-5555-5555-555555555555';

const accounts: ReportAccount[] = [
  {
    id: cashId,
    organizationId: testOrganization.id,
    code: '1000',
    name: 'Cash',
    type: 'ASSET',
    active: true,
  },
  {
    id: revenueId,
    organizationId: testOrganization.id,
    code: '4000',
    name: 'Consulting Revenue',
    type: 'REVENUE',
    active: true,
  },
  {
    id: 'inactive-account',
    organizationId: testOrganization.id,
    code: '1001',
    name: 'Old Cash',
    type: 'ASSET',
    active: false,
  },
  {
    id: 'foreign-account',
    organizationId: 'other-organization',
    code: '9999',
    name: 'Foreign Cash',
    type: 'ASSET',
    active: true,
  },
];

function makePage<T>(content: T[], page = 0, size = 20, total = content.length) {
  const totalPages = total ? Math.ceil(total / size) : 0;
  return {
    content,
    totalElements: total,
    totalPages,
    number: page,
    size,
    first: page === 0,
    last: page + 1 >= totalPages,
    numberOfElements: content.length,
    empty: content.length === 0,
  };
}

function makeLine(
  overrides: Partial<GeneralLedgerLine> = {},
): GeneralLedgerLine {
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
    <MemoryRouter initialEntries={['/reports/general-ledger']}>
      <AuthContext.Provider value={createAuthValue()}>
        <GeneralLedgerPage />
      </AuthContext.Provider>
    </MemoryRouter>,
  );
}

async function chooseOption(trigger: HTMLElement, optionName: RegExp | string) {
  fireEvent.pointerDown(trigger, {
    button: 0,
    ctrlKey: false,
    pointerType: 'mouse',
  });
  const option = await screen.findByRole('option', { name: optionName });
  fireEvent.click(option);
}

interface SetupOptions {
  accountFailure?: number | null;
  reportFailure?: number | null;
  lines?: GeneralLedgerLine[];
  revenueLines?: GeneralLedgerLine[];
  total?: number;
  deferCash?: boolean;
}

function setupRoutes(options: SetupOptions = {}) {
  const cashLines = options.lines ?? [makeLine()];
  const revenueLines =
    options.revenueLines ??
    [
      makeLine({
        journalEntryId: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
        entryNumber: 'JE-2001',
        entryDate: '2026-02-01',
        description: 'Consulting sale',
        reference: 'INV-2001',
        accountId: revenueId,
        accountCode: '4000',
        accountName: 'Consulting Revenue',
        lineDescription: 'Revenue line',
        debitAmount: 0,
        creditAmount: 1200,
      }),
    ];
  let accountFailure = options.accountFailure ?? null;
  let reportFailure = options.reportFailure ?? null;
  let resolveCash: ((response: Response) => void) | null = null;
  const deferredCash = new Promise<Response>((resolve) => {
    resolveCash = resolve;
  });
  const reportRequests: URLSearchParams[] = [];

  const routes: MockRoute[] = [
    {
      path: '/api/v1/accounts',
      handler: ({ url }) => {
        if (accountFailure) {
          return jsonResponse({ message: 'Account lookup failed' }, accountFailure);
        }
        const params = new URL(url, 'http://localhost').searchParams;
        return jsonResponse(
          makePage(accounts, Number(params.get('page') ?? 0), 200, accounts.length),
        );
      },
    },
    {
      path: '/api/v1/reports/general-ledger',
      handler: async ({ url }) => {
        const params = new URL(url, 'http://localhost').searchParams;
        reportRequests.push(params);
        if (reportFailure) {
          return jsonResponse({ message: 'Report failed' }, reportFailure);
        }

        const accountId = params.get('accountId');
        if (options.deferCash && accountId === cashId) {
          return deferredCash;
        }

        const page = Number(params.get('page') ?? 0);
        const size = Number(params.get('size') ?? 20);
        const source = accountId === revenueId ? revenueLines : cashLines;
        const total = options.total ?? source.length;
        const content = source.slice(page * size, (page + 1) * size);
        return jsonResponse(makePage(content, page, size, total));
      },
    },
  ];

  const fetchMock = createFetchMock(routes);
  vi.stubGlobal('fetch', fetchMock);

  return {
    fetchMock,
    reportRequests,
    setAccountFailure: (status: number | null) => {
      accountFailure = status;
    },
    setReportFailure: (status: number | null) => {
      reportFailure = status;
    },
    resolveCash: (response: Response) => resolveCash?.(response),
  };
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-05-15T12:00:00Z'));
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
  Object.defineProperty(HTMLElement.prototype, 'hasPointerCapture', {
    configurable: true,
    value: () => false,
  });
  Object.defineProperty(HTMLElement.prototype, 'setPointerCapture', {
    configurable: true,
    value: () => undefined,
  });
  Object.defineProperty(HTMLElement.prototype, 'releasePointerCapture', {
    configurable: true,
    value: () => undefined,
  });
  Element.prototype.scrollIntoView = vi.fn();
  clearSession();
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  clearSession();
  vi.unstubAllGlobals();
});

describe('GeneralLedgerPage', () => {
  it('validates draft dates and sends no requests until a valid range is applied', async () => {
    const { reportRequests } = setupRoutes();
    renderPage();
    await screen.findByText('JE-1001');
    const count = reportRequests.length;
    fireEvent.change(screen.getByLabelText('From date'), { target: { value: '2026-03-01' } });
    fireEvent.change(screen.getByLabelText('To date'), { target: { value: '2026-02-01' } });
    expect(reportRequests).toHaveLength(count);
    fireEvent.click(screen.getByRole('button', { name: 'Apply dates' }));
    expect(screen.getByText('The start date must be on or before the end date.')).toBeTruthy();
    expect(reportRequests).toHaveLength(count);
    fireEvent.change(screen.getByLabelText('To date'), { target: { value: '2026-03-01' } });
    fireEvent.click(screen.getByRole('button', { name: 'Apply dates' }));
    await waitFor(() => expect(reportRequests).toHaveLength(count + 1));
    expect(reportRequests[reportRequests.length - 1]?.get('fromDate')).toBe('2026-03-01');
    expect(reportRequests[reportRequests.length - 1]?.get('toDate')).toBe('2026-03-01');
  });

  it('shows missing optional descriptions and references without inventing replacements', async () => {
    setupRoutes({ lines: [makeLine({ description: null, reference: null, lineDescription: null, debitAmount: '999999999999999.9999' })] });
    renderPage();
    await screen.findByText('JE-1001');
    const table = screen.getByRole('table', { name: 'General ledger table' });
    expect(within(table).getAllByText('—')).toHaveLength(3);
    expect(within(table).getByText('999,999,999,999,999.9999')).toBeTruthy();
    expect(screen.queryByText('Opening cash')).toBeNull();
    expect(screen.queryByRole('columnheader', { name: /balance/i })).toBeNull();
  });

  it('shows expired-session errors without fabricated ledger rows', async () => {
    setupRoutes({ reportFailure: 401 });
    renderPage();
    expect(await screen.findByText('Your session has expired. Please sign in again.')).toBeTruthy();
    expect(screen.queryByText('JE-1001')).toBeNull();
    expect(screen.queryByRole('table')).toBeNull();
  });

  it('loads active organization accounts and shows posted ledger lines from the API', async () => {
    setupRoutes();
    renderPage();

    const table = await screen.findByRole('table', { name: 'General ledger table' });
    expect(await screen.findByText('JE-1001')).toBeTruthy();
    expect(within(table).getByText('Jan 5, 2026')).toBeTruthy();
    expect(within(table).getByText('Owner investment')).toBeTruthy();
    expect(within(table).getByText('Opening cash')).toBeTruthy();
    expect(within(table).getByText('5,000.00')).toBeTruthy();
    expect(within(table).getByText('0.00')).toBeTruthy();
    expect(screen.getAllByText('1000 — Cash')).toHaveLength(2);
    expect(screen.getByText('Asset')).toBeTruthy();
    expect(screen.queryByText('Old Cash')).toBeNull();
    expect(screen.queryByText('Foreign Cash')).toBeNull();
    expect(screen.queryByText('Total debits (USD)')).toBeNull();
    expect(
      screen.getByRole('link', { name: 'JE-1001' }).getAttribute('href'),
    ).toBe(`/journal-entries?entryId=${entryId}`);
  });

  it('changes account and date filters and passes only supported query parameters', async () => {
    const { reportRequests } = setupRoutes();
    renderPage();

    await screen.findByText('JE-1001');
    const defaultRange = yearToDateRange(new Date(), testOrganization.timezone);
    await waitFor(() => {
      expect(reportRequests[0]?.get('fromDate')).toBe(defaultRange.fromDate);
      expect(reportRequests[0]?.get('toDate')).toBe(defaultRange.toDate);
    });

    const accountTrigger = screen.getByLabelText('General ledger account');
    await waitFor(() =>
      expect((accountTrigger as HTMLButtonElement).disabled).toBe(false),
    );
    await chooseOption(accountTrigger, /4000 — Consulting Revenue/);
    await screen.findByText('JE-2001');

    fireEvent.change(screen.getByLabelText('From date'), {
      target: { value: '2026-02-01' },
    });
    fireEvent.change(screen.getByLabelText('To date'), {
      target: { value: '2026-02-28' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Apply dates' }));

    await waitFor(() => {
      const last = reportRequests[reportRequests.length - 1];
      expect(last?.get('accountId')).toBe(revenueId);
      expect(last?.get('fromDate')).toBe('2026-02-01');
      expect(last?.get('toDate')).toBe('2026-02-28');
      expect(last?.get('page')).toBe('0');
      expect(last?.get('size')).toBe('20');
      expect(last?.has('sort')).toBe(false);
    });
  });

  it('paginates without calculating cross-page totals', async () => {
    const lines = Array.from({ length: 21 }, (_, index) =>
      makeLine({
        journalEntryId: `entry-${index + 1}`,
        entryNumber: `JE-${1001 + index}`,
        entryDate: `2026-01-${String((index % 28) + 1).padStart(2, '0')}`,
      }),
    );
    const { reportRequests } = setupRoutes({ lines, total: 21 });
    renderPage();

    expect(await screen.findByText('JE-1001')).toBeTruthy();
    expect(screen.getByText('Page 1 of 2')).toBeTruthy();
    expect(screen.getByText('21 lines')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));

    expect(await screen.findByText('JE-1021')).toBeTruthy();
    expect(screen.getByText('Page 2 of 2')).toBeTruthy();
    expect(reportRequests[reportRequests.length - 1]?.get('page')).toBe('1');
    expect(screen.queryByText('JE-1001')).toBeNull();
    expect((screen.getByRole('button', { name: 'Next' }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: 'Previous' }));
    await screen.findByText('JE-1001');
    expect(screen.getByText('Page 1 of 2')).toBeTruthy();
    await chooseOption(screen.getByLabelText('Rows per page'), '10');
    await screen.findByText('Page 1 of 3');
    expect(reportRequests[reportRequests.length - 1]?.get('size')).toBe('10');
    expect(screen.queryByText('JE-1011')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    await screen.findByText('JE-1011');
    await chooseOption(screen.getByLabelText('General ledger account'), /4000 — Consulting Revenue/);
    await screen.findByText('JE-2001');
    expect(reportRequests[reportRequests.length - 1]?.get('page')).toBe('0');
  });

  it('shows a deterministic empty state for a range without posted lines', async () => {
    setupRoutes({ lines: [], total: 0 });
    renderPage();

    expect(
      await screen.findByText('No posted activity for this account'),
    ).toBeTruthy();
    expect(screen.getByText('Page 0 of 0')).toBeTruthy();
    expect(
      (screen.getByRole('button', { name: 'Next' }) as HTMLButtonElement)
        .disabled,
    ).toBe(true);
  });

  it('retries a failed ledger request without fabricating rows or losing filters', async () => {
    const { setReportFailure } = setupRoutes({ reportFailure: 500 });
    renderPage();

    expect(
      await screen.findByText('Unable to load general ledger'),
    ).toBeTruthy();
    expect(screen.queryByText('JE-1001')).toBeNull();
    expect(screen.getByLabelText('From date')).toBeTruthy();

    setReportFailure(null);
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));

    expect(await screen.findByText('JE-1001')).toBeTruthy();
  });

  it('retries failed account loading before requesting a ledger', async () => {
    const { reportRequests, setAccountFailure } = setupRoutes({
      accountFailure: 500,
    });
    renderPage();

    expect(await screen.findByText('Unable to load accounts')).toBeTruthy();
    expect(reportRequests).toHaveLength(0);

    setAccountFailure(null);
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));

    expect(await screen.findByText('JE-1001')).toBeTruthy();
    expect(reportRequests.length).toBeGreaterThan(0);
  });

  it('shows a permission error from the report API', async () => {
    setupRoutes({ reportFailure: 403 });
    renderPage();

    expect(
      await screen.findByText(
        'You do not have permission to load the general ledger.',
      ),
    ).toBeTruthy();
    expect(screen.queryByText('JE-1001')).toBeNull();
  });

  it('ignores a stale response after the selected account changes', async () => {
    const { resolveCash, reportRequests } = setupRoutes({ deferCash: true });
    renderPage();

    const accountTrigger = await screen.findByLabelText(
      'General ledger account',
    );
    await waitFor(() =>
      expect((accountTrigger as HTMLButtonElement).disabled).toBe(false),
    );
    await waitFor(() => expect(reportRequests).toHaveLength(1));
    expect(screen.getByRole('status').textContent).toContain('Loading general ledger');
    expect(screen.queryByText('JE-1001')).toBeNull();
    await chooseOption(accountTrigger, /4000 — Consulting Revenue/);

    expect(await screen.findByText('JE-2001')).toBeTruthy();

    await act(async () => resolveCash(
      jsonResponse(
        makePage(
          [
            makeLine({
              journalEntryId: 'stale-entry',
              entryNumber: 'JE-STALE',
            }),
          ],
          0,
          20,
          1,
        ),
      ),
    ));

    expect(screen.queryByText('JE-STALE')).toBeNull();
    expect(screen.getByText('JE-2001')).toBeTruthy();
  });
});
