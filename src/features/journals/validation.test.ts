import { describe, expect, it } from 'vitest';
import type { JournalEntryRecord } from './types';
import {
  emptyJournalEntryForm,
  hasJournalEntryChanges,
  isValidIsoDate,
  journalEntryToForm,
  parseJournalAmountScaled,
  toCreateJournalEntryInput,
  toUpdateJournalEntryInput,
  validateJournalEntryForm,
} from './validation';

function makeRecord(
  overrides: Partial<JournalEntryRecord> = {},
): JournalEntryRecord {
  return {
    id: 'entry-1',
    organizationId: 'org-1',
    organizationName: 'Analytical Engines',
    entryNumber: 'JE-1001',
    entryDate: '2026-10-25',
    description: 'Monthly accrual',
    reference: 'ACCR-10',
    status: 'DRAFT',
    createdBy: 'user-1',
    createdByEmail: 'ada@example.com',
    createdAt: '2026-10-25T12:00:00Z',
    updatedAt: '2026-10-25T12:00:00Z',
    lines: [
      {
        id: 'line-1',
        accountId: 'account-1',
        accountCode: '1000',
        accountName: 'Cash',
        description: 'Debit line',
        debitAmount: 100,
        creditAmount: 0,
      },
      {
        id: 'line-2',
        accountId: 'account-2',
        accountCode: '4000',
        accountName: 'Revenue',
        description: null,
        debitAmount: 0,
        creditAmount: 100,
      },
    ],
    totalDebits: 100,
    totalCredits: 100,
    ...overrides,
  };
}

function balancedForm() {
  return {
    ...emptyJournalEntryForm,
    entryNumber: 'JE-1001',
    entryDate: '2026-10-25',
    lines: [
      { accountId: 'account-1', description: '', debitAmount: '100.10', creditAmount: '' },
      { accountId: 'account-2', description: '', debitAmount: '', creditAmount: '100.10' },
    ],
  };
}

