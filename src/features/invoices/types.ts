import type { PageResponse } from 'src/lib/api/types';
import type { AccountOption } from 'src/features/expenses/types';
import type { Customer } from 'src/features/parties/types';

export type InvoiceStatus =
  | 'DRAFT'
  | 'ISSUED'
  | 'PARTIALLY_PAID'
  | 'PAID'
  | 'OVERDUE'
  | 'VOID';

export type InvoiceAction = 'issue' | 'void';

export interface InvoiceLine {
  id: string;
  description: string | null;
  quantity: number;
  unitPrice: number;
  taxRate: number;
  discountAmount: number;
  revenueAccountId: string;
  revenueAccountCode: string;
  revenueAccountName: string;
  lineSubtotal: number;
  lineTaxAmount: number;
  lineTotal: number;
}

export interface InvoiceRecord {
  id: string;
  organizationId: string;
  organizationName: string;
  customerId: string;
  customerName: string;
  invoiceNumber: string;
  invoiceDate: string;
  dueDate: string | null;
  status: InvoiceStatus;
  subtotal: number;
  taxAmount: number;
  discountAmount: number;
  totalAmount: number;
  amountPaid: number;
  balanceDue: number;
  notes: string | null;
  terms: string | null;
  journalEntryId: string | null;
  createdBy: string;
  createdByEmail: string;
  createdAt: string;
  updatedAt: string;
  lines: InvoiceLine[];
}

export interface InvoiceListParams {
  page: number;
  size: number;
  status: InvoiceStatus | '';
  customerId: string;
  invoiceNumber: string;
  invoiceDate: string;
  dueDate: string;
  sort: string;
}

export interface InvoiceLineFormValues {
  description: string;
  quantity: string;
  unitPrice: string;
  taxRate: string;
  discountAmount: string;
  revenueAccountId: string;
}

export interface InvoiceFormValues {
  customerId: string;
  invoiceNumber: string;
  invoiceDate: string;
  dueDate: string;
  notes: string;
  terms: string;
  lines: InvoiceLineFormValues[];
}

export interface InvoiceLineInput {
  description: string;
  quantity: number;
  unitPrice: number;
  taxRate: number;
  discountAmount: number;
  revenueAccountId: string;
}

export interface CreateInvoiceInput {
  customerId: string;
  invoiceNumber: string;
  invoiceDate: string;
  dueDate?: string;
  notes: string;
  terms: string;
  lines: InvoiceLineInput[];
}

export interface UpdateInvoiceInput {
  customerId: string;
  invoiceNumber: string;
  invoiceDate: string;
  dueDate?: string;
  notes: string;
  terms: string;
  lines: InvoiceLineInput[];
}

export interface InvoiceLookups {
  customers: Customer[];
  revenueAccounts: AccountOption[];
}

export interface InvoiceApi {
  list: (
    params: InvoiceListParams,
    signal?: AbortSignal,
  ) => Promise<PageResponse<InvoiceRecord>>;
  get: (id: string, signal?: AbortSignal) => Promise<InvoiceRecord>;
  create: (input: CreateInvoiceInput, signal?: AbortSignal) => Promise<InvoiceRecord>;
  update: (
    id: string,
    input: UpdateInvoiceInput,
    signal?: AbortSignal,
  ) => Promise<InvoiceRecord>;
  issue: (id: string, signal?: AbortSignal) => Promise<InvoiceRecord>;
  void: (id: string, signal?: AbortSignal) => Promise<InvoiceRecord>;
  lookups: (signal?: AbortSignal) => Promise<InvoiceLookups>;
}

export interface InvoicePreview {
  subtotal: number;
  taxAmount: number;
  discountAmount: number;
  totalAmount: number;
}
