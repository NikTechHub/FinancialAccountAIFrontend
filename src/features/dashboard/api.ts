import { api } from 'src/lib/api/client';
import type {
  DashboardResponse,
  ExpenseSummaryResponse,
  InvoiceSummaryResponse,
} from './types';

export interface ReportQuery {
  fromDate: string;
  toDate: string;
}

function reportPath(path: string, query: ReportQuery): string {
  const params = new URLSearchParams({
    fromDate: query.fromDate,
    toDate: query.toDate,
  });

  return `${path}?${params.toString()}`;
}

export function fetchDashboard(
  query: ReportQuery,
  signal?: AbortSignal,
): Promise<DashboardResponse> {
  return api.get<DashboardResponse>(reportPath('/reports/dashboard', query), { signal });
}

export function fetchExpenseSummary(
  query: ReportQuery,
  signal?: AbortSignal,
): Promise<ExpenseSummaryResponse> {
  return api.get<ExpenseSummaryResponse>(reportPath('/reports/expenses', query), { signal });
}

export function fetchInvoiceSummary(
  query: ReportQuery,
  signal?: AbortSignal,
): Promise<InvoiceSummaryResponse> {
  return api.get<InvoiceSummaryResponse>(reportPath('/reports/invoices', query), { signal });
}
