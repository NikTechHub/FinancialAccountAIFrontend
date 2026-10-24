import type {
  DashboardResponse,
  ExpenseSummaryResponse,
  InvoiceSummaryResponse,
  VendorExpenseSummaryLine,
} from 'src/features/dashboard/types';

export function makeDashboardResponse(
  overrides: Partial<DashboardResponse> = {},
): DashboardResponse {
  return {
    fromDate: '2026-01-01',
    toDate: '2026-10-20',
    totalRevenue: 0,
    totalExpenses: 0,
    netProfit: 0,
    totalInvoiced: 0,
    totalOutstanding: 0,
    customerCount: 0,
    vendorCount: 0,
    invoiceCount: 0,
    expenseCount: 0,
    ...overrides,
  };
}

export function makeExpenseSummary(
  overrides: Partial<ExpenseSummaryResponse> = {},
): ExpenseSummaryResponse {
  return {
    fromDate: '2026-01-01',
    toDate: '2026-10-20',
    byAccount: [],
    byVendor: [],
    totalAmount: 0,
    expenseCount: 0,
    ...overrides,
  };
}

export function makeInvoiceSummary(
  overrides: Partial<InvoiceSummaryResponse> = {},
): InvoiceSummaryResponse {
  return {
    fromDate: '2026-01-01',
    toDate: '2026-10-20',
    invoiceCount: 0,
    totalInvoiced: 0,
    totalPaid: 0,
    totalOutstanding: 0,
    ...overrides,
  };
}

export function makeVendorLine(
  overrides: Partial<VendorExpenseSummaryLine> = {},
): VendorExpenseSummaryLine {
  return {
    vendorId: 'vendor-1',
    vendorName: 'Acme Supplies',
    totalAmount: 0,
    expenseCount: 0,
    ...overrides,
  };
}
