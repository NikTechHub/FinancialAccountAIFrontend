import type { PageResponse } from 'src/lib/api/types';

export type DocumentType = 'INVOICE' | 'RECEIPT' | 'EXPENSE_RECEIPT' | 'OTHER';
export type DocumentStatus = 'UPLOADED' | 'PROCESSING' | 'PROCESSED' | 'FAILED';
export type ProcessingStatus = 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';
export type DocumentReviewStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

export interface DocumentRecord {
  id: string;
  organizationId: string;
  invoiceId: string | null;
  expenseId: string | null;
  originalFileName: string;
  contentType: string;
  fileSize: number;
  documentType: DocumentType;
  status: DocumentStatus;
  checksum: string;
  uploadedBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface DocumentListParams {
  page: number;
  size: number;
  filename: string;
  sort: string;
}

export interface DocumentUploadInput {
  file: File;
  documentType: DocumentType;
  expenseId?: string;
}

export interface ProcessingAccepted {
  documentId: string;
  operationId: string;
  status: string;
  message: string;
}

export interface OcrResult {
  id: string;
  documentId: string;
  status: ProcessingStatus;
  extractedText: string | null;
  pageCount: number | null;
  processingStartedAt: string | null;
  processingCompletedAt: string | null;
  errorMessage: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface StructuredLineItem {
  description: string | null;
  quantity: number | null;
  unitPrice: number | null;
  taxRate: number | null;
  taxAmount: number | null;
  discountAmount: number | null;
  lineTotal: number | null;
}

export interface StructuredExtractionData {
  documentType: string | null;
  invoiceNumber: string | null;
  invoiceDate: string | null;
  dueDate: string | null;
  currency: string | null;
  vendorName: string | null;
  vendorTaxIdentifier: string | null;
  vendorEmail: string | null;
  vendorPhone: string | null;
  customerName: string | null;
  customerTaxIdentifier: string | null;
  subtotal: number | null;
  taxAmount: number | null;
  discountAmount: number | null;
  totalAmount: number | null;
  paymentTerms: string | null;
  notes: string | null;
  lineItems: StructuredLineItem[];
}

export interface DocumentExtraction {
  id: string;
  documentId: string;
  extractionType: DocumentType;
  status: ProcessingStatus;
  model: string | null;
  promptVersion: string | null;
  structuredData: unknown;
  confidence: number | null;
  processingStartedAt: string | null;
  processingCompletedAt: string | null;
  errorMessage: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ReviewReviewer {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
}

export interface DocumentReview {
  id: string;
  documentId: string;
  extractionId: string;
  status: DocumentReviewStatus;
  originalAiData: unknown;
  reviewedData: unknown;
  reviewedBy: ReviewReviewer | null;
  reviewedAt: string | null;
  reviewComment: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ReviewFormValues {
  documentType: string;
  invoiceNumber: string;
  invoiceDate: string;
  dueDate: string;
  currency: string;
  vendorName: string;
  vendorTaxIdentifier: string;
  vendorEmail: string;
  vendorPhone: string;
  customerName: string;
  customerTaxIdentifier: string;
  subtotal: string;
  taxAmount: string;
  discountAmount: string;
  totalAmount: string;
  paymentTerms: string;
  notes: string;
}

export interface DocumentApi {
  list: (
    params: DocumentListParams,
    signal?: AbortSignal,
  ) => Promise<PageResponse<DocumentRecord>>;
  upload: (input: DocumentUploadInput, signal?: AbortSignal) => Promise<DocumentRecord>;
  get: (id: string, signal?: AbortSignal) => Promise<DocumentRecord>;
  download: (id: string, signal?: AbortSignal) => Promise<Blob>;
  delete: (id: string, signal?: AbortSignal) => Promise<void>;
  startOcr: (id: string, signal?: AbortSignal) => Promise<ProcessingAccepted>;
  getOcr: (id: string, signal?: AbortSignal) => Promise<OcrResult>;
  startExtraction: (id: string, signal?: AbortSignal) => Promise<ProcessingAccepted>;
  getExtraction: (id: string, signal?: AbortSignal) => Promise<DocumentExtraction>;
  createReview: (id: string, signal?: AbortSignal) => Promise<DocumentReview>;
  getReview: (id: string, signal?: AbortSignal) => Promise<DocumentReview>;
  updateReview: (
    id: string,
    reviewedData: StructuredExtractionData,
    signal?: AbortSignal,
  ) => Promise<DocumentReview>;
  approveReview: (
    id: string,
    reviewComment: string,
    signal?: AbortSignal,
  ) => Promise<DocumentReview>;
  rejectReview: (
    id: string,
    reviewComment: string,
    signal?: AbortSignal,
  ) => Promise<DocumentReview>;
  reopenReview: (id: string, signal?: AbortSignal) => Promise<DocumentReview>;
}
