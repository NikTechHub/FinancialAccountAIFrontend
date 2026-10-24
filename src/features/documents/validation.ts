import type {
  DocumentReview,
  ReviewFormValues,
  StructuredExtractionData,
  StructuredLineItem,
} from './types';

export const MAX_DOCUMENT_SIZE = 10 * 1024 * 1024;

const allowedTypes = new Set([
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
]);

const allowedExtensions = new Set(['pdf', 'jpg', 'jpeg', 'png', 'webp']);

export type DocumentFileInfo = Pick<File, 'name' | 'size' | 'type'>;

export function validateDocumentFile(file: DocumentFileInfo | null) {
  if (!file) return 'Choose a document to upload.';
  if (file.size <= 0) return 'The selected file is empty.';
  if (file.size > MAX_DOCUMENT_SIZE) return 'Documents must be 10 MB or smaller.';

  const contentType = file.type.split(';')[0].trim().toLowerCase();
  if (!allowedTypes.has(contentType)) {
    return 'Choose a PDF, JPEG, PNG, or WebP document.';
  }

  const extension = file.name.split('.').pop()?.toLowerCase() ?? '';
  if (!allowedExtensions.has(extension)) {
    return 'The file extension must be PDF, JPG, JPEG, PNG, or WebP.';
  }

  return null;
}

