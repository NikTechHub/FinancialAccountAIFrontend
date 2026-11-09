import { api, ApiError } from 'src/lib/api/client';
import type { PageResponse } from 'src/lib/api/types';
import { parseBalanceSheet, parseGeneralLedger, parseProfitAndLoss, parseTrialBalance } from './response';
import { validateReportAsOfDate, validateReportDateRange } from './dates';
import type {
  GeneralLedgerParams,
  ReportAccount,
  ReportApi,
  TrialBalanceParams,
} from './types';

const ACCOUNT_PAGE_SIZE = 200;
const ACCOUNT_MAX_PAGES = 100;

function query(params: Record<string, string | number>) {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    search.set(key, String(value));
  });
  return search.toString();
}

async function fetchActiveAccounts(
  organizationId: string,
  signal?: AbortSignal,
): Promise<ReportAccount[]> {
  const accounts: ReportAccount[] = [];
  const seen = new Set<string>();

  for (let page = 0; page < ACCOUNT_MAX_PAGES; page += 1) {
    const response = await api.get<PageResponse<ReportAccount>>(
      `/accounts?${query({
        page,
        size: ACCOUNT_PAGE_SIZE,
        sort: 'code,asc',
      })}`,
      { signal },
    );

    for (const account of response.content) {
      if (!account.active || account.organizationId !== organizationId) continue;
      if (seen.has(account.id)) continue;
      seen.add(account.id);
      accounts.push(account);
    }

    if (
      response.last ||
      page + 1 >= response.totalPages
    ) {
      return accounts;
    }
    if (response.content.length === 0) break;
  }

  // Never present an incomplete account lookup as the complete selector.
  throw new ApiError('The account list could not be loaded completely.', { kind: 'parse' });
}

function validateDates(params: TrialBalanceParams) {
  const error = validateReportDateRange(params.fromDate, params.toDate);
  if (error) throw new ApiError(error, { kind: 'http', status: 400 });
}

export const reportApi: ReportApi = {
  async profitAndLoss(params, signal) {
    validateDates(params);
    return parseProfitAndLoss(await api.get<string>(
      `/reports/profit-and-loss?${query({ fromDate: params.fromDate, toDate: params.toDate })}`,
      { signal, responseType: 'text' },
    ));
  },

  async balanceSheet(params, signal) {
    const error = validateReportAsOfDate(params.asOfDate);
    if (error) throw new ApiError(error, { kind: 'http', status: 400 });
    return parseBalanceSheet(await api.get<string>(
      `/reports/balance-sheet?${query({ asOfDate: params.asOfDate })}`,
      { signal, responseType: 'text' },
    ));
  },

  activeAccounts(organizationId, signal) {
    if (!organizationId) return Promise.resolve([]);
    return fetchActiveAccounts(organizationId, signal);
  },

  async trialBalance(params: TrialBalanceParams, signal) {
    validateDates(params);
    return parseTrialBalance(await api.get<string>(
      `/reports/trial-balance?${query({
        fromDate: params.fromDate,
        toDate: params.toDate,
      })}`,
      { signal, responseType: 'text' },
    ));
  },

  async generalLedger(params: GeneralLedgerParams, signal) {
    validateDates(params);
    return parseGeneralLedger(await api.get<string>(
      `/reports/general-ledger?${query({
        accountId: params.accountId,
        fromDate: params.fromDate,
        toDate: params.toDate,
        page: params.page,
        size: params.size,
      })}`,
      { signal, responseType: 'text' },
    ));
  },
};
