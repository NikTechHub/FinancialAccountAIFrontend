import type { JournalEntryStatus } from './types';

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

export function formatJournalAmount(value: number): string {
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 4,
  }).format(value);
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
