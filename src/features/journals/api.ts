import { api } from 'src/lib/api/client';
import type { PageResponse } from 'src/lib/api/types';
import type {
  AccountOption,
  JournalEntryApi,
  JournalEntryRecord,
} from './types';

const ACCOUNT_LOOKUP_PAGE_SIZE = 200;
const ACCOUNT_LOOKUP_MAX_PAGES = 100;

function query(params: Record<string, string | number | undefined>) {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== '') search.set(key, String(value));
  });
  const result = search.toString();
  return result ? `?${result}` : '';
}

async function fetchAllAccounts(signal?: AbortSignal): Promise<AccountOption[]> {
  const accounts: AccountOption[] = [];
  const seen = new Set<string>();

  for (let page = 0; page < ACCOUNT_LOOKUP_MAX_PAGES; page += 1) {
    const response = await api.get<PageResponse<AccountOption>>(
      `/accounts?page=${page}&size=${ACCOUNT_LOOKUP_PAGE_SIZE}&sort=code,asc`,
      { signal },
    );

    for (const account of response.content) {
      if (seen.has(account.id)) continue;
      seen.add(account.id);
      accounts.push(account);
    }

    if (
      response.last ||
      response.content.length === 0 ||
      page + 1 >= response.totalPages
    ) {
      break;
    }
  }

  return accounts;
}

export const journalEntryApi: JournalEntryApi = {
  list(params, signal) {
    return api.get<PageResponse<JournalEntryRecord>>(
      `/journal-entries${query({
        status: params.status,
        entryDate: params.entryDate.trim(),
        entryNumber: params.entryNumber.trim(),
        reference: params.reference.trim(),
        page: params.page,
        size: params.size,
        sort: params.sort,
      })}`,
      { signal },
    );
  },

  get(id, signal) {
    return api.get<JournalEntryRecord>(`/journal-entries/${id}`, { signal });
  },

  create(input, signal) {
    return api.post<JournalEntryRecord>('/journal-entries', input, { signal });
  },

  update(id, input, signal) {
    return api.put<JournalEntryRecord>(`/journal-entries/${id}`, input, { signal });
  },

  post(id, signal) {
    return api.post<JournalEntryRecord>(`/journal-entries/${id}/post`, undefined, {
      signal,
    });
  },

  void(id, signal) {
    return api.delete<JournalEntryRecord>(`/journal-entries/${id}`, { signal });
  },

  async lookups(signal) {
    return {
      accounts: await fetchAllAccounts(signal),
    };
  },
};
