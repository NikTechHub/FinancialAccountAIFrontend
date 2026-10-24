import type {
  CreateInvoiceInput,
  InvoiceFormValues,
  InvoiceLineFormValues,
  InvoiceLineInput,
  InvoicePreview,
  InvoiceRecord,
  UpdateInvoiceInput,
} from './types';

export const INVOICE_NUMBER_MAX = 50;
export const INVOICE_NOTES_MAX = 1000;
export const INVOICE_TERMS_MAX = 1000;
export const INVOICE_DESCRIPTION_MAX = 500;
export const INVOICE_AMOUNT_MAX = 999_999_999_999.9999;

export type InvoiceFormErrors = Record<string, string>;

function roundAmount(value: number) {
  return Math.round((value + Number.EPSILON) * 10_000) / 10_000;
}

export function todayLocalDate() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
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

export function emptyInvoiceLine(): InvoiceLineFormValues {
  return {
    description: '',
    quantity: '1',
    unitPrice: '',
    taxRate: '0',
    discountAmount: '0',
    revenueAccountId: '',
  };
}

export function emptyInvoiceForm(): InvoiceFormValues {
  return {
    customerId: '',
    invoiceNumber: '',
    invoiceDate: todayLocalDate(),
    dueDate: '',
    notes: '',
    terms: '',
    lines: [emptyInvoiceLine()],
  };
}

export function invoiceToForm(invoice: InvoiceRecord): InvoiceFormValues {
  return {
    customerId: invoice.customerId,
    invoiceNumber: invoice.invoiceNumber,
    invoiceDate: invoice.invoiceDate,
    dueDate: invoice.dueDate ?? '',
    notes: invoice.notes ?? '',
    terms: invoice.terms ?? '',
    lines: invoice.lines.map((line) => ({
      description: line.description ?? '',
      quantity: String(line.quantity),
      unitPrice: String(line.unitPrice),
      taxRate: String(line.taxRate),
      discountAmount: String(line.discountAmount),
      revenueAccountId: line.revenueAccountId,
    })),
  };
}

