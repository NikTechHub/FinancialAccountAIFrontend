// @vitest-environment jsdom
import type { ReactNode } from 'react';
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
import { clearSession } from 'src/lib/api/session';
import type { MembershipRole } from 'src/lib/api/types';
import { AuthContext, type AuthContextValue } from 'src/features/auth/auth-context';
import { createFetchMock, jsonResponse, testOrganization, testUser } from 'src/test/api-fixtures';
import { customerConfig, vendorConfig } from './config';
import { PartyManagementPage } from './PartyManagementPage';
import type { PartyInput, PartyRecord } from './types';

const partyId = '44444444-4444-4444-4444-444444444444';

function makeParty(overrides: Partial<PartyRecord> = {}): PartyRecord {
  return {
    id: partyId,
    organizationId: testOrganization.id,
    organizationName: testOrganization.name,
    name: 'Acme Supply',
    email: 'billing@acme.test',
    phone: '555-0100',
    address: '1 Main Street',
    taxIdentifier: 'TAX-1',
    paymentTerms: 'Net 30',
    active: true,
    createdAt: '2026-01-02T00:00:00Z',
    updatedAt: '2026-01-02T00:00:00Z',
    ...overrides,
  };
}

function makePage(records: PartyRecord[]) {
  return {
    content: records,
    totalElements: records.length,
    totalPages: records.length ? 1 : 0,
    number: 0,
    size: 10,
    first: true,
    last: true,
    numberOfElements: records.length,
    empty: records.length === 0,
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
  options: {
    role?: MembershipRole | null;
    membershipError?: string | null;
    page?: ReactNode;
  } = {},
) {
  const auth = createAuthValue(
    options.role === undefined ? 'OWNER' : options.role,
    options.membershipError ?? null,
  );

  render(
    <MemoryRouter initialEntries={['/vendors']}>
      <AuthContext.Provider value={auth}>
        {options.page ?? <PartyManagementPage config={vendorConfig} />}
      </AuthContext.Provider>
    </MemoryRouter>,
  );

  return auth;
}

function setupPartyRoutes(
  basePath: string,
  initialRecords: PartyRecord[],
  options: { postDelayMs?: number; postFailure?: number } = {},
) {
  let records = initialRecords;
  let getFailure: number | null = null;
  const id = initialRecords[0]?.id ?? partyId;

  const fetchMock = createFetchMock([
    {
      path: basePath,
      handler: () => {
        if (getFailure !== null) {
          return jsonResponse({ message: 'Request failed' }, getFailure);
        }
        return jsonResponse(makePage(records));
      },
    },
    {
      method: 'POST',
      path: basePath,
      handler: async ({ body }) => {
        if (options.postDelayMs) {
          await new Promise((resolve) => setTimeout(resolve, options.postDelayMs));
        }
        if (options.postFailure) {
          return jsonResponse({ message: 'Request failed' }, options.postFailure);
        }
        const input = body as PartyInput;
        const record = makeParty({
          id: `created-${records.length + 1}`,
          ...input,
          createdAt: '2026-01-03T00:00:00Z',
          updatedAt: '2026-01-03T00:00:00Z',
        });
        records = [record, ...records];
        return jsonResponse(record, 201);
      },
    },
    {
      method: 'PUT',
      path: `${basePath}/${id}`,
      handler: ({ body }) => {
        const current = records.find((record) => record.id === id);
        if (!current) throw new Error('Missing party fixture');

        const updated = {
          ...current,
          ...(body as PartyInput),
          updatedAt: '2026-01-04T00:00:00Z',
        };
        records = records.map((record) => (record.id === id ? updated : record));
        return jsonResponse(updated);
      },
    },
    {
      method: 'DELETE',
      path: `${basePath}/${id}`,
      handler: () => {
        records = records.filter((record) => record.id !== id);
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

beforeEach(() => {
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
  clearSession();
});

afterEach(() => {
  cleanup();
  clearSession();
  vi.unstubAllGlobals();
});

describe('PartyManagementPage', () => {
  it('loads and displays vendor records', async () => {
    setupPartyRoutes('/api/v1/vendors', [makeParty()]);
    renderPage();

    expect(await screen.findByText('Acme Supply')).toBeTruthy();
    expect(screen.getByText('billing@acme.test')).toBeTruthy();
    expect(screen.getByText('Active')).toBeTruthy();
    expect(screen.getByText(/Page 1 of 1/)).toBeTruthy();
  });

  it('shows the empty state when there are no vendors', async () => {
    setupPartyRoutes('/api/v1/vendors', []);
    renderPage();

    expect(await screen.findByText('No vendors yet')).toBeTruthy();
    expect(
      screen.getByText('Add a vendor to track the businesses you buy from.'),
    ).toBeTruthy();
  });

  it('creates a vendor and refreshes the list', async () => {
    const { fetchMock } = setupPartyRoutes('/api/v1/vendors', [makeParty()]);
    renderPage();

    await screen.findByText('Acme Supply');
    fireEvent.click(screen.getByRole('button', { name: 'Add vendor' }));

    const dialog = await screen.findByRole('dialog');
    fireEvent.change(within(dialog).getByRole('textbox', { name: /^Name/ }), {
      target: { value: 'Northwind' },
    });
    fireEvent.change(within(dialog).getByRole('textbox', { name: /^Email/ }), {
      target: { value: 'ops@northwind.test' },
    });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Create vendor' }));

    expect(await screen.findByText('Vendor created.')).toBeTruthy();
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(await screen.findByText('Northwind')).toBeTruthy();

    const postCall = fetchMock.mock.calls.find(
      ([, init]) => (init?.method ?? 'GET').toUpperCase() === 'POST',
    );
    expect(JSON.parse(String(postCall?.[1]?.body))).toEqual({
      name: 'Northwind',
      email: 'ops@northwind.test',
      phone: '',
      address: '',
      taxIdentifier: '',
      paymentTerms: '',
    });
  });

  it('prevents duplicate submissions while a create is in flight', async () => {
    const { fetchMock } = setupPartyRoutes('/api/v1/vendors', [makeParty()], {
      postDelayMs: 150,
    });
    renderPage();

    await screen.findByText('Acme Supply');
    fireEvent.click(screen.getByRole('button', { name: 'Add vendor' }));

    const dialog = await screen.findByRole('dialog');
    fireEvent.change(within(dialog).getByRole('textbox', { name: /^Name/ }), {
      target: { value: 'Northwind' },
    });
    const submit = within(dialog).getByRole('button', { name: 'Create vendor' });
    fireEvent.click(submit);
    fireEvent.click(submit);

    expect(await screen.findByText('Vendor created.')).toBeTruthy();
    expect(
      fetchMock.mock.calls.filter(
        ([, init]) => (init?.method ?? 'GET').toUpperCase() === 'POST',
      ),
    ).toHaveLength(1);
  });

  it('keeps the form open when validation fails and does not submit', async () => {
    const { fetchMock } = setupPartyRoutes('/api/v1/vendors', [makeParty()]);
    renderPage();

    await screen.findByText('Acme Supply');
    fireEvent.click(screen.getByRole('button', { name: 'Add vendor' }));

    const dialog = await screen.findByRole('dialog');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Create vendor' }));

    expect(await screen.findByText('Name is required.')).toBeTruthy();
    expect(screen.getByRole('dialog')).toBeTruthy();

    const nameInput = within(dialog).getByRole('textbox', { name: /^Name/ });
    fireEvent.change(nameInput, { target: { value: 'Northwind' } });
    fireEvent.change(within(dialog).getByRole('textbox', { name: /^Email/ }), {
      target: { value: 'not-an-email' },
    });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Create vendor' }));

    expect(await screen.findByText('Enter a valid email address.')).toBeTruthy();
    expect((nameInput as HTMLInputElement).value).toBe('Northwind');
    expect(
      fetchMock.mock.calls.filter(
        ([, init]) => (init?.method ?? 'GET').toUpperCase() === 'POST',
      ),
    ).toHaveLength(0);
  });

  it('keeps the dialog open and the list unchanged when a mutation fails', async () => {
    const { fetchMock } = setupPartyRoutes('/api/v1/vendors', [makeParty()], {
      postFailure: 409,
    });
    renderPage();

    await screen.findByText('Acme Supply');
    fireEvent.click(screen.getByRole('button', { name: 'Add vendor' }));

    const dialog = await screen.findByRole('dialog');
    fireEvent.change(within(dialog).getByRole('textbox', { name: /^Name/ }), {
      target: { value: 'Northwind' },
    });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Create vendor' }));

    expect(await screen.findByText('Unable to save vendor')).toBeTruthy();
    expect(
      screen.getByText('A vendor with this name already exists.'),
    ).toBeTruthy();
    expect(screen.getByRole('dialog')).toBeTruthy();
    expect(screen.queryByText('Vendor created.')).toBeNull();
    expect(screen.queryByText('Northwind')).toBeNull();
    expect(
      fetchMock.mock.calls.filter(
        ([, init]) => (init?.method ?? 'GET').toUpperCase() === 'POST',
      ),
    ).toHaveLength(1);
  });

  it('updates a vendor from the row action', async () => {
    const { fetchMock } = setupPartyRoutes('/api/v1/vendors', [makeParty()]);
    renderPage();

    await screen.findByText('Acme Supply');
    fireEvent.click(screen.getByRole('button', { name: 'Edit Acme Supply' }));

    const dialog = await screen.findByRole('dialog');
    const nameInput = within(dialog).getByRole('textbox', { name: /^Name/ });
    expect((nameInput as HTMLInputElement).value).toBe('Acme Supply');
    fireEvent.change(nameInput, { target: { value: 'Acme Updated' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Save changes' }));

    expect(await screen.findByText('Vendor updated.')).toBeTruthy();
    expect(await screen.findByText('Acme Updated')).toBeTruthy();

    const putCall = fetchMock.mock.calls.find(
      ([, init]) => (init?.method ?? 'GET').toUpperCase() === 'PUT',
    );
    expect(JSON.parse(String(putCall?.[1]?.body))).toMatchObject({
      name: 'Acme Updated',
    });
  });

  it('deactivates a vendor after confirmation and removes the row', async () => {
    const { fetchMock } = setupPartyRoutes('/api/v1/vendors', [makeParty()]);
    renderPage();

    await screen.findByText('Acme Supply');
    fireEvent.click(screen.getByRole('button', { name: 'Deactivate Acme Supply' }));

    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText('Deactivate vendor?')).toBeTruthy();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Deactivate' }));

    expect(await screen.findByText('Vendor deactivated.')).toBeTruthy();
    await waitFor(() => expect(screen.queryByText('Acme Supply')).toBeNull());
    expect(
      fetchMock.mock.calls.filter(
        ([, init]) => (init?.method ?? 'GET').toUpperCase() === 'DELETE',
      ),
    ).toHaveLength(1);
  });

  it('shows a load error and retries', async () => {
    const { setGetFailure } = setupPartyRoutes('/api/v1/vendors', [makeParty()]);
    setGetFailure(500);
    renderPage();

    expect(await screen.findByText('Unable to load vendors')).toBeTruthy();
    expect(screen.getByText('Something went wrong. Please try again.')).toBeTruthy();

    setGetFailure(null);
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));

    expect(await screen.findByText('Acme Supply')).toBeTruthy();
  });

  it('shows the session-expired message for unauthorized responses', async () => {
    const { setGetFailure } = setupPartyRoutes('/api/v1/vendors', [makeParty()]);
    setGetFailure(401);
    renderPage();

    expect(
      await screen.findByText('Your session has expired. Please sign in again.'),
    ).toBeTruthy();
  });

  it('hides all mutation actions from viewers', async () => {
    setupPartyRoutes('/api/v1/vendors', [makeParty()]);
    renderPage({ role: 'VIEWER' });

    expect(await screen.findByText('Acme Supply')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Add vendor' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Edit Acme Supply' })).toBeNull();
    expect(
      screen.queryByRole('button', { name: 'Deactivate Acme Supply' }),
    ).toBeNull();
  });

  it('allows accountants to edit but not deactivate', async () => {
    setupPartyRoutes('/api/v1/vendors', [makeParty()]);
    renderPage({ role: 'ACCOUNTANT' });

    expect(await screen.findByText('Acme Supply')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Add vendor' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Edit Acme Supply' })).toBeTruthy();
    expect(
      screen.queryByRole('button', { name: 'Deactivate Acme Supply' }),
    ).toBeNull();
  });

  it('disables mutations when membership cannot be verified', async () => {
    setupPartyRoutes('/api/v1/vendors', [makeParty()]);
    renderPage({
      role: null,
      membershipError: 'Membership information is unavailable.',
    });

    expect(await screen.findByText('Read-only access')).toBeTruthy();
    expect(await screen.findByText('Acme Supply')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Add vendor' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Edit Acme Supply' })).toBeNull();
  });

  it('renders the customer page against the customer endpoints', async () => {
    setupPartyRoutes('/api/v1/customers', [makeParty({ name: 'Globex' })]);
    renderPage({
      page: <PartyManagementPage config={customerConfig} />,
    });

    expect(await screen.findByText('Globex')).toBeTruthy();
    expect(screen.getByText('Customer directory')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Add customer' })).toBeTruthy();
  });
});
