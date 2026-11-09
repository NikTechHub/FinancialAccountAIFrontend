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
import type { AccountOption } from 'src/features/expenses/types';
import type { Customer } from 'src/features/parties/types';
import { clearSession } from 'src/lib/api/session';
import type { MembershipRole } from 'src/lib/api/types';
import {
  createFetchMock,
  jsonResponse,
  testOrganization,
  testUser,
} from 'src/test/api-fixtures';
import { InvoiceManagementPage } from './InvoiceManagementPage';
import type { InvoiceRecord } from './types';

const invoiceId = '55555555-5555-5555-5555-555555555555';
const customerId = '77777777-7777-7777-7777-777777777777';
const accountId = '66666666-6666-6666-6666-666666666666';

const customer: Customer = {
  id: customerId,
  organizationId: testOrganization.id,
  organizationName: testOrganization.name,
  name: 'Acme Customer',
  email: 'billing@acme.example',
  phone: null,
  address: null,
  taxIdentifier: null,
  paymentTerms: 'Net 30',
  active: true,
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
};

const revenueAccount: AccountOption = {
  id: accountId,
  code: '4000',
  name: 'Consulting Revenue',
  type: 'REVENUE',
  active: true,
};

function makeInvoice(overrides: Partial<InvoiceRecord> = {}): InvoiceRecord {
  return {
    id: invoiceId,
    organizationId: testOrganization.id,
    organizationName: testOrganization.name,
    customerId,
    customerName: customer.name,
    invoiceNumber: 'INV-1001',
    invoiceDate: '2026-10-05',
    dueDate: '2026-11-04',
    status: 'DRAFT',
    subtotal: 100,
    taxAmount: 10,
    discountAmount: 0,
    totalAmount: 110,
    amountPaid: 0,
    balanceDue: 110,
    notes: 'Thank you',
    terms: 'Net 30',
    journalEntryId: null,
    createdBy: testUser.id,
    createdByEmail: testUser.email,
    createdAt: '2026-10-05T12:00:00Z',
    updatedAt: '2026-10-05T12:00:00Z',
    lines: [
      {
        id: '88888888-8888-8888-8888-888888888888',
        description: 'Consulting',
        quantity: 2,
        unitPrice: 50,
        taxRate: 10,
        discountAmount: 0,
        revenueAccountId: accountId,
        revenueAccountCode: '4000',
        revenueAccountName: 'Consulting Revenue',
        lineSubtotal: 100,
        lineTaxAmount: 10,
        lineTotal: 110,
      },
    ],
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
    <MemoryRouter initialEntries={['/invoices']}>
      <AuthContext.Provider value={createAuthValue(role)}>
        <InvoiceManagementPage />
      </AuthContext.Provider>
    </MemoryRouter>,
  );
}

function invoiceCalls(
  fetchMock: ReturnType<typeof createFetchMock>,
  method: string,
  path: string,
) {
  return fetchMock.mock.calls.filter(([input, init]) => {
    const requestMethod = (init?.method ?? 'GET').toUpperCase();
    const requestPath = new URL(String(input), 'http://localhost').pathname;
    return requestMethod === method && requestPath === path;
  });
}

