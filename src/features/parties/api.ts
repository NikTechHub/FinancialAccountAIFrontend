import { api } from 'src/lib/api/client';
import type { PageResponse } from 'src/lib/api/types';
import type {
  Customer,
  PartyApi,
  PartyInput,
  PartyListParams,
  PartyRecord,
  Vendor,
} from './types';

function listPath(path: string, params: PartyListParams): string {
  const query = new URLSearchParams({
    page: String(params.page),
    size: String(params.size),
  });

  const search = params.search.trim();
  if (search) query.set('search', search);
  if (params.sort) query.set('sort', params.sort);

  return `${path}?${query.toString()}`;
}

async function listParties<T extends PartyRecord>(
  path: string,
  params: PartyListParams,
  signal?: AbortSignal,
): Promise<PageResponse<T>> {
  return api.get<PageResponse<T>>(listPath(path, params), { signal });
}

export function fetchVendors(
  params: PartyListParams,
  signal?: AbortSignal,
): Promise<PageResponse<Vendor>> {
  return listParties<Vendor>('/vendors', params, signal);
}

export function createVendor(input: PartyInput, signal?: AbortSignal): Promise<Vendor> {
  return api.post<Vendor>('/vendors', input, { signal });
}

export function updateVendor(
  id: string,
  input: PartyInput,
  signal?: AbortSignal,
): Promise<Vendor> {
  return api.put<Vendor>(`/vendors/${id}`, input, { signal });
}

export function deactivateVendor(id: string, signal?: AbortSignal): Promise<void> {
  return api.delete<void>(`/vendors/${id}`, { signal });
}

export function fetchCustomers(
  params: PartyListParams,
  signal?: AbortSignal,
): Promise<PageResponse<Customer>> {
  return listParties<Customer>('/customers', params, signal);
}

export function createCustomer(input: PartyInput, signal?: AbortSignal): Promise<Customer> {
  return api.post<Customer>('/customers', input, { signal });
}

export function updateCustomer(
  id: string,
  input: PartyInput,
  signal?: AbortSignal,
): Promise<Customer> {
  return api.put<Customer>(`/customers/${id}`, input, { signal });
}

export function deactivateCustomer(id: string, signal?: AbortSignal): Promise<void> {
  return api.delete<void>(`/customers/${id}`, { signal });
}

export const vendorApi: PartyApi = {
  list: fetchVendors,
  create: createVendor,
  update: updateVendor,
  deactivate: deactivateVendor,
};

export const customerApi: PartyApi = {
  list: fetchCustomers,
  create: createCustomer,
  update: updateCustomer,
  deactivate: deactivateCustomer,
};
