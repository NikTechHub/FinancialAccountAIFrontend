import { api } from 'src/lib/api/client';
import type { PageResponse } from 'src/lib/api/types';

export const auditActions = [
  'LOGIN_SUCCESS', 'LOGIN_FAILURE', 'USER_CREATED', 'MEMBER_ADDED', 'ORGANIZATION_CREATED',
  'VENDOR_CREATED', 'VENDOR_UPDATED', 'VENDOR_DEACTIVATED', 'CUSTOMER_CREATED', 'CUSTOMER_UPDATED',
  'CUSTOMER_DEACTIVATED', 'ACCOUNT_CREATED', 'ACCOUNT_UPDATED', 'ACCOUNT_DEACTIVATED',
  'JOURNAL_ENTRY_CREATED', 'JOURNAL_ENTRY_UPDATED', 'JOURNAL_ENTRY_POSTED', 'JOURNAL_ENTRY_VOIDED',
  'EXPENSE_CREATED', 'EXPENSE_UPDATED', 'EXPENSE_RECORDED', 'EXPENSE_VOIDED', 'INVOICE_CREATED',
  'INVOICE_UPDATED', 'INVOICE_ISSUED', 'INVOICE_VOIDED', 'DOCUMENT_UPLOADED', 'DOCUMENT_DELETED',
  'OCR_REQUESTED', 'OCR_COMPLETED', 'OCR_FAILED', 'DOCUMENT_EXTRACTION_REQUESTED',
  'DOCUMENT_EXTRACTION_COMPLETED', 'DOCUMENT_EXTRACTION_FAILED', 'DOCUMENT_REVIEW_CREATED',
  'DOCUMENT_REVIEW_UPDATED', 'DOCUMENT_REVIEW_APPROVED', 'DOCUMENT_REVIEW_REJECTED',
  'DOCUMENT_REVIEW_REOPENED', 'REPORT_VIEWED', 'ASSISTANT_QUERY',
] as const;

export const auditResourceTypes = [
  'ORGANIZATION', 'USER', 'MEMBERSHIP', 'VENDOR', 'CUSTOMER', 'ACCOUNT', 'JOURNAL_ENTRY',
  'EXPENSE', 'INVOICE', 'DOCUMENT', 'OCR_RESULT', 'DOCUMENT_EXTRACTION', 'DOCUMENT_REVIEW',
  'REPORT', 'ASSISTANT',
] as const;

export type AuditAction = (typeof auditActions)[number];
export type AuditResourceType = (typeof auditResourceTypes)[number];

export interface AuditLogRecord {
  id: string;
  organizationId: string | null;
  action: AuditAction;
  resourceType: AuditResourceType;
  resourceId: string | null;
  actorUserId: string | null;
  actorName: string | null;
  description: string | null;
  beforeData: unknown;
  afterData: unknown;
  metadata: unknown;
  ipAddress: string | null;
  userAgent: string | null;
  success: boolean | null;
  createdAt: string;
}

export interface AuditQuery {
  action?: string;
  resourceType?: string;
  resourceId?: string;
  actorUserId?: string;
  success?: string;
  fromDate?: string;
  toDate?: string;
  page: number;
  size: number;
}

export const auditApi = {
  list(query: AuditQuery, signal?: AbortSignal) {
    const params = new URLSearchParams();
    Object.entries(query).forEach(([key, value]) => {
      if (value !== undefined && value !== '') params.set(key, String(value));
    });
    return api.get<PageResponse<AuditLogRecord>>(`/audit-logs?${params.toString()}`, { signal });
  },
};
