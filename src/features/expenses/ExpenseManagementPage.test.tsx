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
import { createFetchMock, jsonResponse, testOrganization, testUser } from 'src/test/api-fixtures';
import { ExpenseManagementPage } from './ExpenseManagementPage';
import type { AccountOption, ExpenseRecord, VendorOption } from './types';

const expenseId = '55555555-5555-5555-5555-555555555555';
const expenseAccountId = '66666666-6666-6666-6666-666666666666';
const paymentAccountId = '77777777-7777-7777-7777-777777777777';
const vendorId = '88888888-8888-8888-8888-888888888888';

const accounts: AccountOption[] = [
  { id: paymentAccountId, code: '1000', name: 'Cash', type: 'ASSET', active: true },
  {
    id: expenseAccountId,
    code: '5000',
    name: 'Software Expense',
    type: 'EXPENSE',
    active: true,
  },
];

const vendors: VendorOption[] = [{ id: vendorId, name: 'Acme Digital' }];

function makeExpense(overrides: Partial<ExpenseRecord> = {}): ExpenseRecord {
  return {
    id: expenseId,
    organizationId: testOrganization.id,
    organizationName: testOrganization.name,
    vendorId,
    vendorName: 'Acme Digital',
    expenseAccountId,
    expenseAccountCode: '5000',
    expenseAccountName: 'Software Expense',
    paymentAccountId,
    paymentAccountCode: '1000',
    paymentAccountName: 'Cash',
    amount: 350,
    expenseDate: '2026-10-05',
    description: 'Design subscription',
    reference: 'REF-100',
    status: 'DRAFT',
    journalEntryId: null,
    createdBy: testUser.id,
    createdByEmail: testUser.email,
    createdAt: '2026-10-05T12:00:00Z',
    updatedAt: '2026-10-05T12:00:00Z',
    ...overrides,
  };
}

function makePage<T>(content: T[], page = 0, size = 10) {
  return {
    content,
    totalElements: content.length,
    totalPages: content.length ? 1 : 0,
    number: page,
    size,
    first: page === 0,
    last: true,
    numberOfElements: content.length,
    empty: content.length === 0,
  };
}

