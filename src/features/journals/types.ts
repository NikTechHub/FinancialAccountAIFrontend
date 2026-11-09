import type { PageResponse } from 'src/lib/api/types';

export type JournalEntryStatus = 'DRAFT' | 'POSTED' | 'VOID';

export interface JournalEntryLine {
  id: string;
  accountId: string;
  accountCode: string;
  accountName: string;
  description: string | null;
  debitAmount: number;
  creditAmount: number;
}

export interface JournalEntryRecord {
  id: string;
  organizationId: string;
  organizationName: string;
  entryNumber: string;
  entryDate: string;
  description: string | null;
  reference: string | null;
  status: JournalEntryStatus;
  createdBy: string;
  createdByEmail: string;
  createdAt: string;
  updatedAt: string;
  lines: JournalEntryLine[];
  totalDebits: number;
  totalCredits: number;
}

export interface JournalEntryListParams {
  page: number;
  size: number;
  status: JournalEntryStatus | '';
  entryDate: string;
  entryNumber: string;
  reference: string;
  sort: string;
}

export interface JournalEntryLineFormValues {
  accountId: string;
  description: string;
  debitAmount: string;
  creditAmount: string;
}

export interface JournalEntryFormValues {
  entryNumber: string;
  entryDate: string;
  description: string;
  reference: string;
  lines: JournalEntryLineFormValues[];
}

export interface JournalEntryLineInput {
  accountId: string;
  description: string;
  debitAmount: number;
  creditAmount: number;
}

export interface CreateJournalEntryInput {
  entryNumber: string;
  entryDate: string;
  description: string;
  reference: string;
  lines: JournalEntryLineInput[];
}

export interface UpdateJournalEntryInput {
  entryNumber?: string;
  entryDate?: string;
  description?: string;
  reference?: string;
  lines?: JournalEntryLineInput[];
}

export interface AccountOption {
  id: string;
  organizationId: string;
  code: string;
  name: string;
  type: string;
  active: boolean;
}

export interface JournalEntryLookups {
  accounts: AccountOption[];
}

export interface JournalEntryApi {
  list: (
    params: JournalEntryListParams,
    signal?: AbortSignal,
  ) => Promise<PageResponse<JournalEntryRecord>>;
  get: (id: string, signal?: AbortSignal) => Promise<JournalEntryRecord>;
  create: (
    input: CreateJournalEntryInput,
    signal?: AbortSignal,
  ) => Promise<JournalEntryRecord>;
  update: (
    id: string,
    input: UpdateJournalEntryInput,
    signal?: AbortSignal,
  ) => Promise<JournalEntryRecord>;
  post: (id: string, signal?: AbortSignal) => Promise<JournalEntryRecord>;
  void: (id: string, signal?: AbortSignal) => Promise<JournalEntryRecord>;
  lookups: (signal?: AbortSignal) => Promise<JournalEntryLookups>;
}

export type JournalEntryAction = 'post' | 'void';
