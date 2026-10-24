import type {
  CreateExpenseInput,
  ExpenseFormValues,
  ExpenseRecord,
  UpdateExpenseInput,
} from './types';

export const EXPENSE_DESCRIPTION_MAX = 500;
export const EXPENSE_REFERENCE_MAX = 100;
export const EXPENSE_AMOUNT_MAX = 999_999_999_999.9999;

export type ExpenseFormErrors = Partial<Record<keyof ExpenseFormValues, string>>;

export function todayLocalDate() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function emptyExpenseForm(): ExpenseFormValues {
  return {
    vendorId: '',
    expenseAccountId: '',
    paymentAccountId: '',
    amount: '',
    expenseDate: todayLocalDate(),
    description: '',
    reference: '',
  };
}

export function expenseToForm(expense: ExpenseRecord): ExpenseFormValues {
  return {
    vendorId: expense.vendorId ?? '',
    expenseAccountId: expense.expenseAccountId,
    paymentAccountId: expense.paymentAccountId,
    amount: String(expense.amount),
    expenseDate: expense.expenseDate,
    description: expense.description ?? '',
    reference: expense.reference ?? '',
  };
}

function isRealIsoDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

export function validateExpenseForm(
  values: ExpenseFormValues,
  options: { existingVendorId?: string | null } = {},
) {
  const errors: ExpenseFormErrors = {};
  const amount = Number(values.amount);

  if (!values.amount.trim()) {
    errors.amount = 'Enter an amount.';
  } else if (!/^\d+(\.\d{1,4})?$/.test(values.amount.trim())) {
    errors.amount = 'Enter a positive amount with up to 4 decimal places.';
  } else if (!Number.isFinite(amount) || amount <= 0) {
    errors.amount = 'Amount must be greater than 0.';
  } else if (amount > EXPENSE_AMOUNT_MAX) {
    errors.amount = 'Amount is too large.';
  }

  if (!values.expenseDate) {
    errors.expenseDate = 'Choose an expense date.';
  } else if (!isRealIsoDate(values.expenseDate)) {
    errors.expenseDate = 'Enter a valid expense date.';
  }

  if (!values.expenseAccountId) {
    errors.expenseAccountId = 'Choose an expense account.';
  }

  if (!values.paymentAccountId) {
    errors.paymentAccountId = 'Choose a payment account.';
  } else if (
    values.expenseAccountId &&
    values.expenseAccountId === values.paymentAccountId
  ) {
    errors.paymentAccountId = 'Payment account must differ from the expense account.';
  }

  if (values.description.trim().length > EXPENSE_DESCRIPTION_MAX) {
    errors.description = `Description must be ${EXPENSE_DESCRIPTION_MAX} characters or fewer.`;
  }

  if (values.reference.trim().length > EXPENSE_REFERENCE_MAX) {
    errors.reference = `Reference must be ${EXPENSE_REFERENCE_MAX} characters or fewer.`;
  }

  if (options.existingVendorId && !values.vendorId) {
    errors.vendorId = 'A saved vendor cannot be removed from an expense.';
  }

  return errors;
}

export function isExpenseFormValid(errors: ExpenseFormErrors) {
  return Object.keys(errors).length === 0;
}

function baseInput(values: ExpenseFormValues) {
  return {
    expenseAccountId: values.expenseAccountId,
    paymentAccountId: values.paymentAccountId,
    amount: Number(values.amount),
    expenseDate: values.expenseDate,
    description: values.description.trim(),
    reference: values.reference.trim(),
  };
}

export function toCreateExpenseInput(values: ExpenseFormValues): CreateExpenseInput {
  return {
    ...baseInput(values),
    ...(values.vendorId ? { vendorId: values.vendorId } : {}),
  };
}

export function toUpdateExpenseInput(
  values: ExpenseFormValues,
  expense: ExpenseRecord,
): UpdateExpenseInput {
  const input: UpdateExpenseInput = {};

  if (values.expenseAccountId !== expense.expenseAccountId) {
    input.expenseAccountId = values.expenseAccountId;
  }
  if (values.paymentAccountId !== expense.paymentAccountId) {
    input.paymentAccountId = values.paymentAccountId;
  }
  if (Number(values.amount) !== expense.amount) {
    input.amount = Number(values.amount);
  }
  if (values.expenseDate !== expense.expenseDate) {
    input.expenseDate = values.expenseDate;
  }
  if (values.description.trim() !== (expense.description ?? '')) {
    input.description = values.description.trim();
  }
  if (values.reference.trim() !== (expense.reference ?? '')) {
    input.reference = values.reference.trim();
  }
  if (values.vendorId && values.vendorId !== (expense.vendorId ?? '')) {
    input.vendorId = values.vendorId;
  }

  return input;
}
