import { describe, expect, it } from 'vitest';
import type { DocumentReview } from './types';
import {
  MAX_DOCUMENT_SIZE,
  extractionModelNotice,
  formatConfidence,
  formatFileSize,
  lineItemsFromReview,
  parseStructuredData,
  reviewFormFromReview,
  structuredToForm,
  toReviewedData,
  validateDocumentFile,
  validateReviewForm,
} from './validation';

const lineItem = {
  description: 'Consulting',
  quantity: 2,
  unitPrice: 50,
  taxRate: 20,
  taxAmount: 20,
  discountAmount: 0,
  lineTotal: 120,
};

function makeReview(overrides: Partial<DocumentReview> = {}): DocumentReview {
  return {
    id: 'review-1',
    documentId: 'document-1',
    extractionId: 'extraction-1',
    status: 'PENDING',
    originalAiData: {
      documentType: 'INVOICE',
      totalAmount: 120,
      lineItems: [lineItem],
    },
    reviewedData: null,
    reviewedBy: null,
    reviewedAt: null,
    reviewComment: null,
    createdAt: '2026-10-20T12:00:00Z',
    updatedAt: '2026-10-20T12:00:00Z',
    ...overrides,
  };
}

describe('document file validation', () => {
  it('requires a supported type, extension, non-empty body, and at most 10 MB', () => {
    expect(validateDocumentFile(null)).toMatch(/Choose a document/);
    expect(validateDocumentFile({ name: 'receipt.pdf', size: 0, type: 'application/pdf' })).toMatch(
      /empty/,
    );
    expect(
      validateDocumentFile({ name: 'receipt.pdf', size: MAX_DOCUMENT_SIZE + 1, type: 'application/pdf' }),
    ).toMatch(/10 MB/);
    expect(validateDocumentFile({ name: 'receipt.txt', size: 10, type: 'text/plain' })).toMatch(
      /PDF, JPEG, PNG, or WebP/,
    );
    expect(validateDocumentFile({ name: 'receipt.gif', size: 10, type: 'image/gif' })).toMatch(
      /PDF, JPEG, PNG, or WebP/,
    );
    expect(validateDocumentFile({ name: 'receipt.docx', size: 10, type: 'application/pdf' })).toMatch(
      /extension/,
    );
  });

  it('accepts the upload limits and content-type parameters', () => {
    expect(
      validateDocumentFile({
        name: 'receipt.PDF',
        size: MAX_DOCUMENT_SIZE,
        type: 'application/pdf; charset=binary',
      }),
    ).toBeNull();
    expect(
      validateDocumentFile({ name: 'photo.jpeg', size: 1, type: 'image/jpeg' }),
    ).toBeNull();
  });

  it('formats file sizes defensively', () => {
    expect(formatFileSize(512)).toBe('512 B');
    expect(formatFileSize(2048)).toBe('2.0 KB');
    expect(formatFileSize(2 * 1024 * 1024)).toBe('2.0 MB');
    expect(formatFileSize(-1)).toBe('—');
  });
});

describe('structured extraction parsing', () => {
  it('normalizes unknown fields and non-finite or malformed values', () => {
    expect(parseStructuredData('not an object')).toBeNull();
    expect(parseStructuredData(null)).toBeNull();

    const parsed = parseStructuredData({
      documentType: 'RECEIPT',
      totalAmount: 94,
      subtotal: '100',
      vendorName: 42,
      lineItems: [lineItem, null, { description: 42 }, 'bad'],
    });

    expect(parsed?.documentType).toBe('RECEIPT');
    expect(parsed?.totalAmount).toBe(94);
    expect(parsed?.subtotal).toBeNull();
    expect(parsed?.vendorName).toBeNull();
    expect(parsed?.lineItems).toHaveLength(2);
    expect(parsed?.lineItems[1]).toEqual({
      description: null,
      quantity: null,
      unitPrice: null,
      taxRate: null,
      taxAmount: null,
      discountAmount: null,
      lineTotal: null,
    });
  });

  it('converts structured data to and from editable review values', () => {
    const form = structuredToForm(parseStructuredData({ totalAmount: 120, notes: null }));

    expect(form.totalAmount).toBe('120');
    expect(form.notes).toBe('');
    expect(form.vendorName).toBe('');

    expect(
      toReviewedData(
        { ...form, totalAmount: '125', notes: '  Checked  ', vendorName: '  ' },
        [lineItem],
      ),
    ).toMatchObject({
      totalAmount: 125,
      notes: 'Checked',
      vendorName: null,
      lineItems: [lineItem],
    });
  });

  it('validates optional review fields without rejecting blank values', () => {
    expect(validateReviewForm(structuredToForm(null))).toEqual({});

    const errors = validateReviewForm({
      ...structuredToForm(null),
      subtotal: '-1',
      totalAmount: '1.12345',
      invoiceDate: '2026-02-30',
      currency: 'US',
      invoiceNumber: 'x'.repeat(101),
      notes: 'x'.repeat(2001),
    });

    expect(errors.subtotal).toMatch(/Subtotal/);
    expect(errors.totalAmount).toMatch(/Total amount/);
    expect(errors.invoiceDate).toMatch(/valid date/);
    expect(errors.currency).toMatch(/three-letter/);
    expect(errors.invoiceNumber).toMatch(/100/);
    expect(errors.notes).toMatch(/2,000/);
  });

  it('loads reviewed data when present and falls back to AI data', () => {
    const reviewed = { documentType: 'RECEIPT', totalAmount: 125, lineItems: [lineItem] };
    const review = makeReview({ reviewedData: reviewed });

    expect(reviewFormFromReview(review).totalAmount).toBe('125');
    expect(reviewFormFromReview(review).documentType).toBe('RECEIPT');
    expect(lineItemsFromReview(review)).toEqual([lineItem]);
    expect(lineItemsFromReview(makeReview())).toEqual([lineItem]);
    expect(reviewFormFromReview(makeReview()).totalAmount).toBe('120');
  });

  it('formats confidence from fractions or percentages', () => {
    expect(formatConfidence(0.941)).toBe('94.1%');
    expect(formatConfidence(94.1)).toBe('94.1%');
    expect(formatConfidence(null)).toBeNull();
    expect(formatConfidence(Number.NaN)).toBeNull();
  });

  it('only discloses fallback models reported by the backend', () => {
    expect(extractionModelNotice('gpt-4o-mini-fallback')).toMatch(
      /deterministic suggestions/,
    );
    expect(extractionModelNotice('fake-model')).toMatch(/test extraction model/);
    expect(extractionModelNotice('gpt-4o-mini')).toBeNull();
    expect(extractionModelNotice(null)).toBeNull();
  });
});
