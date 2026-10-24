// @vitest-environment jsdom
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from 'src/lib/api/client';
import type { PageResponse } from 'src/lib/api/types';
import type { PartyApi, PartyLabels, PartyListParams, PartyRecord } from './types';
import { usePartyList } from './usePartyList';

const labels: PartyLabels = {
  singular: 'Vendor',
  plural: 'Vendors',
  lowerSingular: 'vendor',
  lowerPlural: 'vendors',
};

const record: PartyRecord = {
  id: 'party-1',
  organizationId: 'org-1',
  organizationName: 'Analytical Engines',
  name: 'Acme Supply',
  email: null,
  phone: null,
  address: null,
  taxIdentifier: null,
  paymentTerms: null,
  active: true,
  createdAt: '2026-01-02T00:00:00Z',
  updatedAt: '2026-01-02T00:00:00Z',
};

function makePage(content: PartyRecord[] = [record]): PageResponse<PartyRecord> {
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

function makeApi(list: PartyApi['list']): PartyApi {
  return {
    list,
    create: vi.fn() as unknown as PartyApi['create'],
    update: vi.fn() as unknown as PartyApi['update'],
    deactivate: vi.fn() as unknown as PartyApi['deactivate'],
  };
}

afterEach(() => {
  cleanup();
});

describe('usePartyList', () => {
  it('loads a page for the active organization', async () => {
    const list = vi.fn(async () => makePage());
    const api = makeApi(list as unknown as PartyApi['list']);

    const { result } = renderHook(() =>
      usePartyList({
        api,
        labels,
        enabled: true,
        page: 0,
        size: 10,
        search: '',
        sort: 'name,asc',
      }),
    );

    await waitFor(() => expect(result.current.status).toBe('success'));

    expect(result.current.data?.content[0]?.name).toBe('Acme Supply');
    expect(result.current.error).toBeNull();
    expect(list).toHaveBeenCalledWith(
      { page: 0, size: 10, search: '', sort: 'name,asc' },
      expect.any(AbortSignal),
    );
  });

  it('returns an empty page without treating it as an error', async () => {
    const list = vi.fn(async () => makePage([]));
    const api = makeApi(list as unknown as PartyApi['list']);

    const { result } = renderHook(() =>
      usePartyList({
        api,
        labels,
        enabled: true,
        page: 0,
        size: 10,
        search: '',
        sort: '',
      }),
    );

    await waitFor(() => expect(result.current.status).toBe('success'));

    expect(result.current.data?.content).toEqual([]);
    expect(result.current.data?.totalElements).toBe(0);
  });

  it('shows a safe error and retries the request', async () => {
    const list = vi.fn();
    list
      .mockRejectedValueOnce(new ApiError('Server error', { kind: 'http', status: 500 }))
      .mockResolvedValueOnce(makePage());
    const api = makeApi(list as unknown as PartyApi['list']);

    const { result } = renderHook(() =>
      usePartyList({
        api,
        labels,
        enabled: true,
        page: 0,
        size: 10,
        search: '',
        sort: '',
      }),
    );

    await waitFor(() => expect(result.current.status).toBe('error'));
    expect(result.current.error).toBe('Something went wrong. Please try again.');

    act(() => result.current.refresh());

    await waitFor(() => expect(result.current.status).toBe('success'));
    expect(result.current.data?.content[0]?.name).toBe('Acme Supply');
    expect(list).toHaveBeenCalledTimes(2);
  });

  it('refetches when the page changes', async () => {
    const list = vi.fn(async () => makePage());
    const api = makeApi(list as unknown as PartyApi['list']);

    const { result, rerender } = renderHook(
      ({ page }: { page: number }) =>
        usePartyList({
          api,
          labels,
          enabled: true,
          page,
          size: 10,
          search: '',
          sort: '',
        }),
      { initialProps: { page: 0 } },
    );

    await waitFor(() => expect(result.current.status).toBe('success'));

    rerender({ page: 1 });

    await waitFor(() => expect(list).toHaveBeenCalledTimes(2));
    const secondCall = (list.mock.calls[1] as unknown as [PartyListParams])[0];
    expect(secondCall.page).toBe(1);
  });

  it('does not request data when disabled', () => {
    const list = vi.fn(async () => makePage());
    const api = makeApi(list as unknown as PartyApi['list']);

    const { result } = renderHook(() =>
      usePartyList({
        api,
        labels,
        enabled: false,
        page: 0,
        size: 10,
        search: '',
        sort: '',
      }),
    );

    expect(result.current.status).toBe('idle');
    expect(list).not.toHaveBeenCalled();
  });

  it('handles an unauthorized response with the session message', async () => {
    const list = vi.fn();
    list.mockRejectedValueOnce(
      new ApiError('Unauthorized', { kind: 'http', status: 401 }),
    );
    const api = makeApi(list as unknown as PartyApi['list']);

    const { result } = renderHook(() =>
      usePartyList({
        api,
        labels,
        enabled: true,
        page: 0,
        size: 10,
        search: '',
        sort: '',
      }),
    );

    await waitFor(() => expect(result.current.status).toBe('error'));
    expect(result.current.error).toBe(
      'Your session has expired. Please sign in again.',
    );
  });
});
