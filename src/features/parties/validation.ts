import type { PartyFormValues, PartyInput } from './types';

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const emptyPartyForm: PartyFormValues = {
  name: '',
  email: '',
  phone: '',
  address: '',
  taxIdentifier: '',
  paymentTerms: '',
};

export function valuesFromRecord(record: {
  name: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  taxIdentifier: string | null;
  paymentTerms: string | null;
}): PartyFormValues {
  return {
    name: record.name,
    email: record.email ?? '',
    phone: record.phone ?? '',
    address: record.address ?? '',
    taxIdentifier: record.taxIdentifier ?? '',
    paymentTerms: record.paymentTerms ?? '',
  };
}

export function toPartyInput(values: PartyFormValues): PartyInput {
  return {
    name: values.name.trim(),
    email: values.email.trim(),
    phone: values.phone.trim(),
    address: values.address.trim(),
    taxIdentifier: values.taxIdentifier.trim(),
    paymentTerms: values.paymentTerms.trim(),
  };
}

export function validatePartyForm(values: PartyFormValues): Record<string, string> {
  const errors: Record<string, string> = {};
  const name = values.name.trim();
  const email = values.email.trim();

  if (!name) errors.name = 'Name is required.';
  else if (name.length > 255) errors.name = 'Name must be at most 255 characters.';

  if (email.length > 255) errors.email = 'Email must be at most 255 characters.';
  else if (email && !emailPattern.test(email)) errors.email = 'Enter a valid email address.';

  if (values.phone.trim().length > 50) {
    errors.phone = 'Phone must be at most 50 characters.';
  }

  if (values.address.trim().length > 500) {
    errors.address = 'Address must be at most 500 characters.';
  }

  if (values.taxIdentifier.trim().length > 100) {
    errors.taxIdentifier = 'Tax identifier must be at most 100 characters.';
  }

  if (values.paymentTerms.trim().length > 100) {
    errors.paymentTerms = 'Payment terms must be at most 100 characters.';
  }

  return errors;
}
