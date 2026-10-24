import type { PageResponse } from 'src/lib/api/types';

export type ExpenseStatus = 'DRAFT' | 'RECORDED' | 'VOID';

export type AccountType = 'ASSET' | 'LIABILITY' | 'EQUITY' | 'REVENUE' | 'EXPENSE';

export interface ExpenseRecord {
  id: string;
  organizationId: string;
  organizationName: string;
  vendorId: string | null;
  vendorName: string | null;
  expenseAccountId: string;
  expenseAccountCode: string;
  expenseAccountName: string;
  paymentAccountId: string;
  paymentAccountCode: string;
  paymentAccountName: string;
  amount: number;
  expenseDate: string;
  description: string | null;
  reference: string | null;
  status: ExpenseStatus;
  journalEntryId: string | null;
  createdBy: string;
  createdByEmail: string;
  createdAt: string;
  updatedAt: string;
}

export interface ExpenseListParams {
  page: number;
  size: number;
  reference: string;
  status: ExpenseStatus | '';
  sort: string;
}

export interface ExpenseFormValues {
  vendorId: string;
  expenseAccountId: string;
  paymentAccountId: string;
  amount: string;
  expenseDate: string;
  description: string;
  reference: string;
}

export interface CreateExpenseInput {
  vendorId?: string;
  expenseAccountId: string;
  paymentAccountId: string;
  amount: number;
  expenseDate: string;
  description: string;
  reference: string;
}

export interface UpdateExpenseInput {
  vendorId?: string;
  expenseAccountId?: string;
  paymentAccountId?: string;
  amount?: number;
  expenseDate?: string;
  description?: string;
  reference?: string;
}

export interface AccountOption {
  id: string;
  code: string;
  name: string;
  type: AccountType;
  active: boolean;
}

export interface VendorOption {
  id: string;
  name: string;
}

export interface ExpenseLookups {
  accounts: AccountOption[];
  vendors: VendorOption[];
}

export interface ExpenseApi {
  list: (params: ExpenseListParams, signal?: AbortSignal) => Promise<PageResponse<ExpenseRecord>>;
  create: (input: CreateExpenseInput, signal?: AbortSignal) => Promise<ExpenseRecord>;
  update: (
    id: string,
    input: UpdateExpenseInput,
    signal?: AbortSignal,
  ) => Promise<ExpenseRecord>;
  record: (id: string, signal?: AbortSignal) => Promise<ExpenseRecord>;
  void: (id: string, signal?: AbortSignal) => Promise<ExpenseRecord>;
  lookups: (signal?: AbortSignal) => Promise<ExpenseLookups>;
}

export type ExpenseAction = 'record' | 'void';
