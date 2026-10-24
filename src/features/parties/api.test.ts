import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from 'src/lib/api/client';
import { createMemoryTokenStorage, type TokenStorage } from 'src/lib/auth/token-storage';
import { applyAuthResponse, clearSession, setTokenStorage } from 'src/lib/api/session';
import type { PageResponse } from 'src/lib/api/types';
import { createFetchMock, jsonResponse, makeAuthResponse } from 'src/test/api-fixtures';
import {
  createCustomer,
  createVendor,
  deactivateVendor,
  fetchCustomers,
  fetchVendors,
  updateCustomer,
  updateVendor,
} from './api';
import type { PartyInput, PartyRecord } from './types';

const partyId = '44444444-4444-4444-4444-444444444444';

function makeParty(overrides: Partial<PartyRecord> = {}): PartyRecord {
  return {
    id: partyId,
    organizationId: '22222222-2222-2222-2222-222222222222',
    organizationName: 'Analytical Engines',
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

function makePage(content: PartyRecord[] = [makeParty()]): PageResponse<PartyRecord> {
  return {
    content,
    totalElements: content.length,
    totalPages: content.length ? 1 : 0,
    number: 0,
    size: 10,
    first: true,
    last: true,
    numberOfElements: content.length,
    empty: content.length === 0,
  };
}

const input: PartyInput = {
  name: 'Acme Supply',
  email: 'billing@acme.test',
  phone: '555-0100',
  address: '1 Main Street',
  taxIdentifier: 'TAX-1',
  paymentTerms: 'Net 30',
};

let storage: TokenStorage;

beforeEach(() => {
  vi.stubEnv('VITE_API_BASE_URL', '/api/v1');
  storage = createMemoryTokenStorage();
  setTokenStorage(storage);
  clearSession();
  applyAuthResponse(makeAuthResponse());
});

afterEach(() => {
  clearSession();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe('parties API', () => {
  it('sends paging, search, and sort parameters and authenticates the request', async () => {
    const fetchMock = createFetchMock([
      {
        path: '/api/v1/vendors',
        handler: ({ headers, url }) => {
          expect(headers.get('Authorization')).toBe('Bearer access-token-1');
          const params = new URL(url, 'http://localhost').searchParams;
          expect(params.get('page')).toBe('2');
          expect(params.get('size')).toBe('20');
          expect(params.get('search')).toBe('acme');
          expect(params.get('sort')).toBe('name,asc');
          return jsonResponse(makePage());
        },
      },
    ]);
    vi.stubGlobal('fetch', fetchMock);

    const page = await fetchVendors({
      page: 2,
      size: 20,
      search: '  acme  ',
      sort: 'name,asc',
    });

    expect(page.content[0]?.name).toBe('Acme Supply');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('omits empty search and sort parameters', async () => {
    const fetchMock = createFetchMock([
      {
        path: '/api/v1/vendors',
        handler: ({ url }) => {
          const params = new URL(url, 'http://localhost').searchParams;
          expect(params.has('search')).toBe(false);
          expect(params.has('sort')).toBe(false);
          return jsonResponse(makePage([]));
        },
      },
    ]);
    vi.stubGlobal('fetch', fetchMock);

    await fetchVendors({ page: 0, size: 10, search: '   ', sort: '' });
  });

  it('creates a vendor with the backend field names', async () => {
    const fetchMock = createFetchMock([
      {
        method: 'POST',
        path: '/api/v1/vendors',
        handler: ({ body }) => {
          expect(body).toEqual(input);
          return jsonResponse(makeParty(), 201);
        },
      },
    ]);
    vi.stubGlobal('fetch', fetchMock);

    const vendor = await createVendor(input);

    expect(vendor.id).toBe(partyId);
  });

  it('updates and deactivates a vendor', async () => {
    const fetchMock = createFetchMock([
      {
        method: 'PUT',
        path: `/api/v1/vendors/${partyId}`,
        handler: ({ body }) => {
          expect(body).toEqual({ ...input, name: 'Acme Updated' });
          return jsonResponse(makeParty({ name: 'Acme Updated' }));
        },
      },
      {
        method: 'DELETE',
        path: `/api/v1/vendors/${partyId}`,
        handler: () => new Response(null, { status: 204 }),
      },
    ]);
    vi.stubGlobal('fetch', fetchMock);

    const updated = await updateVendor(partyId, { ...input, name: 'Acme Updated' });
    await deactivateVendor(partyId);

    expect(updated.name).toBe('Acme Updated');
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('uses the customer endpoints independently', async () => {
    const fetchMock = createFetchMock([
      {
        path: '/api/v1/customers',
        handler: () => jsonResponse(makePage([makeParty({ name: 'Globex' })])),
      },
      {
        method: 'POST',
        path: '/api/v1/customers',
        handler: ({ body }) => {
          expect(body).toEqual(input);
          return jsonResponse(makeParty({ name: 'Globex' }), 201);
        },
      },
      {
        method: 'PUT',
        path: `/api/v1/customers/${partyId}`,
        handler: () => jsonResponse(makeParty({ name: 'Globex Updated' })),
      },
    ]);
    vi.stubGlobal('fetch', fetchMock);

    const page = await fetchCustomers({ page: 0, size: 10, search: '', sort: '' });
    const created = await createCustomer(input);
    const updated = await updateCustomer(partyId, input);

    expect(page.content[0]?.name).toBe('Globex');
    expect(created.name).toBe('Globex');
    expect(updated.name).toBe('Globex Updated');
  });

  it('exposes backend field errors on validation failures', async () => {
    const fetchMock = createFetchMock([
      {
        method: 'POST',
        path: '/api/v1/vendors',
        handler: () =>
          jsonResponse(
            {
              status: 400,
              message: 'Validation failed',
              fieldErrors: { name: 'name must not be blank' },
            },
            400,
          ),
      },
    ]);
    vi.stubGlobal('fetch', fetchMock);

    const error = await createVendor(input).catch((reason: unknown) => reason);

    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).status).toBe(400);
    expect((error as ApiError).fieldErrors).toEqual({
      name: 'name must not be blank',
    });
  });
});
