import type {
  CreateJournalEntryInput,
  JournalEntryFormValues,
  JournalEntryLineFormValues,
  JournalEntryLineInput,
  JournalEntryRecord,
  UpdateJournalEntryInput,
} from './types';

export const emptyJournalEntryLine: JournalEntryLineFormValues = {
  accountId: '',
  description: '',
  debitAmount: '',
  creditAmount: '',
};

export const emptyJournalEntryForm: JournalEntryFormValues = {
  entryNumber: '',
  entryDate: '',
  description: '',
  reference: '',
  lines: [emptyJournalEntryLine, { ...emptyJournalEntryLine }],
};

const DECIMAL_RE = /^\d{1,15}(\.\d{1,4})?$/;
const MAX_SAFE_SCALED = BigInt(Number.MAX_SAFE_INTEGER);

export interface JournalEntryLineErrors {
  accountId?: string;
  description?: string;
  debitAmount?: string;
  creditAmount?: string;
  general?: string;
}

export interface JournalEntryFormErrors {
  entryNumber?: string;
  entryDate?: string;
  description?: string;
  reference?: string;
  lines?: string;
  lineErrors?: JournalEntryLineErrors[];
  balance?: string;
}

export function parseJournalAmountScaled(value: string): bigint | null {
  const trimmed = value.trim();
  if (!DECIMAL_RE.test(trimmed)) return null;

  const [whole, fraction = ''] = trimmed.split('.');
  const paddedFraction = (fraction + '0000').slice(0, 4);
  return BigInt(whole) * 10000n + BigInt(paddedFraction);
}

export function isValidIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function addLineError(
  lineErrors: JournalEntryLineErrors,
  field: keyof JournalEntryLineErrors,
  message: string,
) {
  lineErrors[field] = lineErrors[field]
    ? `${lineErrors[field]} ${message}`
    : message;
}

export function validateJournalEntryForm(
  values: JournalEntryFormValues,
): JournalEntryFormErrors {
  const errors: JournalEntryFormErrors = {};

  if (!values.entryNumber.trim()) errors.entryNumber = 'Entry number is required.';
  else if (values.entryNumber.trim().length > 50)
    errors.entryNumber = 'Entry number must be at most 50 characters.';

  if (!values.entryDate.trim()) errors.entryDate = 'Entry date is required.';
  else if (!isValidIsoDate(values.entryDate.trim()))
    errors.entryDate = 'Enter a valid entry date (YYYY-MM-DD).';

  if (values.description.trim().length > 500)
    errors.description = 'Description must be at most 500 characters.';

  if (values.reference.trim().length > 100)
    errors.reference = 'Reference must be at most 100 characters.';

  if (!Array.isArray(values.lines) || values.lines.length < 2) {
    errors.lines = 'Journal entry must have at least 2 lines.';
  }

  let hasDebit = false;
  let hasCredit = false;
  let totalDebitScaled = 0n;
  let totalCreditScaled = 0n;
  const lineErrors: JournalEntryLineErrors[] = [];

  values.lines.forEach((line, index) => {
    const entry: JournalEntryLineErrors = {};
    lineErrors[index] = entry;

    if (!line.accountId) entry.accountId = 'Select an account.';

    if (line.description.trim().length > 500) {
      entry.description = 'Line description must be at most 500 characters.';
    }

    const debit = line.debitAmount.trim();
    const credit = line.creditAmount.trim();
    let debitScaled: bigint | null = null;
    let creditScaled: bigint | null = null;
    let hasDebitLine = false;
    let hasCreditLine = false;

    if (debit) {
      debitScaled = parseJournalAmountScaled(debit);
      if (debitScaled === null || debitScaled <= 0n) {
        addLineError(
          entry,
          'debitAmount',
          'Debit must be a positive amount with up to 4 decimals.',
        );
      } else if (debitScaled > MAX_SAFE_SCALED) {
        addLineError(entry, 'debitAmount', 'Debit amount is too large.');
      } else {
        hasDebitLine = true;
      }
    }

    if (credit) {
      creditScaled = parseJournalAmountScaled(credit);
      if (creditScaled === null || creditScaled <= 0n) {
        addLineError(
          entry,
          'creditAmount',
          'Credit must be a positive amount with up to 4 decimals.',
        );
      } else if (creditScaled > MAX_SAFE_SCALED) {
        addLineError(entry, 'creditAmount', 'Credit amount is too large.');
      } else {
        hasCreditLine = true;
      }
    }

    if (debit && credit) {
      addLineError(
        entry,
        'general',
        'Line must have either debit or credit, not both.',
      );
      hasDebitLine = false;
      hasCreditLine = false;
    } else if (!debit && !credit) {
      addLineError(entry, 'general', 'Enter a debit or credit amount.');
    }

    if (hasDebitLine) {
      hasDebit = true;
      totalDebitScaled += debitScaled ?? 0n;
    }
    if (hasCreditLine) {
      hasCredit = true;
      totalCreditScaled += creditScaled ?? 0n;
    }
  });

  if (lineErrors.every((line) => Object.keys(line).length === 0)) {
    delete errors.lineErrors;
  } else {
    errors.lineErrors = lineErrors;
  }

  if (!hasDebit || !hasCredit) {
    errors.lines = errors.lines
      ? `${errors.lines} Entry must include at least one debit and one credit line.`
      : 'Entry must include at least one debit and one credit line.';
  }

  if (totalDebitScaled !== totalCreditScaled) {
    errors.balance = 'Total debits must equal total credits.';
  }

  return errors;
}

