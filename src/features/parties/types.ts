import type { PageResponse } from 'src/lib/api/types';

export interface PartyRecord {
  id: string;
  organizationId: string;
  organizationName: string;
  name: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  taxIdentifier: string | null;
  paymentTerms: string | null;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export type Vendor = PartyRecord;
export type Customer = PartyRecord;

export interface PartyInput {
  name: string;
  email: string;
  phone: string;
  address: string;
  taxIdentifier: string;
  paymentTerms: string;
}

export type PartyFormValues = PartyInput;

export interface PartyListParams {
  page: number;
  size: number;
  search: string;
  sort: string;
}

export interface PartyApi {
  list: (params: PartyListParams, signal?: AbortSignal) => Promise<PageResponse<PartyRecord>>;
  create: (input: PartyInput, signal?: AbortSignal) => Promise<PartyRecord>;
  update: (id: string, input: PartyInput, signal?: AbortSignal) => Promise<PartyRecord>;
  deactivate: (id: string, signal?: AbortSignal) => Promise<void>;
}

export interface PartyLabels {
  singular: string;
  plural: string;
  lowerSingular: string;
  lowerPlural: string;
}

export interface PartyPageConfig {
  labels: PartyLabels;
  api: PartyApi;
  emptyDescription: string;
  searchPlaceholder: string;
  readOnlyMessage: string;
}
