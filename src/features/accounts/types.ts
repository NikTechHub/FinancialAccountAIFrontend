import type { PageResponse } from 'src/lib/api/types';

export type AccountType =
  | 'ASSET'
  | 'LIABILITY'
  | 'EQUITY'
  | 'REVENUE'
  | 'EXPENSE';

export interface AccountRecord {
  id: string;
  organizationId: string;
  organizationName: string;
  code: string;
  name: string;
  type: AccountType;
  parentAccountId: string | null;
  parentAccountName: string | null;
  description: string | null;
  active: boolean;
  systemAccount: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AccountListParams {
  page: number;
  size: number;
  search: string;
  type: AccountType | '';
  sort: string;
}

export interface AccountFormValues {
  code: string;
  name: string;
  type: AccountType | '';
  parentAccountId: string;
  description: string;
}

export interface CreateAccountInput {
  code: string;
  name: string;
  type: AccountType;
  parentAccountId?: string;
  description: string;
}

export interface UpdateAccountInput {
  code: string;
  name: string;
  type: AccountType;
  parentAccountId?: string;
  description: string;
}

export interface AccountTreeNode {
  id: string;
  code: string;
  name: string;
  type: AccountType;
  active: boolean;
  children: AccountTreeNode[];
}

export interface AccountParentOption {
  id: string;
  code: string;
  name: string;
  type: AccountType;
  depth: number;
}

export interface AccountApi {
  list: (
    params: AccountListParams,
    signal?: AbortSignal,
  ) => Promise<PageResponse<AccountRecord>>;
  create: (
    input: CreateAccountInput,
    signal?: AbortSignal,
  ) => Promise<AccountRecord>;
  update: (
    id: string,
    input: UpdateAccountInput,
    signal?: AbortSignal,
  ) => Promise<AccountRecord>;
  deactivate: (id: string, signal?: AbortSignal) => Promise<void>;
  parentOptions: (
    excludeAccountId: string | null,
    signal?: AbortSignal,
  ) => Promise<AccountParentOption[]>;
}
