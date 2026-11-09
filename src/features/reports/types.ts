import type { PageResponse } from 'src/lib/api/types';
import type { AccountType } from 'src/features/accounts/types';

// API decimal tokens are preserved as strings before JSON number coercion.
export type ReportAmount = string | number;

export interface ReportAccount {
  id: string;
  organizationId: string;
  code: string;
  name: string;
  type: AccountType;
  active: boolean;
}

export interface ReportDateRange {
  fromDate: string;
  toDate: string;
}

export type TrialBalanceParams = ReportDateRange;

export type ProfitAndLossParams = ReportDateRange;

export interface BalanceSheetParams {
  asOfDate: string;
}

export interface ProfitAndLossLine {
  accountId: string;
  accountCode: string;
  accountName: string;
  amount: ReportAmount;
}

export interface ProfitAndLossResponse extends ReportDateRange {
  revenueLines: ProfitAndLossLine[];
  expenseLines: ProfitAndLossLine[];
  totalRevenue: ReportAmount;
  totalExpenses: ReportAmount;
  netProfit: ReportAmount;
}

export interface BalanceSheetLine {
  accountId: string;
  accountCode: string;
  accountName: string;
  accountType: 'ASSET' | 'LIABILITY' | 'EQUITY';
  balance: ReportAmount;
}

export interface BalanceSheetResponse extends BalanceSheetParams {
  assetLines: BalanceSheetLine[];
  liabilityLines: BalanceSheetLine[];
  equityLines: BalanceSheetLine[];
  totalAssets: ReportAmount;
  totalLiabilities: ReportAmount;
  totalEquity: ReportAmount;
}

export interface GeneralLedgerParams extends ReportDateRange {
  accountId: string;
  page: number;
  size: number;
}

export interface TrialBalanceLine {
  accountId: string;
  accountCode: string;
  accountName: string;
  accountType: AccountType;
  debitTotal: ReportAmount;
  creditTotal: ReportAmount;
  netBalance: ReportAmount;
}

export interface TrialBalanceResponse extends ReportDateRange {
  lines: TrialBalanceLine[];
  totalDebits: ReportAmount;
  totalCredits: ReportAmount;
  totalDifference: ReportAmount;
}

export interface GeneralLedgerLine {
  journalEntryId: string;
  entryNumber: string;
  entryDate: string;
  description: string | null;
  reference: string | null;
  accountId: string;
  accountCode: string;
  accountName: string;
  lineDescription: string | null;
  debitAmount: ReportAmount;
  creditAmount: ReportAmount;
}

export interface ReportApi {
  profitAndLoss: (params: ProfitAndLossParams, signal?: AbortSignal) => Promise<ProfitAndLossResponse>;
  balanceSheet: (params: BalanceSheetParams, signal?: AbortSignal) => Promise<BalanceSheetResponse>;
  activeAccounts: (
    organizationId: string,
    signal?: AbortSignal,
  ) => Promise<ReportAccount[]>;
  trialBalance: (
    params: TrialBalanceParams,
    signal?: AbortSignal,
  ) => Promise<TrialBalanceResponse>;
  generalLedger: (
    params: GeneralLedgerParams,
    signal?: AbortSignal,
  ) => Promise<PageResponse<GeneralLedgerLine>>;
}
