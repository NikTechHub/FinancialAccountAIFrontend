import { api } from 'src/lib/api/client';
import type { PageResponse } from 'src/lib/api/types';
import type {
  AccountOption,
  CreateExpenseInput,
  ExpenseListParams,
  ExpenseLookups,
  ExpenseRecord,
  UpdateExpenseInput,
  VendorOption,
} from './types';

function query(params: Record<string, string | number | undefined>) {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== '') search.set(key, String(value));
  });
  const result = search.toString();
  return result ? `?${result}` : '';
}

export const expenseApi = {
  list(params: ExpenseListParams, signal?: AbortSignal) {
    return api.get<PageResponse<ExpenseRecord>>(
      `/expenses${query({
        page: params.page,
        size: params.size,
        reference: params.reference.trim(),
        status: params.status,
        sort: params.sort,
      })}`,
      { signal },
    );
  },

  create(input: CreateExpenseInput, signal?: AbortSignal) {
    return api.post<ExpenseRecord>('/expenses', input, { signal });
  },

  update(id: string, input: UpdateExpenseInput, signal?: AbortSignal) {
    return api.put<ExpenseRecord>(`/expenses/${id}`, input, { signal });
  },

  record(id: string, signal?: AbortSignal) {
    return api.post<ExpenseRecord>(`/expenses/${id}/record`, undefined, { signal });
  },

  void(id: string, signal?: AbortSignal) {
    return api.delete<ExpenseRecord>(`/expenses/${id}`, { signal });
  },

  async lookups(signal?: AbortSignal): Promise<ExpenseLookups> {
    const [accounts, vendors] = await Promise.all([
      api.get<PageResponse<AccountOption>>(
        '/accounts?page=0&size=200&sort=code,asc',
        { signal },
      ),
      api.get<PageResponse<VendorOption>>('/vendors?page=0&size=200&sort=name,asc', {
        signal,
      }),
    ]);

    return {
      accounts: accounts.content,
      vendors: vendors.content,
    };
  },
};
