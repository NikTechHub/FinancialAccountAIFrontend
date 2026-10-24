import type { AccountType } from './types';

export const accountTypeMeta: Record<
  AccountType,
  { label: string; variant: 'lightPrimary' | 'lightInfo' | 'lightWarning' | 'lightSuccess' | 'lightError' }
> = {
  ASSET: { label: 'Asset', variant: 'lightPrimary' },
  LIABILITY: { label: 'Liability', variant: 'lightWarning' },
  EQUITY: { label: 'Equity', variant: 'lightInfo' },
  REVENUE: { label: 'Revenue', variant: 'lightSuccess' },
  EXPENSE: { label: 'Expense', variant: 'lightError' },
};

export const accountTypeOptions = (
  Object.entries(accountTypeMeta) as [
    AccountType,
    (typeof accountTypeMeta)[AccountType],
  ][]
).map(([value, meta]) => ({ value, label: meta.label }));

export function formatAccountDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';

  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(date);
}
