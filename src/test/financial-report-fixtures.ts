import type { BalanceSheetResponse, ProfitAndLossResponse } from 'src/features/reports/types';

export function profitAndLossFixture(overrides: Partial<ProfitAndLossResponse> = {}): ProfitAndLossResponse {
  return {
    fromDate: '2026-01-01', toDate: '2026-05-15',
    revenueLines: [{ accountId: 'revenue-id', accountCode: '4000', accountName: 'Consulting revenue', amount: 1500.1256 }],
    expenseLines: [{ accountId: 'expense-id', accountCode: '5000', accountName: 'Office costs', amount: 300.0255 }],
    totalRevenue: 1500.1256, totalExpenses: 300.0255, netProfit: 1200.1001,
    ...overrides,
  };
}

export function balanceSheetFixture(overrides: Partial<BalanceSheetResponse> = {}): BalanceSheetResponse {
  return {
    asOfDate: '2026-05-15',
    assetLines: [{ accountId: 'asset-id', accountCode: '1000', accountName: 'Bank account', accountType: 'ASSET', balance: 1500.1256 }],
    liabilityLines: [{ accountId: 'liability-id', accountCode: '2000', accountName: 'Accounts payable', accountType: 'LIABILITY', balance: 300.0255 }],
    equityLines: [{ accountId: 'equity-id', accountCode: '3000', accountName: 'Owner capital', accountType: 'EQUITY', balance: 1200.1001 }],
    totalAssets: 1500.1256, totalLiabilities: 300.0255, totalEquity: 1200.1001,
    ...overrides,
  };
}
