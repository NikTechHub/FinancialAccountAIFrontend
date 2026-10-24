import { describe, expect, it } from 'vitest';
import type { InvoiceFormValues, InvoiceRecord } from './types';
import {
  calculateInvoicePreview,
  emptyInvoiceForm,
  invoiceToForm,
  linePreview,
  toCreateInvoiceInput,
  toUpdateInvoiceInput,
  validateInvoiceForm,
} from './validation';

const accountId = '66666666-6666-6666-6666-666666666666';
const customerId = '77777777-7777-7777-7777-777777777777';

function completeForm(overrides: Partial<InvoiceFormValues> = {}): InvoiceFormValues {
  return {
    ...emptyInvoiceForm(),
    customerId,
    invoiceNumber: ' INV-1001 ',
    invoiceDate: '2026-10-05',
    lines: [
      {
        description: ' Consulting ',
        quantity: '2',
        unitPrice: '50',
        taxRate: '10',
        discountAmount: '5',
        revenueAccountId: accountId,
      },
    ],
    ...overrides,
  };
}

function makeRecord(overrides: Partial<InvoiceRecord> = {}): InvoiceRecord {
  return {
    id: '55555555-5555-5555-5555-555555555555',
    organizationId: '22222222-2222-2222-2222-222222222222',
    organizationName: 'Analytical Engines',
    customerId,
    customerName: 'Acme Customer',
    invoiceNumber: 'INV-1001',
    invoiceDate: '2026-10-05',
    dueDate: '2026-11-04',
    status: 'DRAFT',
    subtotal: 100,
    taxAmount: 9.5,
    discountAmount: 5,
    totalAmount: 104.5,
    amountPaid: 0,
    balanceDue: 104.5,
    notes: 'Thanks',
    terms: 'Net 30',
    journalEntryId: null,
    createdBy: '11111111-1111-1111-1111-111111111111',
    createdByEmail: 'ada@example.com',
    createdAt: '2026-10-05T12:00:00Z',
    updatedAt: '2026-10-05T12:00:00Z',
    lines: [
      {
        id: '88888888-8888-8888-8888-888888888888',
        description: 'Consulting',
        quantity: 2,
        unitPrice: 50,
        taxRate: 10,
        discountAmount: 5,
        revenueAccountId: accountId,
        revenueAccountCode: '4000',
        revenueAccountName: 'Consulting Revenue',
        lineSubtotal: 100,
        lineTaxAmount: 9.5,
        lineTotal: 104.5,
      },
    ],
    ...overrides,
  };
}

describe('invoice validation and mapping', () => {
  it('calculates rounded line and invoice totals', () => {
    const line = completeForm().lines[0];
    expect(linePreview(line)).toEqual({
      lineSubtotal: 100,
      lineTaxAmount: 9.5,
      lineTotal: 104.5,
    });
    expect(calculateInvoicePreview([line])).toEqual({
      subtotal: 100,
      taxAmount: 9.5,
      discountAmount: 5,
      totalAmount: 104.5,
    });
  });

  it('reports required fields and line errors', () => {
    const errors = validateInvoiceForm(emptyInvoiceForm(), {
      activeRevenueAccountIds: [accountId],
    });

    expect(errors.customerId).toBe('Choose a customer.');
    expect(errors.invoiceNumber).toBe('Enter an invoice number.');
    expect(errors.invoiceDate).toBeUndefined();
    expect(errors['lines.0.unitPrice']).toBe('Enter a unit price.');
    expect(errors['lines.0.revenueAccountId']).toBe(
      'Choose a revenue account.',
    );
  });

  it('rejects discounts above the line subtotal', () => {
    const form = completeForm();
    form.lines[0].discountAmount = '101';

    expect(validateInvoiceForm(form, {
      activeRevenueAccountIds: [accountId],
    })['lines.0.discountAmount']).toBe(
      'Discount cannot exceed the line subtotal.',
    );
  });

  it('rejects clearing an existing due date and inactive revenue accounts', () => {
    const form = completeForm({ dueDate: '' });
    const errors = validateInvoiceForm(form, {
      existingDueDate: '2026-11-04',
      activeRevenueAccountIds: [],
    });

    expect(errors.dueDate).toContain('cannot be cleared');
    expect(errors['lines.0.revenueAccountId']).toBe(
      'Choose an active revenue account.',
    );
  });

  it('maps form values to trimmed create and update payloads', () => {
    const form = completeForm();

    expect(toCreateInvoiceInput(form)).toEqual({
      customerId,
      invoiceNumber: 'INV-1001',
      invoiceDate: '2026-10-05',
      notes: '',
      terms: '',
      lines: [
        {
          description: 'Consulting',
          quantity: 2,
          unitPrice: 50,
          taxRate: 10,
          discountAmount: 5,
          revenueAccountId: accountId,
        },
      ],
    });
    expect(toUpdateInvoiceInput(form).dueDate).toBeUndefined();
  });

  it('maps an invoice record into editable string values', () => {
    expect(invoiceToForm(makeRecord())).toMatchObject({
      customerId,
      invoiceNumber: 'INV-1001',
      dueDate: '2026-11-04',
      lines: [
        {
          quantity: '2',
          unitPrice: '50',
          taxRate: '10',
          discountAmount: '5',
          revenueAccountId: accountId,
        },
      ],
    });
  });
});
