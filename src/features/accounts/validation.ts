import type {
  AccountFormValues,
  AccountRecord,
  AccountType,
  CreateAccountInput,
  UpdateAccountInput,
} from './types';

export const emptyAccountForm: AccountFormValues = {
  code: '',
  name: '',
  type: '',
  parentAccountId: '',
  description: '',
};

export function valuesFromAccount(record: AccountRecord): AccountFormValues {
  return {
    code: record.code,
    name: record.name,
    type: record.type,
    parentAccountId: record.parentAccountId ?? '',
    description: record.description ?? '',
  };
}

export function validateAccountForm(
  values: AccountFormValues,
): Record<string, string> {
  const errors: Record<string, string> = {};
  const code = values.code.trim();
  const name = values.name.trim();

  if (!code) errors.code = 'Account code is required.';
  else if (code.length > 20) {
    errors.code = 'Account code must be at most 20 characters.';
  }

  if (!name) errors.name = 'Account name is required.';
  else if (name.length > 255) {
    errors.name = 'Account name must be at most 255 characters.';
  }

  if (!values.type) errors.type = 'Select an account type.';

  if (values.description.trim().length > 500) {
    errors.description = 'Description must be at most 500 characters.';
  }

  return errors;
}

export function toCreateAccountInput(
  values: AccountFormValues,
): CreateAccountInput {
  const input: CreateAccountInput = {
    code: values.code.trim(),
    name: values.name.trim(),
    type: values.type as AccountType,
    description: values.description.trim(),
  };

  if (values.parentAccountId) {
    input.parentAccountId = values.parentAccountId;
  }

  return input;
}

export function toUpdateAccountInput(
  values: AccountFormValues,
  record: AccountRecord,
): UpdateAccountInput {
  const input: UpdateAccountInput = {
    code: values.code.trim(),
    name: values.name.trim(),
    type: values.type as AccountType,
    description: values.description.trim(),
  };

  if (
    values.parentAccountId &&
    values.parentAccountId !== (record.parentAccountId ?? '')
  ) {
    input.parentAccountId = values.parentAccountId;
  }

  return input;
}
