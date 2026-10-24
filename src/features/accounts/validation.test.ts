import { describe, expect, it } from 'vitest';
import type { AccountRecord } from './types';
import {
  emptyAccountForm,
  toCreateAccountInput,
  toUpdateAccountInput,
  validateAccountForm,
  valuesFromAccount,
} from './validation';

function makeAccount(overrides: Partial<AccountRecord> = {}): AccountRecord {
  return {
    id: 'account-1',
    organizationId: 'org-1',
    organizationName: 'Analytical Engines',
    code: '1000',
    name: 'Cash',
    type: 'ASSET',
    parentAccountId: null,
    parentAccountName: null,
    description: null,
    active: true,
    systemAccount: false,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

describe('account validation', () => {
  it('requires code, name, and type', () => {
    expect(validateAccountForm(emptyAccountForm)).toEqual({
      code: 'Account code is required.',
      name: 'Account name is required.',
      type: 'Select an account type.',
    });
  });

  it('matches backend length limits', () => {
    expect(
      validateAccountForm({
        ...emptyAccountForm,
        code: 'A'.repeat(21),
        name: 'N'.repeat(256),
        type: 'ASSET',
        description: 'D'.repeat(501),
      }),
    ).toEqual({
      code: 'Account code must be at most 20 characters.',
      name: 'Account name must be at most 255 characters.',
      description: 'Description must be at most 500 characters.',
    });
  });

  it('trims values and includes an optional parent on create', () => {
    const input = toCreateAccountInput({
      code: '  1100  ',
      name: '  Accounts Receivable  ',
      type: 'ASSET',
      parentAccountId: 'parent-1',
      description: '  Trade receivables  ',
    });

    expect(input).toEqual({
      code: '1100',
      name: 'Accounts Receivable',
      type: 'ASSET',
      parentAccountId: 'parent-1',
      description: 'Trade receivables',
    });
  });

  it('omits an empty parent when creating an account', () => {
    const input = toCreateAccountInput({
      code: '4000',
      name: 'Revenue',
      type: 'REVENUE',
      parentAccountId: '',
      description: '',
    });

    expect(input).not.toHaveProperty('parentAccountId');
  });

  it('omits an unchanged parent when updating an account', () => {
    const record = makeAccount({
      parentAccountId: 'parent-1',
      parentAccountName: 'Current Assets',
    });

    const input = toUpdateAccountInput(
      {
        code: '1000',
        name: 'Cash on hand',
        type: 'ASSET',
        parentAccountId: 'parent-1',
        description: 'Updated',
      },
      record,
    );

    expect(input).toEqual({
      code: '1000',
      name: 'Cash on hand',
      type: 'ASSET',
      description: 'Updated',
    });
  });

  it('includes a changed parent when updating an account', () => {
    const record = makeAccount();

    const input = toUpdateAccountInput(
      {
        code: '1000',
        name: 'Cash',
        type: 'ASSET',
        parentAccountId: 'parent-2',
        description: '',
      },
      record,
    );

    expect(input.parentAccountId).toBe('parent-2');
  });

  it('maps nullable record fields into editable values', () => {
    expect(valuesFromAccount(makeAccount())).toEqual({
      code: '1000',
      name: 'Cash',
      type: 'ASSET',
      parentAccountId: '',
      description: '',
    });
  });
});