function decimalValue(value: string) {
  if (!/^\d+(\.\d{1,4})?$/.test(value.trim())) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function validateDecimal(
  value: string,
  options: {
    label: string;
    blankMessage: string;
    allowZero: boolean;
    max?: number;
  },
) {
  if (!value.trim()) return options.blankMessage;
  const parsed = decimalValue(value);
  if (parsed === null) {
    return `${options.label} must be a number with up to 4 decimal places.`;
  }
  if (!options.allowZero && parsed <= 0) {
    return `${options.label} must be greater than 0.`;
  }
  if (options.allowZero && parsed < 0) {
    return `${options.label} cannot be negative.`;
  }
  if (options.max !== undefined && parsed > options.max) {
    return `${options.label} is too large.`;
  }
  return null;
}

export function linePreview(line: InvoiceLineFormValues) {
  const quantity = decimalValue(line.quantity) ?? 0;
  const unitPrice = decimalValue(line.unitPrice) ?? 0;
  const discountAmount = decimalValue(line.discountAmount) ?? 0;
  const taxRate = decimalValue(line.taxRate) ?? 0;

  const lineSubtotal = roundAmount(quantity * unitPrice);
  const taxable = roundAmount(lineSubtotal - discountAmount);
  const lineTaxAmount = roundAmount((taxable * taxRate) / 100);
  const lineTotal = roundAmount(taxable + lineTaxAmount);

  return { lineSubtotal, lineTaxAmount, lineTotal };
}

export function calculateInvoicePreview(lines: InvoiceLineFormValues[]): InvoicePreview {
  return lines.reduce<InvoicePreview>(
    (totals, line) => {
      const preview = linePreview(line);
      return {
        subtotal: roundAmount(totals.subtotal + preview.lineSubtotal),
        taxAmount: roundAmount(totals.taxAmount + preview.lineTaxAmount),
        discountAmount:
          totals.discountAmount + (decimalValue(line.discountAmount) ?? 0),
        totalAmount: roundAmount(totals.totalAmount + preview.lineTotal),
      };
    },
    { subtotal: 0, taxAmount: 0, discountAmount: 0, totalAmount: 0 },
  );
}

export function validateInvoiceForm(
  values: InvoiceFormValues,
  options: {
    existingDueDate?: string | null;
    activeRevenueAccountIds?: readonly string[];
  } = {},
) {
  const errors: InvoiceFormErrors = {};

  if (!values.customerId) {
    errors.customerId = 'Choose a customer.';
  }

  const invoiceNumber = values.invoiceNumber.trim();
  if (!invoiceNumber) {
    errors.invoiceNumber = 'Enter an invoice number.';
  } else if (invoiceNumber.length > INVOICE_NUMBER_MAX) {
    errors.invoiceNumber = `Invoice number must be ${INVOICE_NUMBER_MAX} characters or fewer.`;
  }

  if (!values.invoiceDate) {
    errors.invoiceDate = 'Choose an invoice date.';
  } else if (!isRealIsoDate(values.invoiceDate)) {
    errors.invoiceDate = 'Enter a valid invoice date.';
  }

  if (values.dueDate && !isRealIsoDate(values.dueDate)) {
    errors.dueDate = 'Enter a valid due date.';
  } else if (options.existingDueDate && !values.dueDate) {
    errors.dueDate =
      'An existing due date cannot be cleared. Choose a new date or keep the current one.';
  }

  if (values.notes.trim().length > INVOICE_NOTES_MAX) {
    errors.notes = `Notes must be ${INVOICE_NOTES_MAX} characters or fewer.`;
  }

  if (values.terms.trim().length > INVOICE_TERMS_MAX) {
    errors.terms = `Terms must be ${INVOICE_TERMS_MAX} characters or fewer.`;
  }

  if (values.lines.length === 0) {
    errors.lines = 'Add at least one line item.';
  }

  values.lines.forEach((line, index) => {
    const prefix = `lines.${index}`;
    const quantityError = validateDecimal(line.quantity, {
      label: 'Quantity',
      blankMessage: 'Enter a quantity.',
      allowZero: false,
      max: INVOICE_AMOUNT_MAX,
    });
    if (quantityError) errors[`${prefix}.quantity`] = quantityError;

    const unitPriceError = validateDecimal(line.unitPrice, {
      label: 'Unit price',
      blankMessage: 'Enter a unit price.',
      allowZero: true,
      max: INVOICE_AMOUNT_MAX,
    });
    if (unitPriceError) errors[`${prefix}.unitPrice`] = unitPriceError;

    const taxRateError = validateDecimal(line.taxRate, {
      label: 'Tax rate',
      blankMessage: 'Enter a tax rate.',
      allowZero: true,
      max: 100,
    });
    if (taxRateError) errors[`${prefix}.taxRate`] = taxRateError;

    const discountError = validateDecimal(line.discountAmount, {
      label: 'Discount',
      blankMessage: 'Enter a discount amount.',
      allowZero: true,
      max: INVOICE_AMOUNT_MAX,
    });
    if (discountError) errors[`${prefix}.discountAmount`] = discountError;

    if (!line.revenueAccountId) {
      errors[`${prefix}.revenueAccountId`] = 'Choose a revenue account.';
    } else if (
      options.activeRevenueAccountIds &&
      !options.activeRevenueAccountIds.includes(line.revenueAccountId)
    ) {
      errors[`${prefix}.revenueAccountId`] =
        'Choose an active revenue account.';
    }

    if (line.description.trim().length > INVOICE_DESCRIPTION_MAX) {
      errors[`${prefix}.description`] =
        `Description must be ${INVOICE_DESCRIPTION_MAX} characters or fewer.`;
    }

    if (!quantityError && !unitPriceError && !discountError) {
      const { lineSubtotal } = linePreview(line);
      if ((decimalValue(line.discountAmount) ?? 0) > lineSubtotal) {
        errors[`${prefix}.discountAmount`] =
          'Discount cannot exceed the line subtotal.';
      }
    }
  });

  if (Object.keys(errors).length === 0) {
    const preview = calculateInvoicePreview(values.lines);
    if (preview.totalAmount > INVOICE_AMOUNT_MAX) {
      errors.lines = 'Invoice total is too large.';
    }
  }

  return errors;
}

export function isInvoiceFormValid(errors: InvoiceFormErrors) {
  return Object.keys(errors).length === 0;
}

function toLineInput(line: InvoiceLineFormValues): InvoiceLineInput {
  return {
    description: line.description.trim(),
    quantity: Number(line.quantity),
    unitPrice: Number(line.unitPrice),
    taxRate: Number(line.taxRate),
    discountAmount: Number(line.discountAmount),
    revenueAccountId: line.revenueAccountId,
  };
}

function baseInput(values: InvoiceFormValues) {
  return {
    customerId: values.customerId,
    invoiceNumber: values.invoiceNumber.trim(),
    invoiceDate: values.invoiceDate,
    notes: values.notes.trim(),
    terms: values.terms.trim(),
    lines: values.lines.map(toLineInput),
  };
}

export function toCreateInvoiceInput(
  values: InvoiceFormValues,
): CreateInvoiceInput {
  return {
    ...baseInput(values),
    ...(values.dueDate ? { dueDate: values.dueDate } : {}),
  };
}

export function toUpdateInvoiceInput(
  values: InvoiceFormValues,
): UpdateInvoiceInput {
  return {
    ...baseInput(values),
    ...(values.dueDate ? { dueDate: values.dueDate } : {}),
  };
}