function createAuthValue(role: MembershipRole | null): AuthContextValue {
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

function renderPage(role: MembershipRole | null = 'OWNER') {
  render(
    <MemoryRouter initialEntries={['/expenses']}>
      <AuthContext.Provider value={createAuthValue(role)}>
        <ExpenseManagementPage />
      </AuthContext.Provider>
    </MemoryRouter>,
  );
}

function setupExpenseRoutes(
  initialRecords: ExpenseRecord[],
  options: { getFailure?: number | null; postDelayMs?: number } = {},
) {
  let records = initialRecords;
  let getFailure = options.getFailure ?? null;
  const id = initialRecords[0]?.id ?? expenseId;

  const fetchMock = createFetchMock([
    {
      path: '/api/v1/expenses',
      handler: () => {
        if (getFailure) return jsonResponse({ message: 'Failed' }, getFailure);
        return jsonResponse(makePage(records));
      },
    },
    {
      method: 'POST',
      path: '/api/v1/expenses',
      handler: async ({ body }) => {
        if (options.postDelayMs) {
          await new Promise((resolve) => setTimeout(resolve, options.postDelayMs));
        }
        const input = body as Partial<ExpenseRecord>;
        const created = makeExpense({
          id: '99999999-9999-9999-9999-999999999999',
          ...input,
          status: 'DRAFT',
          journalEntryId: null,
          createdAt: '2026-10-20T12:00:00Z',
          updatedAt: '2026-10-20T12:00:00Z',
        });
        records = [created, ...records];
        return jsonResponse(created, 201);
      },
    },
    {
      method: 'PUT',
      path: `/api/v1/expenses/${id}`,
      handler: ({ body }) => {
        const updated = { ...records[0], ...(body as Partial<ExpenseRecord>) };
        records = [updated];
        return jsonResponse(updated);
      },
    },
    {
      method: 'POST',
      path: `/api/v1/expenses/${id}/record`,
      handler: () => {
        const recorded = {
          ...records[0],
          status: 'RECORDED' as const,
          journalEntryId: 'journal-1',
          updatedAt: '2026-10-21T12:00:00Z',
        };
        records = [recorded];
        return jsonResponse(recorded);
      },
    },
    {
      method: 'DELETE',
      path: `/api/v1/expenses/${id}`,
      handler: () => {
        const voided = { ...records[0], status: 'VOID' as const };
        records = [voided];
        return jsonResponse(voided);
      },
    },
    {
      path: '/api/v1/accounts',
      handler: () => jsonResponse(makePage(accounts)),
    },
    {
      path: '/api/v1/vendors',
      handler: () => jsonResponse(makePage(vendors)),
    },
  ]);

  vi.stubGlobal('fetch', fetchMock);

  return {
    fetchMock,
    setGetFailure: (status: number | null) => {
      getFailure = status;
    },
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

describe('ExpenseManagementPage', () => {
  it('loads and displays expenses with draft actions', async () => {
    setupExpenseRoutes([makeExpense()]);
    renderPage();

    expect(await screen.findByText('Design subscription')).toBeTruthy();
    expect(screen.getByText('Software Expense')).toBeTruthy();
    expect(screen.getByText('$350.00')).toBeTruthy();
    expect(screen.getAllByText('Draft').length).toBeGreaterThan(0);
    expect(screen.getByRole('button', { name: 'Edit expense from 2026-10-05' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Record expense from 2026-10-05' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Void expense from 2026-10-05' })).toBeTruthy();
  });

  it('searches by reference and sends the backend filter', async () => {
    const { fetchMock } = setupExpenseRoutes([makeExpense()]);
    renderPage();

    await screen.findByText('Design subscription');
    const searchInput = screen.getByLabelText('Search reference or description');
    fireEvent.change(searchInput, { target: { value: 'REF-100' } });
    const searchForm = searchInput.closest('form');
    expect(searchForm).toBeTruthy();
    fireEvent.submit(searchForm!);

    await waitFor(() => {
      expect(
        fetchMock.mock.calls.some(([input]) => {
          const url = String(input);
          return url.includes('/api/v1/expenses') && url.includes('reference=REF-100');
        }),
      ).toBe(true);
    });
  });

  it('creates a draft with loaded accounts and vendor without duplicate submits', async () => {
    const { fetchMock } = setupExpenseRoutes([makeExpense()], { postDelayMs: 80 });
    renderPage();

    await screen.findByText('Design subscription');
    fireEvent.click(screen.getByRole('button', { name: 'Add expense' }));

    const dialog = await screen.findByRole('dialog');
    await waitFor(() =>
      expect(
        (
          within(dialog).getByRole('button', {
            name: 'Create draft',
          }) as HTMLButtonElement
        ).disabled,
      ).toBe(false),
    );

    await chooseOption(
      within(dialog).getByLabelText(/Expense account/),
      /Software Expense/,
    );
    await chooseOption(
      within(dialog).getByLabelText(/Paid from/),
      /Cash/,
    );
    await chooseOption(within(dialog).getByLabelText(/^Vendor/), /Acme Digital/);

    fireEvent.change(within(dialog).getByLabelText(/Amount \(USD\)/), {
      target: { value: '42.50' },
    });
    fireEvent.change(within(dialog).getByLabelText('Description'), {
      target: { value: 'New subscription' },
    });
    fireEvent.change(within(dialog).getByLabelText('Reference'), {
      target: { value: 'REF-NEW' },
    });

    const submit = within(dialog).getByRole('button', { name: 'Create draft' });
    fireEvent.click(submit);
    fireEvent.click(submit);

    expect(await screen.findByText('Draft expense created.')).toBeTruthy();
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(await screen.findByText('New subscription')).toBeTruthy();

    const postCalls = fetchMock.mock.calls.filter(
      ([, init]) => (init?.method ?? 'GET').toUpperCase() === 'POST',
    );
    expect(postCalls).toHaveLength(1);
    expect(JSON.parse(String(postCalls[0]?.[1]?.body))).toEqual({
      vendorId,
      expenseAccountId,
      paymentAccountId,
      amount: 42.5,
      expenseDate: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
      description: 'New subscription',
      reference: 'REF-NEW',
    });
  });

  it('keeps the form open and reports validation errors', async () => {
    const { fetchMock } = setupExpenseRoutes([makeExpense()]);
    renderPage();

    await screen.findByText('Design subscription');
    fireEvent.click(screen.getByRole('button', { name: 'Add expense' }));
    const dialog = await screen.findByRole('dialog');

    await waitFor(() =>
      expect(
        (
          within(dialog).getByRole('button', {
            name: 'Create draft',
          }) as HTMLButtonElement
        ).disabled,
      ).toBe(false),
    );
    fireEvent.click(within(dialog).getByRole('button', { name: 'Create draft' }));

    expect(await screen.findByText('Enter an amount.')).toBeTruthy();
    expect(screen.getByText('Choose an expense account.')).toBeTruthy();
    expect(screen.getByText('Choose a payment account.')).toBeTruthy();
    expect(
      fetchMock.mock.calls.filter(
        ([, init]) => (init?.method ?? 'GET').toUpperCase() === 'POST',
      ),
    ).toHaveLength(0);
  });

  it('updates only changed draft fields', async () => {
    const { fetchMock } = setupExpenseRoutes([makeExpense()]);
    renderPage();

    await screen.findByText('Design subscription');
    fireEvent.click(screen.getByRole('button', { name: 'Edit expense from 2026-10-05' }));

    const dialog = await screen.findByRole('dialog');
    await waitFor(() =>
      expect(
        (
          within(dialog).getByRole('button', {
            name: 'Save changes',
          }) as HTMLButtonElement
        ).disabled,
      ).toBe(false),
    );

    fireEvent.change(within(dialog).getByLabelText(/Amount \(USD\)/), {
      target: { value: '400' },
    });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Save changes' }));

    expect(await screen.findByText('Draft expense updated.')).toBeTruthy();
    const putCall = fetchMock.mock.calls.find(
      ([, init]) => (init?.method ?? 'GET').toUpperCase() === 'PUT',
    );
    expect(JSON.parse(String(putCall?.[1]?.body))).toEqual({ amount: 400 });
  });

  it('records a draft after confirmation and refreshes its status', async () => {
    const { fetchMock } = setupExpenseRoutes([makeExpense()]);
    renderPage();

    await screen.findByText('Design subscription');
    fireEvent.click(
      screen.getByRole('button', { name: 'Record expense from 2026-10-05' }),
    );

    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText('Record this expense?')).toBeTruthy();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Record expense' }));

    expect(
      await screen.findByText('Expense recorded. The journal entry has been posted.'),
    ).toBeTruthy();
    expect(await screen.findByText('Recorded')).toBeTruthy();
    expect(
      fetchMock.mock.calls.filter(
        ([input, init]) =>
          (init?.method ?? 'GET').toUpperCase() === 'POST' &&
          String(input).includes(`/api/v1/expenses/${expenseId}/record`),
      ),
    ).toHaveLength(1);
    expect(
      screen.queryByRole('button', { name: 'Record expense from 2026-10-05' }),
    ).toBeNull();
  });

  it('voids a draft and keeps it visible in the list', async () => {
    setupExpenseRoutes([makeExpense()]);
    renderPage();

    await screen.findByText('Design subscription');
    fireEvent.click(screen.getByRole('button', { name: 'Void expense from 2026-10-05' }));

    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText('Void this draft expense?')).toBeTruthy();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Void expense' }));

    expect(await screen.findByText('Draft expense voided.')).toBeTruthy();
    expect(await screen.findByText('Void')).toBeTruthy();
    expect(screen.getByText('Design subscription')).toBeTruthy();
  });

  it.each(['VIEWER', 'EMPLOYEE'] as const)(
    'hides all mutation actions from %s users',
    async (role) => {
      setupExpenseRoutes([makeExpense()]);
      renderPage(role);

      expect(await screen.findByText('Design subscription')).toBeTruthy();
      expect(screen.getByText('Read-only access')).toBeTruthy();
      expect(screen.queryByRole('button', { name: 'Add expense' })).toBeNull();
      expect(
        screen.queryByRole('button', { name: 'Edit expense from 2026-10-05' }),
      ).toBeNull();
      expect(
        screen.queryByRole('button', { name: 'Record expense from 2026-10-05' }),
      ).toBeNull();
      expect(
        screen.queryByRole('button', { name: 'Void expense from 2026-10-05' }),
      ).toBeNull();
    },
  );

  it('allows accountants to manage draft expenses', async () => {
    setupExpenseRoutes([makeExpense()]);
    renderPage('ACCOUNTANT');

    expect(await screen.findByText('Design subscription')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Add expense' })).toBeTruthy();
    expect(
      screen.getByRole('button', { name: 'Edit expense from 2026-10-05' }),
    ).toBeTruthy();
  });

  it('shows a load error and retries', async () => {
    const { setGetFailure } = setupExpenseRoutes([makeExpense()], {
      getFailure: 500,
    });
    renderPage();

    expect(await screen.findByText('Unable to load expenses')).toBeTruthy();
    expect(
      screen.getByText('The expense request could not be completed. Please try again.'),
    ).toBeTruthy();

    setGetFailure(null);
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));

    expect(await screen.findByText('Design subscription')).toBeTruthy();
  });
});
