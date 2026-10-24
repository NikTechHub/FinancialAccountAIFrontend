import type { BadgeProps } from 'src/components/ui/badge';
import type { InvoiceStatus } from './types';

export const invoiceStatusMeta: Record<
  InvoiceStatus,
  { label: string; variant: BadgeProps['variant'] }
> = {
  DRAFT: { label: 'Draft', variant: 'lightWarning' },
  ISSUED: { label: 'Issued', variant: 'lightInfo' },
  PARTIALLY_PAID: { label: 'Partially paid', variant: 'lightPrimary' },
  PAID: { label: 'Paid', variant: 'lightSuccess' },
  OVERDUE: { label: 'Overdue', variant: 'lightError' },
  VOID: { label: 'Void', variant: 'gray' },
};

export function formatInvoiceDate(value: string) {
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(date);
}

export function formatInvoiceDateTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(date);
}

export function formatInvoiceAmount(value: number, currency: string) {
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
    }).format(value);
  } catch {
    return `${currency} ${value.toFixed(2)}`;
  }
}

export function formatInvoiceNumber(value: number) {
  return new Intl.NumberFormat('en-US', {
    maximumFractionDigits: 4,
  }).format(value);
}
