import { describe, expect, it } from 'vitest';
import { ApiError } from 'src/lib/api/client';
import { getInvoiceErrorMessage, invoiceFieldErrors } from './errors';

function apiError(status: number, message: string, fieldErrors?: Record<string, string>) {
  return new ApiError(message, {
    kind: 'http',
    status,
    statusText: '',
    fieldErrors,
  });
}

describe('invoice errors', () => {
  it('normalizes nested line field errors', () => {
    expect(
      invoiceFieldErrors(
        apiError(400, 'Validation failed', {
          'lines[0].quantity': 'quantity must be greater than 0',
        }),
      ),
    ).toEqual({
      'lines.0.quantity': 'quantity must be greater than 0',
    });
  });

  it('explains duplicate invoice numbers', () => {
    expect(
      getInvoiceErrorMessage(
        apiError(409, 'Invoice already exists with invoiceNumber: INV-1'),
        'create',
      ),
    ).toBe(
      'An invoice with this number already exists. Use a different invoice number.',
    );
  });

  it('keeps status transition details from the server', () => {
    expect(
      getInvoiceErrorMessage(
        apiError(409, 'Only DRAFT invoices can be issued. Current: ISSUED'),
        'issue',
      ),
    ).toBe('Only DRAFT invoices can be issued. Current: ISSUED');
  });

  it('returns a generic message for unknown errors', () => {
    expect(getInvoiceErrorMessage(new Error('boom'), 'void')).toBe(
      'Unable to void this invoice. Please try again.',
    );
  });
});
