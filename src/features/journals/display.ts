import type { JournalEntryStatus } from './types';
import { formatMoney } from 'src/features/money/format';

export const journalEntryStatusMeta: Record<
  JournalEntryStatus,
  { label: string; variant: 'lightSuccess' | 'lightWarning' | 'gray' }
> = {
  DRAFT: { label: 'Draft', variant: 'lightWarning' },
  POSTED: { label: 'Posted', variant: 'lightSuccess' },
  VOID: { label: 'Void', variant: 'gray' },
};

export const journalEntryStatusOptions = (
  Object.keys(journalEntryStatusMeta) as JournalEntryStatus[]
).map((value) => ({
  value,
  label: journalEntryStatusMeta[value].label,
}));

export function formatJournalAmount(value: number, currency: string): string {
  return formatMoney(value, currency, false, 4);
}

export function formatJournalDate(value: string): string {
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(date);
}

export function formatJournalDateTime(value: string): string {
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