export function formatFileSize(size: number) {
  if (!Number.isFinite(size) || size < 0) return '—';
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readString(value: unknown) {
  return typeof value === 'string' ? value : null;
}

function readNumber(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function parseLineItem(value: unknown): StructuredLineItem | null {
  if (!isRecord(value)) return null;
  return {
    description: readString(value.description),
    quantity: readNumber(value.quantity),
    unitPrice: readNumber(value.unitPrice),
    taxRate: readNumber(value.taxRate),
    taxAmount: readNumber(value.taxAmount),
    discountAmount: readNumber(value.discountAmount),
    lineTotal: readNumber(value.lineTotal),
  };
}

export function parseStructuredData(value: unknown): StructuredExtractionData | null {
  if (!isRecord(value)) return null;

  const lineItems = Array.isArray(value.lineItems)
    ? value.lineItems
        .map(parseLineItem)
        .filter((item): item is StructuredLineItem => item !== null)
    : [];

  return {
    documentType: readString(value.documentType),
    invoiceNumber: readString(value.invoiceNumber),
    invoiceDate: readString(value.invoiceDate),
    dueDate: readString(value.dueDate),
    currency: readString(value.currency),
    vendorName: readString(value.vendorName),
    vendorTaxIdentifier: readString(value.vendorTaxIdentifier),
    vendorEmail: readString(value.vendorEmail),
    vendorPhone: readString(value.vendorPhone),
    customerName: readString(value.customerName),
    customerTaxIdentifier: readString(value.customerTaxIdentifier),
    subtotal: readNumber(value.subtotal),
    taxAmount: readNumber(value.taxAmount),
    discountAmount: readNumber(value.discountAmount),
    totalAmount: readNumber(value.totalAmount),
    paymentTerms: readString(value.paymentTerms),
    notes: readString(value.notes),
    lineItems,
  };
}

function text(value: string | null | undefined) {
  return value ?? '';
}

function numberText(value: number | null) {
  return value === null ? '' : String(value);
}

export function structuredToForm(data: StructuredExtractionData | null): ReviewFormValues {
  return {
    documentType: text(data?.documentType),
    invoiceNumber: text(data?.invoiceNumber),
    invoiceDate: text(data?.invoiceDate),
    dueDate: text(data?.dueDate),
    currency: text(data?.currency),
    vendorName: text(data?.vendorName),
    vendorTaxIdentifier: text(data?.vendorTaxIdentifier),
    vendorEmail: text(data?.vendorEmail),
    vendorPhone: text(data?.vendorPhone),
    customerName: text(data?.customerName),
    customerTaxIdentifier: text(data?.customerTaxIdentifier),
    subtotal: numberText(data?.subtotal ?? null),
    taxAmount: numberText(data?.taxAmount ?? null),
    discountAmount: numberText(data?.discountAmount ?? null),
    totalAmount: numberText(data?.totalAmount ?? null),
    paymentTerms: text(data?.paymentTerms),
    notes: text(data?.notes),
  };
}

export type ReviewFormErrors = Partial<Record<keyof ReviewFormValues, string>>;

function isIsoDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

function validateAmount(value: string, label: string) {
  if (!value.trim()) return undefined;
  if (!/^\d+(\.\d{1,4})?$/.test(value.trim())) {
    return `${label} must be a non-negative amount with up to 4 decimal places.`;
  }
  return undefined;
}

function validateOptionalDate(value: string, label: string) {
  if (!value.trim()) return undefined;
  if (!isIsoDate(value.trim())) return `${label} must be a valid date.`;
  return undefined;
}

export function validateReviewForm(values: ReviewFormValues) {
  const errors: ReviewFormErrors = {};

  const amountFields: [keyof ReviewFormValues, string][] = [
    ['subtotal', 'Subtotal'],
    ['taxAmount', 'Tax amount'],
    ['discountAmount', 'Discount amount'],
    ['totalAmount', 'Total amount'],
  ];

  amountFields.forEach(([field, label]) => {
    const message = validateAmount(values[field], label);
    if (message) errors[field] = message;
  });

  const dateFields: [keyof ReviewFormValues, string][] = [
    ['invoiceDate', 'Invoice date'],
    ['dueDate', 'Due date'],
  ];

  dateFields.forEach(([field, label]) => {
    const message = validateOptionalDate(values[field], label);
    if (message) errors[field] = message;
  });

  if (values.invoiceNumber.length > 100) {
    errors.invoiceNumber = 'Invoice number must be 100 characters or fewer.';
  }
  if (values.currency && !/^[A-Za-z]{3}$/.test(values.currency.trim())) {
    errors.currency = 'Currency must be a three-letter code.';
  }
  if (values.notes.length > 2000) {
    errors.notes = 'Notes must be 2,000 characters or fewer.';
  }

  return errors;
}

function optionalText(value: string) {
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function optionalNumber(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
}

export function toReviewedData(
  values: ReviewFormValues,
  lineItems: StructuredLineItem[],
): StructuredExtractionData {
  return {
    documentType: optionalText(values.documentType),
    invoiceNumber: optionalText(values.invoiceNumber),
    invoiceDate: optionalText(values.invoiceDate),
    dueDate: optionalText(values.dueDate),
    currency: optionalText(values.currency),
    vendorName: optionalText(values.vendorName),
    vendorTaxIdentifier: optionalText(values.vendorTaxIdentifier),
    vendorEmail: optionalText(values.vendorEmail),
    vendorPhone: optionalText(values.vendorPhone),
    customerName: optionalText(values.customerName),
    customerTaxIdentifier: optionalText(values.customerTaxIdentifier),
    subtotal: optionalNumber(values.subtotal),
    taxAmount: optionalNumber(values.taxAmount),
    discountAmount: optionalNumber(values.discountAmount),
    totalAmount: optionalNumber(values.totalAmount),
    paymentTerms: optionalText(values.paymentTerms),
    notes: optionalText(values.notes),
    lineItems,
  };
}

export function reviewFormFromReview(review: DocumentReview): ReviewFormValues {
  return structuredToForm(
    parseStructuredData(review.reviewedData) ??
      parseStructuredData(review.originalAiData),
  );
}

export function lineItemsFromReview(review: DocumentReview): StructuredLineItem[] {
  return (
    parseStructuredData(review.reviewedData)?.lineItems ??
    parseStructuredData(review.originalAiData)?.lineItems ??
    []
  );
}

export function formatConfidence(value: number | null) {
  if (value === null || !Number.isFinite(value)) return null;
  const percentage = value >= 0 && value <= 1 ? value * 100 : value;
  return `${percentage.toFixed(1)}%`;
}

export function extractionModelNotice(model: string | null) {
  const normalized = model?.trim().toLowerCase() ?? '';
  if (!normalized) return null;

  if (normalized.includes('fallback')) {
    return 'The backend reports a fallback extraction model. These values are deterministic suggestions, not verified AI output.';
  }

  if (normalized.includes('fake')) {
    return 'The backend reports a test extraction model. These values are not production AI output.';
  }

  return null;
}
