export interface DashboardResponse {
  fromDate: string;
  toDate: string;
  totalRevenue: number;
  totalExpenses: number;
  netProfit: number;
  totalInvoiced: number;
  totalOutstanding: number;
  customerCount: number;
  vendorCount: number;
  invoiceCount: number;
  expenseCount: number;
}

export interface ExpenseAccountSummaryLine {
  expenseAccountId: string;
  expenseAccountCode: string;
  expenseAccountName: string;
  totalAmount: number;
  expenseCount: number;
}

export interface VendorExpenseSummaryLine {
  vendorId: string;
  vendorName: string;
  totalAmount: number;
  expenseCount: number;
}

export interface ExpenseSummaryResponse {
  fromDate: string;
  toDate: string;
  byAccount: ExpenseAccountSummaryLine[];
  byVendor: VendorExpenseSummaryLine[];
  totalAmount: number;
  expenseCount: number;
}

export interface InvoiceSummaryResponse {
  fromDate: string;
  toDate: string;
  invoiceCount: number;
  totalInvoiced: number;
  totalPaid: number;
  totalOutstanding: number;
}
