import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { applyAuthResponse, clearSession, setTokenStorage } from 'src/lib/api/session';
import { createMemoryTokenStorage, type TokenStorage } from 'src/lib/auth/token-storage';
import type { PageResponse } from 'src/lib/api/types';
import {
  createFetchMock,
  jsonResponse,
  makeAuthResponse,
  testOrganization,
} from 'src/test/api-fixtures';
import { accountApi } from './api';
import type { AccountRecord, AccountTreeNode } from './types';

const accountId = '77777777-7777-7777-7777-777777777777';
const parentId = '88888888-8888-8888-8888-888888888888';

function makeAccount(overrides: Partial<AccountRecord> = {}): AccountRecord {
  return {
    id: accountId,
    organizationId: testOrganization.id,
    organizationName: testOrganization.name,
    code: '1000',
    name: 'Cash',
    type: 'ASSET',
    parentAccountId: null,
    parentAccountName: null,
    description: 'Operating cash',
    active: true,
    systemAccount: false,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

function makePage(content: AccountRecord[]): PageResponse<AccountRecord> {
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

const tree: AccountTreeNode[] = [
  {
    id: parentId,
    code: '1000',
    name: 'Current Assets',
    type: 'ASSET',
    active: true,
    children: [
      {
        id: 'child-1',
        code: '1010',
        name: 'Cash',
        type: 'ASSET',
        active: true,
        children: [],
      },
      {
        id: 'child-2',
        code: '1020',
        name: 'Bank',
        type: 'ASSET',
        active: true,
        children: [],
      },
    ],
  },
  {
    id: 'revenue-parent',
    code: '4000',
    name: 'Revenue',
    type: 'REVENUE',
    active: true,
    children: [],
  },
];

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

describe('accounts API', () => {
  it('sends paging, search, type, and sort parameters with auth', async () => {
    const fetchMock = createFetchMock([
      {
        path: '/api/v1/accounts',
        handler: ({ headers, url }) => {
          expect(headers.get('Authorization')).toBe('Bearer access-token-1');
          const params = new URL(url, 'http://localhost').searchParams;
          expect(params.get('page')).toBe('2');
          expect(params.get('size')).toBe('20');
          expect(params.get('search')).toBe('cash');
          expect(params.get('type')).toBe('ASSET');
          expect(params.get('sort')).toBe('code,asc');
          return jsonResponse(makePage([makeAccount()]));
        },
      },
    ]);
    vi.stubGlobal('fetch', fetchMock);

    const page = await accountApi.list({
      page: 2,
      size: 20,
      search: '  cash  ',
      type: 'ASSET',
      sort: 'code,asc',
    });

    expect(page.content[0]?.code).toBe('1000');
  });

  it('omits empty search and type parameters', async () => {
    const fetchMock = createFetchMock([
      {
        path: '/api/v1/accounts',
        handler: ({ url }) => {
          const params = new URL(url, 'http://localhost').searchParams;
          expect(params.has('search')).toBe(false);
          expect(params.has('type')).toBe(false);
          expect(params.get('sort')).toBe('name,asc');
          return jsonResponse(makePage([]));
        },
      },
    ]);
    vi.stubGlobal('fetch', fetchMock);

    await accountApi.list({
      page: 0,
      size: 10,
      search: '   ',
      type: '',
      sort: 'name,asc',
    });
  });

  it('creates and updates accounts with backend field names', async () => {
    const createInput = {
      code: '1010',
      name: 'Cash',
      type: 'ASSET' as const,
      parentAccountId: parentId,
      description: 'Operating cash',
    };
    const updateInput = {
      code: '1010',
      name: 'Cash on hand',
      type: 'ASSET' as const,
      description: 'Updated',
    };

    const fetchMock = createFetchMock([
      {
        method: 'POST',
        path: '/api/v1/accounts',
        handler: ({ body }) => {
          expect(body).toEqual(createInput);
          return jsonResponse(makeAccount(createInput), 201);
        },
      },
      {
        method: 'PUT',
        path: `/api/v1/accounts/${accountId}`,
        handler: ({ body }) => {
          expect(body).toEqual(updateInput);
          return jsonResponse(makeAccount(updateInput));
        },
      },
    ]);
    vi.stubGlobal('fetch', fetchMock);

    const created = await accountApi.create(createInput);
    const updated = await accountApi.update(accountId, updateInput);

    expect(created.parentAccountId).toBe(parentId);
    expect(updated.name).toBe('Cash on hand');
  });

  it('deactivates an account through DELETE', async () => {
    const fetchMock = createFetchMock([
      {
        method: 'DELETE',
        path: `/api/v1/accounts/${accountId}`,
        handler: () => new Response(null, { status: 204 }),
      },
    ]);
    vi.stubGlobal('fetch', fetchMock);

    await expect(accountApi.deactivate(accountId)).resolves.toBeUndefined();
  });

  it('flattens active tree options and excludes the edited subtree', async () => {
    const fetchMock = createFetchMock([
      {
        path: '/api/v1/accounts/tree',
        handler: () => jsonResponse(tree),
      },
    ]);
    vi.stubGlobal('fetch', fetchMock);

    const options = await accountApi.parentOptions('child-2');

    expect(options).toEqual([
      {
        id: parentId,
        code: '1000',
        name: 'Current Assets',
        type: 'ASSET',
        depth: 0,
      },
      {
        id: 'child-1',
        code: '1010',
        name: 'Cash',
        type: 'ASSET',
        depth: 1,
      },
      {
        id: 'revenue-parent',
        code: '4000',
        name: 'Revenue',
        type: 'REVENUE',
        depth: 0,
      },
    ]);
    expect(options.some((option) => option.id === 'child-2')).toBe(false);
  });

  it('excludes an entire subtree when excluding a parent account', async () => {
    const fetchMock = createFetchMock([
      {
        path: '/api/v1/accounts/tree',
        handler: () => jsonResponse(tree),
      },
    ]);
    vi.stubGlobal('fetch', fetchMock);

    const options = await accountApi.parentOptions(parentId);

    expect(options).toEqual([
      {
        id: 'revenue-parent',
        code: '4000',
        name: 'Revenue',
        type: 'REVENUE',
        depth: 0,
      },
    ]);
  });
});
