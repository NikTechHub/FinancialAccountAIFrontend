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
} from 'src/test/api-fixtures';
import { AccountManagementPage } from './AccountManagementPage';
import type { AccountRecord, AccountTreeNode } from './types';

const assetId = '77777777-7777-7777-7777-777777777777';
const revenueId = '88888888-8888-8888-8888-888888888888';
const systemId = '99999999-9999-9999-9999-999999999999';
const parentId = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';

const parentTree: AccountTreeNode[] = [
  {
    id: parentId,
    code: '1000',
    name: 'Current Assets',
    type: 'ASSET',
    active: true,
    children: [],
  },
];

function makeAccount(overrides: Partial<AccountRecord> = {}): AccountRecord {
  return {
    id: assetId,
    organizationId: testOrganization.id,
    organizationName: testOrganization.name,
    code: '1010',
    name: 'Cash',
    type: 'ASSET',
    parentAccountId: null,
    parentAccountName: null,
    description: 'Operating cash',
    active: true,
    systemAccount: false,
    createdAt: '2026-01-02T00:00:00Z',
    updatedAt: '2026-01-02T00:00:00Z',
    ...overrides,
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
) {
  render(
    <MemoryRouter initialEntries={['/accounts']}>
      <AuthContext.Provider value={createAuthValue(role, membershipError)}>
        <AccountManagementPage />
      </AuthContext.Provider>
    </MemoryRouter>,
  );
}

function accountCalls(
  fetchMock: ReturnType<typeof createFetchMock>,
  method: string,
  path = '/api/v1/accounts',
) {
  return fetchMock.mock.calls.filter(([input, init]) => {
    const requestMethod = (init?.method ?? 'GET').toUpperCase();
    const requestPath = new URL(String(input), 'http://localhost').pathname;
    return requestMethod === method && requestPath === path;
  });
}

function setupAccountRoutes(
  initialRecords: AccountRecord[],
  options: {
    getFailure?: number | null;
    postFailure?: number | null;
    tree?: AccountTreeNode[];
    postDelayMs?: number;
  } = {},
) {
  let records = initialRecords;
  let getFailure = options.getFailure ?? null;

  const fetchMock = createFetchMock([
    {
      path: '/api/v1/accounts',
      handler: ({ url }) => {
        if (getFailure) return jsonResponse({ message: 'Failed' }, getFailure);

        const params = new URL(url, 'http://localhost').searchParams;
        const page = Number(params.get('page') ?? 0);
        const size = Number(params.get('size') ?? 10);
        const search = (params.get('search') ?? '').toLowerCase();
        const type = params.get('type') ?? '';

        const filtered = records
          .filter((record) => record.active)
          .filter(
            (record) =>
              !search ||
              record.code.toLowerCase().includes(search) ||
              record.name.toLowerCase().includes(search),
          )
          .filter((record) => !type || record.type === type);

        const content = filtered.slice(page * size, (page + 1) * size);
        const totalPages = Math.ceil(filtered.length / size);

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
      path: '/api/v1/accounts/tree',
      handler: () => jsonResponse(options.tree ?? parentTree),
    },
    {
      method: 'POST',
      path: '/api/v1/accounts',
      handler: async ({ body }) => {
        if (options.postDelayMs) {
          await new Promise((resolve) => setTimeout(resolve, options.postDelayMs));
        }
        if (options.postFailure) {
          return jsonResponse(
            {
              message: 'Account already exists with code: 1010',
            },
            options.postFailure,
          );
        }

        const input = body as {
          code: string;
          name: string;
          type: AccountRecord['type'];
          parentAccountId?: string;
          description: string;
        };
        const parent = input.parentAccountId
          ? (options.tree ?? parentTree).find(
              (node) => node.id === input.parentAccountId,
            )
          : null;
        const created = makeAccount({
          id: `created-${records.length + 1}`,
          code: input.code,
          name: input.name,
          type: input.type,
          parentAccountId: input.parentAccountId ?? null,
          parentAccountName: parent?.name ?? null,
          description: input.description,
          createdAt: '2026-01-03T00:00:00Z',
          updatedAt: '2026-01-03T00:00:00Z',
        });
        records = [created, ...records];
        return jsonResponse(created, 201);
      },
    },
    {
      method: 'PUT',
      path: `/api/v1/accounts/${assetId}`,
      handler: ({ body }) => {
        const current = records.find((record) => record.id === assetId);
        if (!current) throw new Error('Missing account fixture');

        const input = body as Partial<AccountRecord> & {
          parentAccountId?: string;
        };
        const parent = input.parentAccountId
          ? (options.tree ?? parentTree).find(
              (node) => node.id === input.parentAccountId,
            )
          : null;
        const updated = {
          ...current,
          ...input,
          parentAccountName:
            input.parentAccountId === undefined
              ? current.parentAccountName
              : (parent?.name ?? null),
          updatedAt: '2026-01-04T00:00:00Z',
        };
        records = records.map((record) =>
          record.id === assetId ? updated : record,
        );
        return jsonResponse(updated);
      },
    },
    {
      method: 'DELETE',
      path: `/api/v1/accounts/${assetId}`,
      handler: () => {
        records = records.map((record) =>
          record.id === assetId ? { ...record, active: false } : record,
        );
        return new Response(null, { status: 204 });
      },
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

async function waitForParentOptions() {
  const trigger = screen.getByLabelText(/^Parent account/);
  await waitFor(() => {
    expect((trigger as HTMLButtonElement).disabled).toBe(false);
  });
  return trigger;
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

describe('AccountManagementPage', () => {
  it('loads active accounts with server fields and actions', async () => {
    setupAccountRoutes([
      makeAccount({
        parentAccountId: parentId,
        parentAccountName: 'Current Assets',
      }),
      makeAccount({
        id: revenueId,
        code: '4000',
        name: 'Consulting Revenue',
        type: 'REVENUE',
        description: null,
      }),
      makeAccount({
        id: systemId,
        code: '1100',
        name: 'Accounts Receivable',
        description: null,
        systemAccount: true,
      }),
    ]);
    renderPage();

    expect(await screen.findByText('1010')).toBeTruthy();
    expect(screen.getByText('Cash')).toBeTruthy();
    expect(screen.getByText('Operating cash')).toBeTruthy();
    expect(screen.getByText('Current Assets')).toBeTruthy();
    expect(screen.getByText('Consulting Revenue')).toBeTruthy();
    expect(screen.getByText('Revenue')).toBeTruthy();
    expect(screen.getByText('System')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Add account' })).toBeTruthy();
    expect(
      screen.getByRole('button', { name: 'Edit account 1010' }),
    ).toBeTruthy();
    expect(
      screen.getByRole('button', { name: 'Deactivate account 1010' }),
    ).toBeTruthy();
    expect(
      screen.queryByRole('button', { name: 'Deactivate account 1100' }),
    ).toBeNull();
    expect(screen.getByText(/Page 1 of 1/)).toBeTruthy();
    expect(screen.getByText(/3 accounts/)).toBeTruthy();
  });

  it('shows the empty state when there are no active accounts', async () => {
    setupAccountRoutes([]);
    renderPage();

    expect(await screen.findByText('No accounts yet')).toBeTruthy();
    expect(
      screen.getByText('Add an account to build your chart of accounts.'),
    ).toBeTruthy();
  });

  it('applies search, type, and sort parameters', async () => {
    const { fetchMock } = setupAccountRoutes([
      makeAccount(),
      makeAccount({
        id: revenueId,
        code: '4000',
        name: 'Consulting Revenue',
        type: 'REVENUE',
      }),
    ]);
    renderPage();

    await screen.findByText('1010');
    await chooseOption(screen.getByLabelText('Type'), /^Revenue$/);

    await waitFor(() => {
      const calls = accountCalls(fetchMock, 'GET');
      const last = calls[calls.length - 1];
      const params = new URL(String(last?.[0]), 'http://localhost').searchParams;
      expect(params.get('type')).toBe('REVENUE');
      expect(params.get('page')).toBe('0');
    });

    fireEvent.change(screen.getByLabelText('Search accounts by code or name'), {
      target: { value: 'consulting' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Search' }));

    await waitFor(() => {
      const calls = accountCalls(fetchMock, 'GET');
      const last = calls[calls.length - 1];
      const params = new URL(String(last?.[0]), 'http://localhost').searchParams;
      expect(params.get('search')).toBe('consulting');
      expect(params.get('type')).toBe('REVENUE');
    });

    await chooseOption(screen.getByLabelText('Sort'), /^Name A–Z$/);

    await waitFor(() => {
      const calls = accountCalls(fetchMock, 'GET');
      const last = calls[calls.length - 1];
      const params = new URL(String(last?.[0]), 'http://localhost').searchParams;
      expect(params.get('sort')).toBe('name,asc');
    });
  });

  it('paginates through account results', async () => {
    const records = Array.from({ length: 12 }).map((_, index) =>
      makeAccount({
        id: `account-${index + 1}`,
        code: String(1000 + index),
        name: `Account ${String(index + 1).padStart(2, '0')}`,
      }),
    );
    setupAccountRoutes(records);
    renderPage();

    expect(await screen.findByText('Account 01')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));

    expect(await screen.findByText('Account 11')).toBeTruthy();
    expect(screen.getByText(/Page 2 of 2/)).toBeTruthy();
    expect(screen.getByText('Account 12')).toBeTruthy();
  });

  it('creates an account with a parent and refreshes the list', async () => {
    const { fetchMock } = setupAccountRoutes([makeAccount()]);
    renderPage();

    await screen.findByText('1010');
    fireEvent.click(screen.getByRole('button', { name: 'Add account' }));

    const dialog = await screen.findByRole('dialog');
    fireEvent.change(
      within(dialog).getByRole('textbox', { name: /^Account code/ }),
      { target: { value: '1020' } },
    );
    fireEvent.change(
      within(dialog).getByRole('textbox', { name: /^Account name/ }),
      { target: { value: 'Petty Cash' } },
    );
    await chooseOption(
      within(dialog).getByLabelText(/^Account type/),
      /^Asset$/,
    );
    const parentTrigger = await waitForParentOptions();
    await chooseOption(parentTrigger, /1000 — Current Assets/);
    fireEvent.change(
      within(dialog).getByRole('textbox', { name: /^Description/ }),
      { target: { value: 'Small cash purchases' } },
    );
    fireEvent.click(
      within(dialog).getByRole('button', { name: 'Create account' }),
    );

    expect(await screen.findByText('Account created.')).toBeTruthy();
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(await screen.findByText('Petty Cash')).toBeTruthy();

    const postCall = accountCalls(fetchMock, 'POST')[0];
    expect(JSON.parse(String(postCall?.[1]?.body))).toEqual({
      code: '1020',
      name: 'Petty Cash',
      type: 'ASSET',
      parentAccountId: parentId,
      description: 'Small cash purchases',
    });
  });

  it('prevents duplicate submissions while creating an account', async () => {
    const { fetchMock } = setupAccountRoutes([makeAccount()], {
      postDelayMs: 150,
    });
    renderPage();

    await screen.findByText('1010');
    fireEvent.click(screen.getByRole('button', { name: 'Add account' }));

    const dialog = await screen.findByRole('dialog');
    fireEvent.change(
      within(dialog).getByRole('textbox', { name: /^Account code/ }),
      { target: { value: '1020' } },
    );
    fireEvent.change(
      within(dialog).getByRole('textbox', { name: /^Account name/ }),
      { target: { value: 'Petty Cash' } },
    );
    await chooseOption(
      within(dialog).getByLabelText(/^Account type/),
      /^Asset$/,
    );

    const submit = within(dialog).getByRole('button', {
      name: 'Create account',
    });
    fireEvent.click(submit);
    fireEvent.click(submit);

    expect(await screen.findByText('Account created.')).toBeTruthy();
    expect(accountCalls(fetchMock, 'POST')).toHaveLength(1);
  });

  it('validates required fields without sending a request', async () => {
    const { fetchMock } = setupAccountRoutes([makeAccount()]);
    renderPage();

    await screen.findByText('1010');
    fireEvent.click(screen.getByRole('button', { name: 'Add account' }));

    const dialog = await screen.findByRole('dialog');
    fireEvent.click(
      within(dialog).getByRole('button', { name: 'Create account' }),
    );

    expect(await screen.findByText('Account code is required.')).toBeTruthy();
    expect(screen.getByText('Account name is required.')).toBeTruthy();
    expect(screen.getByText('Select an account type.')).toBeTruthy();
    expect(screen.getByRole('dialog')).toBeTruthy();
    expect(accountCalls(fetchMock, 'POST')).toHaveLength(0);
  });

  it('keeps input and shows field errors on a duplicate code', async () => {
    const { fetchMock } = setupAccountRoutes([makeAccount()], {
      postFailure: 409,
    });
    renderPage();

    await screen.findByText('1010');
    fireEvent.click(screen.getByRole('button', { name: 'Add account' }));

    const dialog = await screen.findByRole('dialog');
    const code = within(dialog).getByRole('textbox', { name: /^Account code/ });
    fireEvent.change(code, { target: { value: '1010' } });
    fireEvent.change(
      within(dialog).getByRole('textbox', { name: /^Account name/ }),
      { target: { value: 'Duplicate Cash' } },
    );
    await chooseOption(
      within(dialog).getByLabelText(/^Account type/),
      /^Asset$/,
    );
    fireEvent.click(
      within(dialog).getByRole('button', { name: 'Create account' }),
    );

    expect(await screen.findByText('Unable to save account')).toBeTruthy();
    expect(
      screen.getAllByText(
        'An account with this code already exists. Use a different code.',
      ).length,
    ).toBeGreaterThan(0);
    expect((code as HTMLInputElement).value).toBe('1010');
    expect(screen.getByRole('dialog')).toBeTruthy();
    expect(accountCalls(fetchMock, 'POST')).toHaveLength(1);
  });

  it('edits an account and persists the supported fields', async () => {
    const { fetchMock } = setupAccountRoutes([makeAccount()]);
    renderPage();

    await screen.findByText('1010');
    fireEvent.click(screen.getByRole('button', { name: 'Edit account 1010' }));

    const dialog = await screen.findByRole('dialog');
    const name = within(dialog).getByRole('textbox', { name: /^Account name/ });
    expect((name as HTMLInputElement).value).toBe('Cash');
    expect(
      (within(dialog).getByRole('textbox', {
        name: /^Account code/,
      }) as HTMLInputElement).value,
    ).toBe('1010');

    fireEvent.change(name, { target: { value: 'Cash on hand' } });
    fireEvent.change(
      within(dialog).getByRole('textbox', { name: /^Description/ }),
      { target: { value: 'Updated cash account' } },
    );
    await waitForParentOptions();
    fireEvent.click(
      within(dialog).getByRole('button', { name: 'Save changes' }),
    );

    expect(await screen.findByText('Account updated.')).toBeTruthy();
    expect(await screen.findByText('Cash on hand')).toBeTruthy();

    const putCall = accountCalls(fetchMock, 'PUT', `/api/v1/accounts/${assetId}`)[0];
    expect(JSON.parse(String(putCall?.[1]?.body))).toEqual({
      code: '1010',
      name: 'Cash on hand',
      type: 'ASSET',
      description: 'Updated cash account',
    });
  });

  it('deactivates through a confirmation and removes the account', async () => {
    const { fetchMock } = setupAccountRoutes([makeAccount()]);
    renderPage();

    await screen.findByText('1010');
    fireEvent.click(
      screen.getByRole('button', { name: 'Deactivate account 1010' }),
    );

    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText('Deactivate account?')).toBeTruthy();
    fireEvent.click(
      within(dialog).getByRole('button', { name: 'Deactivate account' }),
    );

    expect(await screen.findByText('Account deactivated.')).toBeTruthy();
    await waitFor(() => expect(screen.queryByText('Cash')).toBeNull());
    expect(
      accountCalls(fetchMock, 'DELETE', `/api/v1/accounts/${assetId}`),
    ).toHaveLength(1);
  });

  it('shows unknown-role fallback as read-only', async () => {
    setupAccountRoutes([makeAccount()]);
    renderPage(null);

    expect(await screen.findByText('Read-only access')).toBeTruthy();
    expect(await screen.findByText('Cash')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Add account' })).toBeNull();
    expect(
      screen.queryByRole('button', { name: 'Edit account 1010' }),
    ).toBeNull();
  });

  it.each(['VIEWER', 'EMPLOYEE'] as const)(
    'hides mutations from %s users',
    async (role) => {
      setupAccountRoutes([makeAccount()]);
      renderPage(role);

      expect(await screen.findByText('Read-only access')).toBeTruthy();
      expect(await screen.findByText('Cash')).toBeTruthy();
      expect(screen.queryByRole('button', { name: 'Add account' })).toBeNull();
      expect(
        screen.queryByRole('button', { name: 'Edit account 1010' }),
      ).toBeNull();
      expect(
        screen.queryByRole('button', { name: 'Deactivate account 1010' }),
      ).toBeNull();
    },
  );

  it('shows a membership error and keeps the list read-only', async () => {
    setupAccountRoutes([makeAccount()]);
    renderPage(null, 'Membership information is unavailable.');

    expect(await screen.findByText('Read-only access')).toBeTruthy();
    expect(
      screen.getByText(/Your organization membership could not be verified/),
    ).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Add account' })).toBeNull();
  });

  it('shows the session-expired error for 401 responses', async () => {
    setupAccountRoutes([makeAccount()], { getFailure: 401 });
    renderPage();

    expect(
      await screen.findByText('Your session has expired. Please sign in again.'),
    ).toBeTruthy();
  });

  it('shows a load error and retries', async () => {
    const { setGetFailure } = setupAccountRoutes([makeAccount()], {
      getFailure: 500,
    });
    renderPage();

    expect(await screen.findByText('Unable to load accounts')).toBeTruthy();
    expect(
      screen.getByText('The account request could not be completed. Please try again.'),
    ).toBeTruthy();

    setGetFailure(null);
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));

    expect(await screen.findByText('Cash')).toBeTruthy();
  });

  it('includes active revenue accounts in parent choices', async () => {
    const tree: AccountTreeNode[] = [
      {
        id: revenueId,
        code: '4000',
        name: 'Consulting Revenue',
        type: 'REVENUE',
        active: true,
        children: [],
      },
    ];
    setupAccountRoutes([makeAccount()], { tree });
    renderPage();

    await screen.findByText('1010');
    fireEvent.click(screen.getByRole('button', { name: 'Add account' }));

    const dialog = await screen.findByRole('dialog');
    const trigger = await waitForParentOptions();
    await chooseOption(trigger, /4000 — Consulting Revenue/);

    expect(
      (trigger as HTMLButtonElement).textContent,
    ).toContain('Consulting Revenue');
    expect((dialog as HTMLElement).textContent).toContain('Only active accounts');
  });
});