function setupInvoiceRoutes(
  initialRecords: InvoiceRecord[],
  options: { getFailure?: number | null; postDelayMs?: number } = {},
) {
  let records = initialRecords;
  let getFailure = options.getFailure ?? null;

  const fetchMock = createFetchMock([
    {
      path: '/api/v1/invoices',
      handler: () => {
        if (getFailure) return jsonResponse({ message: 'Failed' }, getFailure);
        return jsonResponse(makePage(records));
      },
    },
    {
      path: '/api/v1/customers',
      handler: () => jsonResponse(makePage([customer])),
    },
    {
      path: '/api/v1/accounts',
      handler: () => jsonResponse(makePage([revenueAccount])),
    },
    {
      path: `/api/v1/invoices/${invoiceId}`,
      handler: () => {
        const record = records.find((item) => item.id === invoiceId);
        return record
          ? jsonResponse(record)
          : jsonResponse({ message: 'Not found' }, 404);
      },
    },
    {
      method: 'POST',
      path: '/api/v1/invoices',
      handler: async ({ body }) => {
        if (options.postDelayMs) {
          await new Promise((resolve) => setTimeout(resolve, options.postDelayMs));
        }
        const input = body as Partial<InvoiceRecord> & {
          customerId: string;
          invoiceNumber: string;
          invoiceDate: string;
          dueDate?: string;
          notes?: string;
          terms?: string;
        };
        const created = makeInvoice({
          id: '99999999-9999-9999-9999-999999999999',
          customerId: input.customerId,
          customerName: customer.name,
          invoiceNumber: input.invoiceNumber,
          invoiceDate: input.invoiceDate,
          dueDate: input.dueDate ?? null,
          notes: input.notes ?? null,
          terms: input.terms ?? null,
          createdAt: '2026-10-20T12:00:00Z',
          updatedAt: '2026-10-20T12:00:00Z',
        });
        records = [created, ...records];
        return jsonResponse(created, 201);
      },
    },
    {
      method: 'PUT',
      path: `/api/v1/invoices/${invoiceId}`,
      handler: ({ body }) => {
        const current = records.find((item) => item.id === invoiceId) ?? makeInvoice();
        const fields = { ...(body as Record<string, unknown>) };
        delete fields.lines;
        const updated = {
          ...current,
          ...(fields as Partial<InvoiceRecord>),
          updatedAt: '2026-10-21T12:00:00Z',
        };
        records = records.map((item) => (item.id === invoiceId ? updated : item));
        return jsonResponse(updated);
      },
    },
    {
      method: 'POST',
      path: `/api/v1/invoices/${invoiceId}/issue`,
      handler: () => {
        const updated = {
          ...(records.find((item) => item.id === invoiceId) ?? makeInvoice()),
          status: 'ISSUED' as const,
          journalEntryId: '99999999-0000-0000-0000-000000000001',
          updatedAt: '2026-10-21T12:00:00Z',
        };
        records = records.map((item) => (item.id === invoiceId ? updated : item));
        return jsonResponse(updated);
      },
    },
    {
      method: 'DELETE',
      path: `/api/v1/invoices/${invoiceId}`,
      handler: () => {
        const updated = {
          ...(records.find((item) => item.id === invoiceId) ?? makeInvoice()),
          status: 'VOID' as const,
          updatedAt: '2026-10-21T12:00:00Z',
        };
        records = records.map((item) => (item.id === invoiceId ? updated : item));
        return jsonResponse(updated);
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

describe('InvoiceManagementPage', () => {
  it('loads invoices and exposes draft actions', async () => {
    setupInvoiceRoutes([makeInvoice()]);
    renderPage();

    expect(await screen.findByText('INV-1001')).toBeTruthy();
    expect(screen.getByText('Acme Customer')).toBeTruthy();
    expect(screen.getByText('$110.00')).toBeTruthy();
    expect(screen.getAllByText('Draft').length).toBeGreaterThan(0);
    expect(screen.getByRole('button', { name: 'Create invoice' })).toBeTruthy();
    expect(
      screen.getByRole('button', { name: 'Edit invoice INV-1001' }),
    ).toBeTruthy();
    expect(
      screen.getByRole('button', { name: 'Issue invoice INV-1001' }),
    ).toBeTruthy();
    expect(
      screen.getByRole('button', { name: 'Void invoice INV-1001' }),
    ).toBeTruthy();
  });

  it('fetches and displays invoice details', async () => {
    const { fetchMock } = setupInvoiceRoutes([makeInvoice()]);
    renderPage();

    await screen.findByText('INV-1001');
    fireEvent.click(screen.getByRole('button', { name: 'View invoice INV-1001' }));

    expect(await screen.findByText('Journal entry')).toBeTruthy();
    expect(screen.getByText('Not posted')).toBeTruthy();
    expect(screen.getByText('Consulting')).toBeTruthy();
    expect(
      screen.getByText(
        'Payment recording is not available through the current API. Amount paid and balance due are shown as reported by the server.',
      ),
    ).toBeTruthy();
    expect(
      invoiceCalls(fetchMock, 'GET', `/api/v1/invoices/${invoiceId}`),
    ).toHaveLength(1);
  });

  it('links an issued invoice to its journal entry workspace', async () => {
    const journalEntryId = '99999999-0000-0000-0000-000000000001';
    setupInvoiceRoutes([
      makeInvoice({ status: 'ISSUED', journalEntryId }),
    ]);
    renderPage();

    await screen.findByText('INV-1001');
    fireEvent.click(screen.getByRole('button', { name: 'View invoice INV-1001' }));

    const link = await screen.findByRole('link', {
      name: 'View journal entry',
    });
    expect(link.getAttribute('href')).toBe(
      `/journal-entries?entryId=${journalEntryId}`,
    );
  });

  it('applies one backend filter at a time', async () => {
    const { fetchMock } = setupInvoiceRoutes([makeInvoice()]);
    renderPage();

    await screen.findByText('INV-1001');
    fireEvent.change(screen.getByLabelText('Invoice number filter'), {
      target: { value: 'INV-1001' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Apply filter' }));

    await waitFor(() => {
      const listCalls = invoiceCalls(fetchMock, 'GET', '/api/v1/invoices');
      const lastCall = listCalls[listCalls.length - 1];
      expect(lastCall).toBeTruthy();
      const params = new URL(String(lastCall?.[0]), 'http://localhost').searchParams;
      expect(params.get('invoiceNumber')).toBe('INV-1001');
      expect(params.get('status')).toBeNull();
    });

    await chooseOption(screen.getByLabelText('Filter by'), /^Status$/);
    await chooseOption(await screen.findByLabelText('Status filter'), /^Draft$/);
    fireEvent.click(screen.getByRole('button', { name: 'Apply filter' }));

    await waitFor(() => {
      const listCalls = invoiceCalls(fetchMock, 'GET', '/api/v1/invoices');
      const lastCall = listCalls[listCalls.length - 1];
      expect(lastCall).toBeTruthy();
      const params = new URL(String(lastCall?.[0]), 'http://localhost').searchParams;
      expect(params.get('status')).toBe('DRAFT');
      expect(params.get('invoiceNumber')).toBeNull();
    });
    expect(screen.getByText(/Showing invoices with status Draft/)).toBeTruthy();
  });

  it('creates a draft invoice once with real customer and revenue data', async () => {
    const { fetchMock } = setupInvoiceRoutes([makeInvoice()], {
      postDelayMs: 80,
    });
    renderPage();

    await screen.findByText('INV-1001');
    fireEvent.click(screen.getByRole('button', { name: 'Create invoice' }));

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
      within(dialog).getByLabelText(/Customer/),
      /Acme Customer/,
    );
    await chooseOption(
      within(dialog).getByLabelText(/Revenue account/),
      /Consulting Revenue/,
    );
    fireEvent.change(within(dialog).getByLabelText(/Invoice number/), {
      target: { value: 'INV-2002' },
    });
    fireEvent.change(within(dialog).getByLabelText('Description'), {
      target: { value: 'Implementation' },
    });
    fireEvent.change(within(dialog).getByLabelText(/Unit price/), {
      target: { value: '50' },
    });

    const submit = within(dialog).getByRole('button', { name: 'Create draft' });
    fireEvent.click(submit);
    fireEvent.click(submit);

    expect(await screen.findByText('Draft invoice created.')).toBeTruthy();
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(await screen.findByText('INV-2002')).toBeTruthy();

    const postCalls = invoiceCalls(fetchMock, 'POST', '/api/v1/invoices');
    expect(postCalls).toHaveLength(1);
    const body = JSON.parse(String(postCalls[0]?.[1]?.body));
    expect(body).toMatchObject({
      customerId,
      invoiceNumber: 'INV-2002',
      notes: '',
      terms: '',
      lines: [
        {
          description: 'Implementation',
          quantity: 1,
          unitPrice: 50,
          taxRate: 0,
          discountAmount: 0,
          revenueAccountId: accountId,
        },
      ],
    });
    expect(body.invoiceDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(body.dueDate).toBeUndefined();
  });

  it('keeps the create dialog open for invalid line data', async () => {
    const { fetchMock } = setupInvoiceRoutes([makeInvoice()]);
    renderPage();

    await screen.findByText('INV-1001');
    fireEvent.click(screen.getByRole('button', { name: 'Create invoice' }));
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

    expect(await screen.findByText('Choose a customer.')).toBeTruthy();
    expect(screen.getByText('Enter an invoice number.')).toBeTruthy();
    expect(screen.getByText('Enter a unit price.')).toBeTruthy();
    expect(screen.getByText('Choose a revenue account.')).toBeTruthy();
    expect(invoiceCalls(fetchMock, 'POST', '/api/v1/invoices')).toHaveLength(0);
  });

  it('updates a draft invoice with editable line data', async () => {
    const { fetchMock } = setupInvoiceRoutes([makeInvoice()]);
    renderPage();

    await screen.findByText('INV-1001');
    fireEvent.click(screen.getByRole('button', { name: 'Edit invoice INV-1001' }));

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

    fireEvent.change(within(dialog).getByLabelText(/Invoice number/), {
      target: { value: 'INV-1001-R' },
    });
    fireEvent.change(within(dialog).getByLabelText('Due date'), {
      target: { value: '2026-12-01' },
    });
    fireEvent.change(within(dialog).getByLabelText(/Unit price/), {
      target: { value: '75' },
    });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Save changes' }));

    expect(await screen.findByText('Draft invoice updated.')).toBeTruthy();
    expect(await screen.findByText('INV-1001-R')).toBeTruthy();

    const putCalls = invoiceCalls(
      fetchMock,
      'PUT',
      `/api/v1/invoices/${invoiceId}`,
    );
    expect(putCalls).toHaveLength(1);
    expect(JSON.parse(String(putCalls[0]?.[1]?.body))).toMatchObject({
      customerId,
      invoiceNumber: 'INV-1001-R',
      dueDate: '2026-12-01',
      lines: [
        {
          description: 'Consulting',
          quantity: 2,
          unitPrice: 75,
          taxRate: 10,
          discountAmount: 0,
          revenueAccountId: accountId,
        },
      ],
    });
  });

  it('issues a draft after confirmation and refreshes the status', async () => {
    const { fetchMock } = setupInvoiceRoutes([makeInvoice()]);
    renderPage();

    await screen.findByText('INV-1001');
    fireEvent.click(screen.getByRole('button', { name: 'Issue invoice INV-1001' }));

    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText('Issue this invoice?')).toBeTruthy();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Issue invoice' }));

    expect(await screen.findByText('Invoice INV-1001 issued and posted.')).toBeTruthy();
    expect(await screen.findByText('Issued')).toBeTruthy();
    expect(
      invoiceCalls(fetchMock, 'POST', `/api/v1/invoices/${invoiceId}/issue`),
    ).toHaveLength(1);
    expect(
      screen.queryByRole('button', { name: 'Issue invoice INV-1001' }),
    ).toBeNull();
  });

  it('voids a draft after confirmation and keeps it in the list', async () => {
    const { fetchMock } = setupInvoiceRoutes([makeInvoice()]);
    renderPage();

    await screen.findByText('INV-1001');
    fireEvent.click(screen.getByRole('button', { name: 'Void invoice INV-1001' }));

    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText('Void this draft invoice?')).toBeTruthy();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Void invoice' }));

    expect(await screen.findByText('Invoice INV-1001 voided.')).toBeTruthy();
    expect(await screen.findByText('Void')).toBeTruthy();
    expect(screen.getByText('INV-1001')).toBeTruthy();
    expect(
      invoiceCalls(fetchMock, 'DELETE', `/api/v1/invoices/${invoiceId}`),
    ).toHaveLength(1);
  });

  it.each(['VIEWER', 'EMPLOYEE'] as const)(
    'hides mutation actions from %s users',
    async (role) => {
      setupInvoiceRoutes([makeInvoice()]);
      renderPage(role);

      expect(await screen.findByText('INV-1001')).toBeTruthy();
      expect(screen.getByText('Read-only access')).toBeTruthy();
      expect(screen.queryByRole('button', { name: 'Create invoice' })).toBeNull();
      expect(
        screen.queryByRole('button', { name: 'Edit invoice INV-1001' }),
      ).toBeNull();
      expect(
        screen.queryByRole('button', { name: 'Issue invoice INV-1001' }),
      ).toBeNull();
      expect(
        screen.queryByRole('button', { name: 'Void invoice INV-1001' }),
      ).toBeNull();
      expect(
        screen.getByRole('button', { name: 'View invoice INV-1001' }),
      ).toBeTruthy();
    },
  );

  it('shows a load error and retries', async () => {
    const { setGetFailure } = setupInvoiceRoutes([makeInvoice()], {
      getFailure: 500,
    });
    renderPage();

    expect(await screen.findByText('Unable to load invoices')).toBeTruthy();
    expect(
      screen.getByText('The invoice request could not be completed. Please try again.'),
    ).toBeTruthy();

    setGetFailure(null);
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));

    expect(await screen.findByText('INV-1001')).toBeTruthy();
  });
});