export function hasJournalEntryFormErrors(errors: JournalEntryFormErrors): boolean {
  return Object.keys(errors).length > 0;
}

function amountToNumber(value: string): number {
  const trimmed = value.trim();
  return trimmed ? Number(trimmed) : 0;
}

export function toCreateJournalEntryInput(
  values: JournalEntryFormValues,
): CreateJournalEntryInput {
  return {
    entryNumber: values.entryNumber.trim(),
    entryDate: values.entryDate.trim(),
    description: values.description.trim(),
    reference: values.reference.trim(),
    lines: values.lines.map((line) => ({
      accountId: line.accountId,
      description: line.description.trim(),
      debitAmount: amountToNumber(line.debitAmount),
      creditAmount: amountToNumber(line.creditAmount),
    })),
  };
}

export function journalEntryToForm(record: JournalEntryRecord): JournalEntryFormValues {
  return {
    entryNumber: record.entryNumber,
    entryDate: record.entryDate,
    description: record.description ?? '',
    reference: record.reference ?? '',
    lines: record.lines.map((line) => ({
      accountId: line.accountId,
      description: line.description ?? '',
      debitAmount:
        line.debitAmount && line.debitAmount > 0
          ? String(line.debitAmount)
          : '',
      creditAmount:
        line.creditAmount && line.creditAmount > 0
          ? String(line.creditAmount)
          : '',
    })),
  };
}

export function toUpdateJournalEntryInput(
  values: JournalEntryFormValues,
  record: JournalEntryRecord,
): UpdateJournalEntryInput {
  const input: UpdateJournalEntryInput = {};
  if (values.entryNumber.trim() !== record.entryNumber)
    input.entryNumber = values.entryNumber.trim();
  if (values.entryDate.trim() !== record.entryDate)
    input.entryDate = values.entryDate.trim();
  if (values.description.trim() !== (record.description ?? ''))
    input.description = values.description.trim();
  if (values.reference.trim() !== (record.reference ?? ''))
    input.reference = values.reference.trim();

  const newLines: JournalEntryLineInput[] = values.lines.map((line) => ({
    accountId: line.accountId,
    description: line.description.trim(),
    debitAmount: amountToNumber(line.debitAmount),
    creditAmount: amountToNumber(line.creditAmount),
  }));

  const sameLines =
    newLines.length === record.lines.length &&
    newLines.every((line, index) => {
      const current = record.lines[index];
      return (
        line.accountId === current.accountId &&
        line.description === (current.description ?? '') &&
        line.debitAmount === current.debitAmount &&
        line.creditAmount === current.creditAmount
      );
    });

  if (!sameLines) input.lines = newLines;
  return input;
}

export function hasJournalEntryChanges(
  values: JournalEntryFormValues,
  record: JournalEntryRecord,
): boolean {
  return Object.keys(toUpdateJournalEntryInput(values, record)).length > 0;
}