describe('journal entry validation', () => {
  it('requires header fields and at least one debit and credit line', () => {
    const errors = validateJournalEntryForm(emptyJournalEntryForm);

    expect(errors.entryNumber).toBe('Entry number is required.');
    expect(errors.entryDate).toBe('Entry date is required.');
    expect(errors.lines).toContain('at least one debit and one credit');
    expect(errors.lineErrors?.[0]?.accountId).toBe('Select an account.');
    expect(errors.lineErrors?.[0]?.general).toBe('Enter a debit or credit amount.');
  });

  it('rejects impossible calendar dates', () => {
    expect(isValidIsoDate('2026-02-28')).toBe(true);
    expect(isValidIsoDate('2024-02-29')).toBe(true);
    expect(isValidIsoDate('2026-02-29')).toBe(false);
    expect(isValidIsoDate('2026-04-31')).toBe(false);
    expect(isValidIsoDate('10/25/2026')).toBe(false);

    const errors = validateJournalEntryForm({
      ...balancedForm(),
      entryDate: '2026-02-29',
    });
    expect(errors.entryDate).toBe('Enter a valid entry date (YYYY-MM-DD).');
  });

  it('accepts exact decimal balance without floating point drift', () => {
    const errors = validateJournalEntryForm({
      ...balancedForm(),
      lines: [
        { accountId: 'account-1', description: '', debitAmount: '0.1', creditAmount: '' },
        { accountId: 'account-2', description: '', debitAmount: '0.2', creditAmount: '' },
        { accountId: 'account-3', description: '', debitAmount: '', creditAmount: '0.3' },
      ],
    });

    expect(errors.balance).toBeUndefined();
  });

  it('supports four decimal places and reports imbalance', () => {
    expect(parseJournalAmountScaled('100.1234')).toBe(1001234n);
    expect(parseJournalAmountScaled('100.00001')).toBeNull();
    expect(parseJournalAmountScaled('-1')).toBeNull();

    const errors = validateJournalEntryForm({
      ...balancedForm(),
      lines: [
        { accountId: 'account-1', description: '', debitAmount: '100.1234', creditAmount: '' },
        { accountId: 'account-2', description: '', debitAmount: '', creditAmount: '100.1235' },
      ],
    });

    expect(errors.balance).toBe('Total debits must equal total credits.');
  });

  it('rejects amounts beyond the safe request precision', () => {
    const errors = validateJournalEntryForm({
      ...balancedForm(),
      lines: [
        { accountId: 'account-1', description: '', debitAmount: '900719925474.0992', creditAmount: '' },
        { accountId: 'account-2', description: '', debitAmount: '', creditAmount: '900719925474.0992' },
      ],
    });

    expect(errors.lineErrors?.[0]?.debitAmount).toBe('Debit amount is too large.');
    expect(errors.lineErrors?.[1]?.creditAmount).toBe('Credit amount is too large.');
  });

  it('rejects a line that has both debit and credit', () => {
    const errors = validateJournalEntryForm({
      ...balancedForm(),
      lines: [
        { accountId: 'account-1', description: '', debitAmount: '50', creditAmount: '50' },
        { accountId: 'account-2', description: '', debitAmount: '', creditAmount: '50' },
      ],
    });

    expect(errors.lineErrors?.[0]?.general).toBe(
      'Line must have either debit or credit, not both.',
    );
  });

  it('rejects zero, negative, and non-numeric amounts', () => {
    const errors = validateJournalEntryForm({
      ...balancedForm(),
      lines: [
        { accountId: 'account-1', description: '', debitAmount: '0', creditAmount: '' },
        { accountId: 'account-2', description: '', debitAmount: '-5', creditAmount: '' },
        { accountId: 'account-3', description: '', debitAmount: 'abc', creditAmount: '' },
      ],
    });

    expect(errors.lineErrors?.[0]?.debitAmount).toContain('positive amount');
    expect(errors.lineErrors?.[1]?.debitAmount).toContain('positive amount');
    expect(errors.lineErrors?.[2]?.debitAmount).toContain('positive amount');
  });

  it('reports line-level field errors by index', () => {
    const errors = validateJournalEntryForm({
      ...balancedForm(),
      description: 'D'.repeat(501),
      reference: 'R'.repeat(101),
      lines: [
        {
          accountId: '',
          description: 'L'.repeat(501),
          debitAmount: '10',
          creditAmount: '',
        },
        { accountId: 'account-2', description: '', debitAmount: '', creditAmount: '10' },
      ],
    });

    expect(errors.description).toBe('Description must be at most 500 characters.');
    expect(errors.reference).toBe('Reference must be at most 100 characters.');
    expect(errors.lineErrors?.[0]?.accountId).toBe('Select an account.');
    expect(errors.lineErrors?.[0]?.description).toBe(
      'Line description must be at most 500 characters.',
    );
  });

  it('maps form values to create and update payloads', () => {
    const values = {
      ...balancedForm(),
      entryNumber: '  JE-2002  ',
      description: '  Adjusting entry  ',
      reference: '  ADJ-2  ',
      lines: [
        {
          accountId: 'account-1',
          description: '  Cash  ',
          debitAmount: '100.10',
          creditAmount: '0',
        },
        {
          accountId: 'account-2',
          description: '',
          debitAmount: '',
          creditAmount: '100.10',
        },
      ],
    };

    expect(toCreateJournalEntryInput(values)).toEqual({
      entryNumber: 'JE-2002',
      entryDate: '2026-10-25',
      description: 'Adjusting entry',
      reference: 'ADJ-2',
      lines: [
        {
          accountId: 'account-1',
          description: 'Cash',
          debitAmount: 100.1,
          creditAmount: 0,
        },
        {
          accountId: 'account-2',
          description: '',
          debitAmount: 0,
          creditAmount: 100.1,
        },
      ],
    });

    const record = makeRecord();
    expect(
      toUpdateJournalEntryInput(
        {
          ...journalEntryToForm(record),
          reference: 'ACCR-11',
        },
        record,
      ),
    ).toEqual({ reference: 'ACCR-11' });

    expect(
      toUpdateJournalEntryInput(journalEntryToForm(record), record),
    ).toEqual({});

    const changedLines = journalEntryToForm(record);
    changedLines.lines[0] = {
      ...changedLines.lines[0],
      debitAmount: '125.5',
    };
    changedLines.lines[1] = {
      ...changedLines.lines[1],
      creditAmount: '125.5',
    };

    expect(toUpdateJournalEntryInput(changedLines, record)).toMatchObject({
      lines: [
        { accountId: 'account-1', debitAmount: 125.5, creditAmount: 0 },
        { accountId: 'account-2', debitAmount: 0, creditAmount: 125.5 },
      ],
    });
  });

  it('omits unchanged fields and detects no-op edits', () => {
    const record = makeRecord();
    const values = journalEntryToForm(record);

    expect(hasJournalEntryChanges(values, record)).toBe(false);
    expect(
      hasJournalEntryChanges({ ...values, entryDate: '2026-10-26' }, record),
    ).toBe(true);
    expect(journalEntryToForm(record)).toEqual({
      entryNumber: 'JE-1001',
      entryDate: '2026-10-25',
      description: 'Monthly accrual',
      reference: 'ACCR-10',
      lines: [
        {
          accountId: 'account-1',
          description: 'Debit line',
          debitAmount: '100',
          creditAmount: '',
        },
        {
          accountId: 'account-2',
          description: '',
          debitAmount: '',
          creditAmount: '100',
        },
      ],
    });
  });

  it('counts totals using integer scaled values', () => {
    const errors = validateJournalEntryForm({
      ...balancedForm(),
      lines: [
        { accountId: 'account-1', description: '', debitAmount: '999999999999999.9999', creditAmount: '' },
        { accountId: 'account-2', description: '', debitAmount: '', creditAmount: '999999999999999.9999' },
      ],
    });

    expect(errors.lineErrors?.[0]?.debitAmount).toBe('Debit amount is too large.');
  });
});
