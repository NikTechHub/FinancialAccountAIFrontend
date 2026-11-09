// @vitest-environment jsdom
import {
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
import { clearSession } from 'src/lib/api/session';
import type { MembershipRole } from 'src/lib/api/types';
import {
  createFetchMock,
  jsonResponse,
  testOrganization,
  testUser,
  type MockRoute,
} from 'src/test/api-fixtures';
import { JournalManagementPage } from './JournalManagementPage';
import type {
  AccountOption,
  JournalEntryRecord,
  JournalEntryStatus,
} from './types';

const draftId = '55555555-5555-5555-5555-555555555555';
const postedId = '55555555-5555-5555-5555-555555555556';
const voidId = '55555555-5555-5555-5555-555555555557';
const cashId = '66666666-6666-6666-6666-666666666666';
const revenueId = '77777777-7777-7777-7777-777777777777';
const foreignAccountId = '88888888-8888-8888-8888-888888888888';

function makeAccount(overrides: Partial<AccountOption> = {}): AccountOption {
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

const accounts: AccountOption[] = [
  makeAccount(),
  makeAccount({
    id: revenueId,
    code: '4000',
    name: 'Consulting Revenue',
    type: 'REVENUE',
  }),
  makeAccount({
    id: foreignAccountId,
    organizationId: 'other-org',
    code: '9999',
    name: 'Foreign Cash',
  }),
];

function makeEntry(
  overrides: Partial<JournalEntryRecord> = {},
): JournalEntryRecord {
  return {
    id: draftId,
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
        accountId: cashId,
        accountCode: '1000',
        accountName: 'Cash',
        description: 'Debit line',
        debitAmount: 100,
        creditAmount: 0,
      },
      {
        id: 'line-2',
        accountId: revenueId,
        accountCode: '4000',
        accountName: 'Consulting Revenue',
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

function makePage<T>(content: T[], page = 0, size = 10) {
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

function createAuthValue(
  role: MembershipRole | null,
  membershipError: string | null = null,
): AuthContextValue {
  return {
    status: 'authenticated',
    user: testUser,
    organization: testOrganization,
    role,
    membershipError,
    login: vi.fn(async () => undefined),
    register: vi.fn(async () => undefined),
    logout: vi.fn(),
  };
}

function renderPage(
  role: MembershipRole | null = 'OWNER',
  membershipError: string | null = null,
  initialEntries: string[] = ['/journal-entries'],
) {
  render(
    <MemoryRouter initialEntries={initialEntries}>
      <AuthContext.Provider value={createAuthValue(role, membershipError)}>
        <JournalManagementPage />
      </AuthContext.Provider>
    </MemoryRouter>,
  );
}

function journalCalls(
  fetchMock: ReturnType<typeof createFetchMock>,
  method: string,
  path = '/api/v1/journal-entries',
) {
  return fetchMock.mock.calls.filter(([input, init]) => {
    const requestMethod = (init?.method ?? 'GET').toUpperCase();
    const requestPath = new URL(String(input), 'http://localhost').pathname;
    return requestMethod === method && requestPath === path;
  });
}

interface SetupOptions {
  listFailure?: number | null;
  listDelayMs?: number;
  detailFailure?: number | null;
  createFailure?: { status: number; body: unknown } | null;
  postFailure?: { status: number; body: unknown } | null;
}

function setupRoutes(
  initialRecords: JournalEntryRecord[],
  options: SetupOptions = {},
) {
  let records = [...initialRecords];
  let listFailure = options.listFailure ?? null;
  let detailFailure = options.detailFailure ?? null;
  let createdCount = 0;

  const recordRoutes = (id: string): MockRoute[] => [
    {
      path: `/api/v1/journal-entries/${id}`,
      handler: () => {
        if (detailFailure) {
          return jsonResponse({ message: 'Failed' }, detailFailure);
        }
        const record = records.find((entry) => entry.id === id);
        return record
          ? jsonResponse(record)
          : jsonResponse({ message: 'Not found' }, 404);
      },
    },
    {
      method: 'PUT',
      path: `/api/v1/journal-entries/${id}`,
      handler: ({ body }) => {
        const current = records.find((entry) => entry.id === id);
        if (!current) return jsonResponse({ message: 'Not found' }, 404);
        const input = body as Partial<JournalEntryRecord> & {
          lines?: {
            accountId: string;
            description: string;
            debitAmount: number;
            creditAmount: number;
          }[];
        };
        const nextLines = input.lines
          ? input.lines.map((line, index) => {
              const account = accounts.find(
                (candidate) => candidate.id === line.accountId,
              );
              return {
                id: `updated-line-${index + 1}`,
                accountId: line.accountId,
                accountCode: account?.code ?? '',
                accountName: account?.name ?? '',
                description: line.description || null,
                debitAmount: line.debitAmount,
                creditAmount: line.creditAmount,
              };
            })
          : current.lines;
        const updated = {
          ...current,
          ...(input as Partial<JournalEntryRecord>),
          lines: nextLines,
          totalDebits: nextLines.reduce(
            (total, line) => total + line.debitAmount,
            0,
          ),
          totalCredits: nextLines.reduce(
            (total, line) => total + line.creditAmount,
            0,
          ),
          updatedAt: '2026-10-26T12:00:00Z',
        };
        records = records.map((entry) => (entry.id === id ? updated : entry));
        return jsonResponse(updated);
      },
    },
    {
      method: 'POST',
      path: `/api/v1/journal-entries/${id}/post`,
      handler: () => {
        if (options.postFailure) {
          return jsonResponse(
            options.postFailure.body,
            options.postFailure.status,
          );
        }
        const current = records.find((entry) => entry.id === id);
        if (!current) return jsonResponse({ message: 'Not found' }, 404);
        const updated = {
          ...current,
          status: 'POSTED' as JournalEntryStatus,
          updatedAt: '2026-10-26T12:00:00Z',
        };
        records = records.map((entry) => (entry.id === id ? updated : entry));
        return jsonResponse(updated);
      },
    },
    {
      method: 'DELETE',
      path: `/api/v1/journal-entries/${id}`,
      handler: () => {
        const current = records.find((entry) => entry.id === id);
        if (!current) return jsonResponse({ message: 'Not found' }, 404);
        const updated = {
          ...current,
          status: 'VOID' as JournalEntryStatus,
          updatedAt: '2026-10-26T12:00:00Z',
        };
        records = records.map((entry) => (entry.id === id ? updated : entry));
        return jsonResponse(updated);
      },
    },
  ];

  const fetchMock = createFetchMock([
    {
      path: '/api/v1/journal-entries',
      handler: async ({ url }) => {
        if (options.listDelayMs) {
          await new Promise((resolve) =>
            setTimeout(resolve, options.listDelayMs),
          );
        }
        if (listFailure) {
          return jsonResponse({ message: 'Failed' }, listFailure);
        }

        const params = new URL(url, 'http://localhost').searchParams;
        const page = Number(params.get('page') ?? 0);
        const size = Number(params.get('size') ?? 10);
        const status = params.get('status');
        const entryDate = params.get('entryDate');
        const search = (
          params.get('entryNumber') ??
          params.get('reference') ??
          ''
        ).toLowerCase();

        let filtered = records;
        if (status && entryDate) {
          filtered = records.filter(
            (record) =>
              record.status === status && record.entryDate === entryDate,
          );
        } else if (status) {
          filtered = records.filter((record) => record.status === status);
        } else if (entryDate) {
          filtered = records.filter(
            (record) => record.entryDate === entryDate,
          );
        } else if (search) {
          filtered = records.filter(
            (record) =>
              record.entryNumber.toLowerCase().includes(search) ||
              (record.reference ?? '').toLowerCase().includes(search),
          );
        }

        const content = filtered.slice(page * size, (page + 1) * size);
        const totalPages = filtered.length
          ? Math.ceil(filtered.length / size)
          : 0;
        return jsonResponse({
          content,
          totalElements: filtered.length,
          totalPages,
          number: page,
          size,
          first: page === 0,
          last: page + 1 >= totalPages,
          numberOfElements: content.length,
          empty: content.length === 0,
        });
      },
    },
    {
      method: 'POST',
      path: '/api/v1/journal-entries',
      handler: async ({ body }) => {
        if (options.createFailure) {
          return jsonResponse(
            options.createFailure.body,
            options.createFailure.status,
          );
        }

        const input = body as {
          entryNumber: string;
          entryDate: string;
          description: string;
          reference: string;
          lines: {
            accountId: string;
            description: string;
            debitAmount: number;
            creditAmount: number;
          }[];
        };
        createdCount += 1;
        const id = `created-${createdCount}`;
        const lines = input.lines.map((line, index) => {
          const account = accounts.find(
            (candidate) => candidate.id === line.accountId,
          );
          return {
            id: `${id}-line-${index + 1}`,
            accountId: line.accountId,
            accountCode: account?.code ?? '',
            accountName: account?.name ?? '',
            description: line.description || null,
            debitAmount: line.debitAmount,
            creditAmount: line.creditAmount,
          };
        });
        const created = makeEntry({
          id,
          entryNumber: input.entryNumber,
          entryDate: input.entryDate,
          description: input.description || null,
          reference: input.reference || null,
          status: 'DRAFT',
          lines,
          totalDebits: lines.reduce(
            (total, line) => total + line.debitAmount,
            0,
          ),
          totalCredits: lines.reduce(
            (total, line) => total + line.creditAmount,
            0,
          ),
        });
        records = [created, ...records];
        return jsonResponse(created, 201);
      },
    },
    ...recordRoutes(draftId),
    ...recordRoutes(postedId),
    ...recordRoutes(voidId),
    {
      path: '/api/v1/accounts',
      handler: () => jsonResponse(makePage(accounts, 0, 200)),
    },
  ]);

  vi.stubGlobal('fetch', fetchMock);

  return {
    fetchMock,
    setListFailure: (status: number | null) => {
      listFailure = status;
    },
    setDetailFailure: (status: number | null) => {
      detailFailure = status;
    },
    getRecords: () => records,
  };
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

async function waitForCreateReady() {
  const dialog = await screen.findByRole('dialog');
  const submit = within(dialog).getByRole('button', { name: 'Create draft' });
  await waitFor(() => expect((submit as HTMLButtonElement).disabled).toBe(false));
  return { dialog, submit };
}

async function fillValidCreateForm(dialog: HTMLElement) {
  fireEvent.change(within(dialog).getByLabelText(/Entry number/), {
    target: { value: 'JE-2002' },
  });
  fireEvent.change(within(dialog).getByLabelText(/Entry date/), {
    target: { value: '2026-10-26' },
  });
  fireEvent.change(within(dialog).getByLabelText('Reference'), {
    target: { value: 'MANUAL-2' },
  });
  fireEvent.change(within(dialog).getByLabelText('Description'), {
    target: { value: 'Manual adjustment' },
  });
  await chooseOption(
    within(dialog).getByLabelText(/Line 1 account/i),
    /1000 — Cash/,
  );
  await chooseOption(
    within(dialog).getByLabelText(/Line 2 account/i),
    /4000 — Consulting Revenue/,
  );
  fireEvent.change(within(dialog).getByLabelText(/Line 1 debit/i), {
    target: { value: '100.25' },
  });
  fireEvent.change(within(dialog).getByLabelText(/Line 2 credit/i), {
    target: { value: '100.25' },
  });
}

beforeEach(() => {
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
  clearSession();
  vi.unstubAllGlobals();
});

describe('JournalManagementPage', () => {
  it('loads journal entries and exposes only supported actions', async () => {
    setupRoutes([
      makeEntry(),
      makeEntry({
        id: postedId,
        entryNumber: 'JE-1002',
        status: 'POSTED',
        description: 'Posted entry',
      }),
    ]);
    renderPage();

    expect(await screen.findByText('JE-1001')).toBeTruthy();
    expect(screen.getByText('JE-1002')).toBeTruthy();
    expect(screen.getByText('Monthly accrual')).toBeTruthy();
    expect(screen.getAllByText('ACCR-10')).toHaveLength(2);
    expect(screen.getAllByText('100.00').length).toBe(4);
    expect(screen.getAllByText('Draft').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Posted').length).toBeGreaterThan(0);
    expect(screen.getByRole('button', { name: 'Add entry' })).toBeTruthy();
    expect(
      screen.getByRole('button', { name: 'View journal entry JE-1001' }),
    ).toBeTruthy();
    expect(
      screen.getByRole('button', { name: 'Edit journal entry JE-1001' }),
    ).toBeTruthy();
    expect(
      screen.getByRole('button', { name: 'Post journal entry JE-1001' }),
    ).toBeTruthy();
    expect(
      screen.getByRole('button', { name: 'Void journal entry JE-1001' }),
    ).toBeTruthy();
    expect(
      screen.getByRole('button', { name: 'View journal entry JE-1002' }),
    ).toBeTruthy();
    expect(
      screen.queryByRole('button', { name: 'Edit journal entry JE-1002' }),
    ).toBeNull();
    expect(
      screen.queryByRole('button', { name: 'Post journal entry JE-1002' }),
    ).toBeNull();
    expect(
      screen.queryByRole('button', { name: 'Void journal entry JE-1002' }),
    ).toBeNull();
  });

  it('shows a loading indicator before data arrives', async () => {
    setupRoutes([makeEntry()], { listDelayMs: 60 });
    renderPage();
    expect(screen.getByRole('status')).toBeTruthy();
    expect(await screen.findByText('JE-1001')).toBeTruthy();
  });

  it('shows a truthful empty state', async () => {
    setupRoutes([]);
    renderPage();

    expect(await screen.findByText('No journal entries yet')).toBeTruthy();
    expect(
      screen.getByText('Create a draft journal entry to get started.'),
    ).toBeTruthy();
  });

  it('shows a load error and retries', async () => {
    const { setListFailure } = setupRoutes([makeEntry()], {
      listFailure: 500,
    });
    renderPage();

    expect(await screen.findByText('Unable to load journal entries')).toBeTruthy();
    expect(
      screen.getByText(
        'The journal entry request could not be completed. Please try again.',
      ),
    ).toBeTruthy();

    setListFailure(null);
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));

    expect(await screen.findByText('JE-1001')).toBeTruthy();
  });

  it('handles 401 and 403 list responses through the shared error mapping', async () => {
    const first = setupRoutes([makeEntry()], { listFailure: 401 });
    renderPage();
    expect(
      await screen.findByText('Your session has expired. Please sign in again.'),
    ).toBeTruthy();
    first.setListFailure(403);
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(
      await screen.findByText(
        'You do not have permission to load journal entries.',
      ),
    ).toBeTruthy();
  });

  it.each(['VIEWER', 'EMPLOYEE'] as const)(
    'hides mutations from %s users but keeps details available',
    async (role) => {
      setupRoutes([makeEntry()]);
      renderPage(role);

      expect(await screen.findByText('JE-1001')).toBeTruthy();
      expect(screen.getByText('Read-only access')).toBeTruthy();
      expect(screen.queryByRole('button', { name: 'Add entry' })).toBeNull();
      expect(
        screen.queryByRole('button', { name: 'Edit journal entry JE-1001' }),
      ).toBeNull();
      expect(
        screen.queryByRole('button', { name: 'Post journal entry JE-1001' }),
      ).toBeNull();
      expect(
        screen.queryByRole('button', { name: 'Void journal entry JE-1001' }),
      ).toBeNull();
      expect(
        screen.getByRole('button', { name: 'View journal entry JE-1001' }),
      ).toBeTruthy();
    },
  );

  it('fails closed when membership or role cannot be verified', async () => {
    setupRoutes([makeEntry()]);
    renderPage(null, 'Membership information is unavailable.');
    expect(await screen.findByText('Read-only access')).toBeTruthy();
    expect(
      screen.queryByRole('button', { name: 'Add entry' }),
    ).toBeNull();
    expect(
      await screen.findByText('JE-1001'),
    ).toBeTruthy();
  });

  it('applies search only when status and date filters are clear', async () => {
    const { fetchMock } = setupRoutes([
      makeEntry(),
      makeEntry({
        id: postedId,
        entryNumber: 'JE-1002',
        status: 'POSTED',
      }),
    ]);
    renderPage();

    await screen.findByText('JE-1001');
    const searchInput = screen.getByLabelText(
      'Search entry number or reference',
    );
    fireEvent.change(searchInput, { target: { value: ' ACCR-10 ' } });
    fireEvent.click(screen.getByRole('button', { name: 'Search' }));

    await waitFor(() => {
      const calls = journalCalls(fetchMock, 'GET');
      const params = new URL(
        String(calls[calls.length - 1]?.[0]),
        'http://localhost',
      ).searchParams;
      expect(params.get('entryNumber')).toBe('ACCR-10');
      expect(params.get('reference')).toBe('ACCR-10');
      expect(params.has('status')).toBe(false);
      expect(params.has('entryDate')).toBe(false);
    });

    expect(
      (screen.getByLabelText('Status') as HTMLButtonElement).disabled,
    ).toBe(true);
    expect((screen.getByLabelText('Date') as HTMLInputElement).disabled).toBe(
      true,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Clear' }));
    expect((searchInput as HTMLInputElement).value).toBe('');
    expect(
      (screen.getByLabelText('Status') as HTMLButtonElement).disabled,
    ).toBe(false);
  });

  it('applies status and date filters without silently ignoring them', async () => {
    const { fetchMock } = setupRoutes([makeEntry()]);
    renderPage();

    await screen.findByText('JE-1001');
    await chooseOption(screen.getByLabelText('Status'), /^Posted$/);

    await waitFor(() => {
      const calls = journalCalls(fetchMock, 'GET');
      const params = new URL(
        String(calls[calls.length - 1]?.[0]),
        'http://localhost',
      ).searchParams;
      expect(params.get('status')).toBe('POSTED');
      expect(params.has('entryNumber')).toBe(false);
    });

    fireEvent.change(screen.getByLabelText('Date'), {
      target: { value: '2026-10-25' },
    });

    await waitFor(() => {
      const calls = journalCalls(fetchMock, 'GET');
      const params = new URL(
        String(calls[calls.length - 1]?.[0]),
        'http://localhost',
      ).searchParams;
      expect(params.get('status')).toBe('POSTED');
      expect(params.get('entryDate')).toBe('2026-10-25');
    });

    expect(
      (
        screen.getByLabelText(
          'Search entry number or reference',
        ) as HTMLInputElement
      ).disabled,
    ).toBe(true);
    expect(
      screen.getByText(
        'Status and date filters are applied. Clear them to search by entry number or reference.',
      ),
    ).toBeTruthy();
  });

  it('sorts and paginates journal entries', async () => {
    const records = Array.from({ length: 12 }).map((_, index) =>
      makeEntry({
        id: `entry-${index + 1}`,
        entryNumber: `JE-${String(1001 + index)}`,
      }),
    );
    const { fetchMock } = setupRoutes(records);
    renderPage();

    expect(await screen.findByText('JE-1001')).toBeTruthy();
    expect(screen.getByText('JE-1010')).toBeTruthy();
    expect(screen.queryByText('JE-1011')).toBeNull();
    expect(screen.getByText(/Page 1 of 2/)).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    expect(await screen.findByText('JE-1011')).toBeTruthy();
    expect(screen.getByText(/Page 2 of 2/)).toBeTruthy();

    await waitFor(() => {
      const calls = journalCalls(fetchMock, 'GET');
      const params = new URL(
        String(calls[calls.length - 1]?.[0]),
        'http://localhost',
      ).searchParams;
      expect(params.get('page')).toBe('1');
    });

    await chooseOption(screen.getByLabelText('Sort'), /^Recently created$/);
    await waitFor(() => {
      const calls = journalCalls(fetchMock, 'GET');
      const params = new URL(
        String(calls[calls.length - 1]?.[0]),
        'http://localhost',
      ).searchParams;
      expect(params.get('sort')).toBe('createdAt,desc');
      expect(params.get('page')).toBe('0');
    });
  });

  it('shows details with server lines, totals, and helpers', async () => {
    const { fetchMock } = setupRoutes([makeEntry()]);
    renderPage();

    await screen.findByText('JE-1001');
    fireEvent.click(
      screen.getByRole('button', { name: 'View journal entry JE-1001' }),
    );

    const dialog = await screen.findByRole('dialog');
    expect(
      within(dialog).getByText('Journal entry JE-1001'),
    ).toBeTruthy();
    expect(within(dialog).getByText('Cash')).toBeTruthy();
    expect(within(dialog).getByText('1000')).toBeTruthy();
    expect(within(dialog).getByText('Consulting Revenue')).toBeTruthy();
    expect(within(dialog).getByText('4000')).toBeTruthy();
    expect(within(dialog).getByText('Debit line')).toBeTruthy();
    expect(within(dialog).getByText('Monthly accrual')).toBeTruthy();
    expect(within(dialog).getByText('Balanced')).toBeTruthy();
    expect(within(dialog).getByText(testUser.email)).toBeTruthy();
    expect(
      within(dialog).getByRole('button', { name: 'Edit' }),
    ).toBeTruthy();
    expect(
      within(dialog).getByRole('button', { name: 'Post' }),
    ).toBeTruthy();
    expect(
      within(dialog).getByRole('button', { name: 'Void' }),
    ).toBeTruthy();
    expect(
      journalCalls(fetchMock, 'GET', `/api/v1/journal-entries/${draftId}`),
    ).toHaveLength(1);

    fireEvent.click(
      within(dialog).getByRole('button', { name: 'Close details' }),
    );
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  });

  it('opens details from an invoice entry link', async () => {
    setupRoutes([makeEntry()]);
    renderPage('OWNER', null, [
      `/journal-entries?entryId=${draftId}`,
    ]);

    expect(await screen.findByText('Journal entry JE-1001')).toBeTruthy();
  });

  it('shows a detail load error and retries', async () => {
    const { setDetailFailure } = setupRoutes([makeEntry()], {
      detailFailure: 500,
    });
    renderPage();

    await screen.findByText('JE-1001');
    fireEvent.click(
      screen.getByRole('button', { name: 'View journal entry JE-1001' }),
    );

    expect(
      await screen.findByText('Unable to load journal entry'),
    ).toBeTruthy();

    setDetailFailure(null);
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));

    expect(await screen.findByText('Journal entry JE-1001')).toBeTruthy();
    expect(screen.getByText('Balanced')).toBeTruthy();
  });

  it('keeps posted entries read-only in the detail view', async () => {
    setupRoutes([
      makeEntry({
        id: postedId,
        entryNumber: 'JE-1002',
        status: 'POSTED',
      }),
    ]);
    renderPage();

    await screen.findByText('JE-1002');
    fireEvent.click(
      screen.getByRole('button', { name: 'View journal entry JE-1002' }),
    );

    const dialog = await screen.findByRole('dialog');
    expect(
      within(dialog).getByText(
        'Posted entries are read-only. They cannot be edited, voided, or reversed through the current API. Record a new adjusting journal entry to correct a posted entry.',
      ),
    ).toBeTruthy();
    expect(
      within(dialog).queryByRole('button', { name: 'Edit' }),
    ).toBeNull();
    expect(
      within(dialog).queryByRole('button', { name: 'Post' }),
    ).toBeNull();
    expect(
      within(dialog).queryByRole('button', { name: 'Void' }),
    ).toBeNull();
  });

  it('creates a balanced draft once and refreshes from server data', async () => {
    const { fetchMock } = setupRoutes([makeEntry()]);
    renderPage();

    await screen.findByText('JE-1001');
    fireEvent.click(screen.getByRole('button', { name: 'Add entry' }));

    const { dialog, submit } = await waitForCreateReady();

    fireEvent.pointerDown(
      within(dialog).getByLabelText(/Line 1 account/i),
      { button: 0, ctrlKey: false, pointerType: 'mouse' },
    );
    expect(
      await screen.findByRole('option', { name: /1000 — Cash/ }),
    ).toBeTruthy();
    expect(
      screen.queryByRole('option', { name: /Foreign Cash/ }),
    ).toBeNull();
    fireEvent.click(screen.getByRole('option', { name: /1000 — Cash/ }));

    await chooseOption(
      within(dialog).getByLabelText(/Line 2 account/i),
      /4000 — Consulting Revenue/,
    );
    fireEvent.change(within(dialog).getByLabelText(/Entry number/), {
      target: { value: 'JE-2002' },
    });
    fireEvent.change(within(dialog).getByLabelText(/Entry date/), {
      target: { value: '2026-10-26' },
    });
    fireEvent.change(within(dialog).getByLabelText('Reference'), {
      target: { value: 'MANUAL-2' },
    });
    fireEvent.change(within(dialog).getByLabelText('Description'), {
      target: { value: 'Manual adjustment' },
    });
    fireEvent.change(within(dialog).getByLabelText(/Line 1 debit/i), {
      target: { value: '100.25' },
    });
    fireEvent.change(within(dialog).getByLabelText(/Line 2 credit/i), {
      target: { value: '100.25' },
    });

    fireEvent.click(submit);
    fireEvent.click(submit);

    expect(await screen.findByText('Draft journal entry created.')).toBeTruthy();
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(await screen.findByText('JE-2002')).toBeTruthy();

    const postCalls = journalCalls(fetchMock, 'POST');
    expect(postCalls).toHaveLength(1);
    expect(JSON.parse(String(postCalls[0]?.[1]?.body))).toEqual({
      entryNumber: 'JE-2002',
      entryDate: '2026-10-26',
      description: 'Manual adjustment',
      reference: 'MANUAL-2',
      lines: [
        {
          accountId: cashId,
          description: '',
          debitAmount: 100.25,
          creditAmount: 0,
        },
        {
          accountId: revenueId,
          description: '',
          debitAmount: 0,
          creditAmount: 100.25,
        },
      ],
    });
  });

  it('prevents duplicate submissions while creating', async () => {
    const { fetchMock } = setupRoutes([makeEntry()]);
    renderPage();

    await screen.findByText('JE-1001');
    fireEvent.click(screen.getByRole('button', { name: 'Add entry' }));
    const { dialog, submit } = await waitForCreateReady();
    await fillValidCreateForm(dialog);

    fireEvent.click(submit);
    fireEvent.click(submit);

    expect(await screen.findByText('Draft journal entry created.')).toBeTruthy();
    expect(journalCalls(fetchMock, 'POST')).toHaveLength(1);
  });

  it('keeps input and shows line errors from backend validation', async () => {
    const { fetchMock } = setupRoutes([makeEntry()], {
      createFailure: {
        status: 400,
        body: {
          message: 'Validation failed',
          fieldErrors: {
            'lines[1].creditAmount': 'creditAmount must be positive',
          },
        },
      },
    });
    renderPage();

    await screen.findByText('JE-1001');
    fireEvent.click(screen.getByRole('button', { name: 'Add entry' }));
    const { dialog, submit } = await waitForCreateReady();
    await fillValidCreateForm(dialog);

    fireEvent.click(submit);

    expect(await screen.findByText('Unable to save journal entry')).toBeTruthy();
    expect(
      await screen.findByText('creditAmount must be positive'),
    ).toBeTruthy();
    expect(screen.getByRole('dialog')).toBeTruthy();
    expect(
      (
        within(dialog).getByLabelText(/Entry number/) as HTMLInputElement
      ).value,
    ).toBe('JE-2002');
    expect(journalCalls(fetchMock, 'POST')).toHaveLength(1);
  });

  it('blocks invalid and unbalanced forms without sending a request', async () => {
    const { fetchMock } = setupRoutes([makeEntry()]);
    renderPage();

    await screen.findByText('JE-1001');
    fireEvent.click(screen.getByRole('button', { name: 'Add entry' }));
    const { dialog, submit } = await waitForCreateReady();

    fireEvent.click(submit);
    expect(await screen.findByText('Entry number is required.')).toBeTruthy();
    expect(screen.getAllByText('Select an account.')).toHaveLength(2);
    expect(
      screen.getByText('Entry must include at least one debit and one credit line.'),
    ).toBeTruthy();
    expect(journalCalls(fetchMock, 'POST')).toHaveLength(0);

    fireEvent.change(within(dialog).getByLabelText(/Entry number/), {
      target: { value: 'JE-2002' },
    });
    fireEvent.change(within(dialog).getByLabelText(/Entry date/), {
      target: { value: '2026-10-26' },
    });
    await chooseOption(
      within(dialog).getByLabelText(/Line 1 account/i),
      /1000 — Cash/,
    );
    await chooseOption(
      within(dialog).getByLabelText(/Line 2 account/i),
      /4000 — Consulting Revenue/,
    );
    fireEvent.change(within(dialog).getByLabelText(/Line 1 debit/i), {
      target: { value: '100' },
    });
    fireEvent.change(within(dialog).getByLabelText(/Line 2 credit/i), {
      target: { value: '99' },
    });
    fireEvent.click(submit);

    expect(
      await screen.findByText('Total debits must equal total credits.'),
    ).toBeTruthy();
    expect(journalCalls(fetchMock, 'POST')).toHaveLength(0);
  });

  it('edits a draft with only changed fields and avoids empty updates', async () => {
    const { fetchMock } = setupRoutes([makeEntry()]);
    renderPage();

    await screen.findByText('JE-1001');
    fireEvent.click(
      screen.getByRole('button', { name: 'Edit journal entry JE-1001' }),
    );

    const dialog = await screen.findByRole('dialog');
    const save = within(dialog).getByRole('button', {
      name: 'Save changes',
    });
    await waitFor(() => expect((save as HTMLButtonElement).disabled).toBe(true));
    expect(
      (
        within(dialog).getByLabelText(/Entry number/) as HTMLInputElement
      ).value,
    ).toBe('JE-1001');

    fireEvent.change(within(dialog).getByLabelText('Reference'), {
      target: { value: 'ACCR-11' },
    });
    await waitFor(() => expect((save as HTMLButtonElement).disabled).toBe(false));
    fireEvent.click(save);

    expect(
      await screen.findByText('Draft journal entry updated.'),
    ).toBeTruthy();
    expect(await screen.findByText('ACCR-11')).toBeTruthy();

    const putCalls = journalCalls(
      fetchMock,
      'PUT',
      `/api/v1/journal-entries/${draftId}`,
    );
    expect(putCalls).toHaveLength(1);
    expect(JSON.parse(String(putCalls[0]?.[1]?.body))).toEqual({
      reference: 'ACCR-11',
    });
  });

  it('posts a draft only after confirmation and refreshes server state', async () => {
    const { fetchMock } = setupRoutes([makeEntry()]);
    renderPage();

    await screen.findByText('JE-1001');
    fireEvent.click(
      screen.getByRole('button', { name: 'Post journal entry JE-1001' }),
    );

    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText('Post journal entry?')).toBeTruthy();
    fireEvent.click(
      within(dialog).getByRole('button', { name: 'Post entry' }),
    );

    expect(await screen.findByText('Journal entry posted.')).toBeTruthy();
    await waitFor(() =>
      expect(
        screen.queryByRole('button', { name: 'Post journal entry JE-1001' }),
      ).toBeNull(),
    );
    expect(
      journalCalls(fetchMock, 'POST', `/api/v1/journal-entries/${draftId}/post`),
    ).toHaveLength(1);
  });

  it('voids a draft only after confirmation', async () => {
    const { fetchMock } = setupRoutes([makeEntry()]);
    renderPage();

    await screen.findByText('JE-1001');
    fireEvent.click(
      screen.getByRole('button', { name: 'Void journal entry JE-1001' }),
    );

    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText('Void journal entry?')).toBeTruthy();
    fireEvent.click(
      within(dialog).getByRole('button', { name: 'Void entry' }),
    );

    expect(await screen.findByText('Journal entry voided.')).toBeTruthy();
    expect(
      journalCalls(fetchMock, 'DELETE', `/api/v1/journal-entries/${draftId}`),
    ).toHaveLength(1);
  });

  it('shows invalid status transitions without changing the UI state', async () => {
    setupRoutes([makeEntry()], {
      postFailure: {
        status: 409,
        body: { message: 'Only DRAFT entries can be posted. Current status: VOID' },
      },
    });
    renderPage();

    await screen.findByText('JE-1001');
    fireEvent.click(
      screen.getByRole('button', { name: 'Post journal entry JE-1001' }),
    );

    const dialog = await screen.findByRole('dialog');
    fireEvent.click(
      within(dialog).getByRole('button', { name: 'Post entry' }),
    );

    expect(
      await screen.findByText(
        'Only DRAFT entries can be posted. Current status: VOID',
      ),
    ).toBeTruthy();
    expect(screen.queryByText('Journal entry posted.')).toBeNull();
    expect(screen.getByRole('dialog')).toBeTruthy();

    fireEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(
      screen.getByRole('button', { name: 'Post journal entry JE-1001' }),
    ).toBeTruthy();
  });
});
