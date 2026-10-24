import type { AccountOption } from 'src/features/expenses/types';
import { fetchCustomers } from 'src/features/parties/api';
import { api } from 'src/lib/api/client';
import type { PageResponse } from 'src/lib/api/types';
import type {
  CreateInvoiceInput,
  InvoiceListParams,
  InvoiceLookups,
  InvoiceRecord,
  UpdateInvoiceInput,
} from './types';

function query(params: Record<string, string | number | undefined>) {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== '') search.set(key, String(value));
  });
  const result = search.toString();
  return result ? `?${result}` : '';
}

export const invoiceApi = {
  list(params: InvoiceListParams, signal?: AbortSignal) {
    return api.get<PageResponse<InvoiceRecord>>(
      `/invoices${query({
        page: params.page,
        size: params.size,
        status: params.status,
        customerId: params.customerId,
        invoiceNumber: params.invoiceNumber.trim(),
        invoiceDate: params.invoiceDate,
        dueDate: params.dueDate,
        sort: params.sort,
      })}`,
      { signal },
    );
  },

  get(id: string, signal?: AbortSignal) {
    return api.get<InvoiceRecord>(`/invoices/${id}`, { signal });
  },

  create(input: CreateInvoiceInput, signal?: AbortSignal) {
    return api.post<InvoiceRecord>('/invoices', input, { signal });
  },

  update(id: string, input: UpdateInvoiceInput, signal?: AbortSignal) {
    return api.put<InvoiceRecord>(`/invoices/${id}`, input, { signal });
  },

  issue(id: string, signal?: AbortSignal) {
    return api.post<InvoiceRecord>(`/invoices/${id}/issue`, undefined, { signal });
  },

  void(id: string, signal?: AbortSignal) {
    return api.delete<InvoiceRecord>(`/invoices/${id}`, { signal });
  },

  async lookups(signal?: AbortSignal): Promise<InvoiceLookups> {
    const [customers, accounts] = await Promise.all([
      fetchCustomers(
        { page: 0, size: 200, search: '', sort: 'name,asc' },
        signal,
      ),
      api.get<PageResponse<AccountOption>>(
        '/accounts?page=0&size=200&type=REVENUE&sort=code,asc',
        { signal },
      ),
    ]);

    return {
      customers: customers.content,
      revenueAccounts: accounts.content,
    };
  },
};
