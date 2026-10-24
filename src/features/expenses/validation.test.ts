import { describe, expect, it } from 'vitest';
import type { ExpenseRecord } from './types';
import {
  emptyExpenseForm,
  expenseToForm,
  toCreateExpenseInput,
  toUpdateExpenseInput,
  validateExpenseForm,
} from './validation';

const baseExpense: ExpenseRecord = {
  id: 'expense-1',
  organizationId: 'org-1',
  organizationName: 'Org',
  vendorId: null,
  vendorName: null,
  expenseAccountId: 'expense-account',
  expenseAccountCode: '5000',
  expenseAccountName: 'Software',
  paymentAccountId: 'payment-account',
  paymentAccountCode: '1000',
  paymentAccountName: 'Cash',
  amount: 100,
  expenseDate: '2026-10-05',
  description: 'Original',
  reference: 'REF-1',
  status: 'DRAFT',
  journalEntryId: null,
  createdBy: 'user-1',
  createdByEmail: 'user@example.com',
  createdAt: '2026-10-05T00:00:00Z',
  updatedAt: '2026-10-05T00:00:00Z',
};

function validForm() {
  return {
    ...emptyExpenseForm(),
    vendorId: '',
    expenseAccountId: 'expense-account',
    paymentAccountId: 'payment-account',
    amount: '42.50',
    expenseDate: '2026-10-05',
    description: 'Subscription',
    reference: 'REF-NEW',
  };
}

describe('expense validation', () => {
  it('requires positive amounts, distinct accounts, and a valid date', () => {
    const errors = validateExpenseForm(
      {
        ...emptyExpenseForm(),
        amount: '0',
        expenseAccountId: 'same',
        paymentAccountId: 'same',
        expenseDate: '2026-02-30',
      },
    );

    expect(errors.amount).toMatch(/greater than 0/);
    expect(errors.paymentAccountId).toMatch(/must differ/);
    expect(errors.expenseDate).toMatch(/valid expense date/);
  });

  it('accepts a complete form and up to four decimal places', () => {
    expect(validateExpenseForm(validForm())).toEqual({});
    expect(
      validateExpenseForm({ ...validForm(), amount: '999999.1234' }),
    ).toEqual({});
    expect(
      validateExpenseForm({ ...validForm(), amount: '1.12345' }).amount,
    ).toMatch(/4 decimal places/);
  });

  it('prevents clearing a saved vendor and limits text lengths', () => {
    const errors = validateExpenseForm(
      {
        ...validForm(),
        vendorId: '',
        description: 'a'.repeat(501),
        reference: 'b'.repeat(101),
      },
      { existingVendorId: 'vendor-1' },
    );

    expect(errors.vendorId).toMatch(/cannot be removed/);
    expect(errors.description).toMatch(/500/);
    expect(errors.reference).toMatch(/100/);
  });

  it('maps form values to create and diff-only update payloads', () => {
    expect(toCreateExpenseInput(validForm())).toEqual({
      expenseAccountId: 'expense-account',
      paymentAccountId: 'payment-account',
      amount: 42.5,
      expenseDate: '2026-10-05',
      description: 'Subscription',
      reference: 'REF-NEW',
    });

    const unchanged = expenseToForm(baseExpense);
    expect(toUpdateExpenseInput(unchanged, baseExpense)).toEqual({});

    const changed = {
      ...unchanged,
      amount: '125',
      description: '',
      reference: 'REF-2',
    };
    expect(toUpdateExpenseInput(changed, baseExpense)).toEqual({
      amount: 125,
      description: '',
      reference: 'REF-2',
    });
  });

  it('does not send an unchanged or inactive existing vendor', () => {
    const expense = { ...baseExpense, vendorId: 'vendor-1', vendorName: 'Vendor' };
    const form = expenseToForm(expense);

    expect(toUpdateExpenseInput(form, expense)).toEqual({});
  });
});
