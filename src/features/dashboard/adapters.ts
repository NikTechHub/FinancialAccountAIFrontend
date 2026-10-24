import type {
  DashboardResponse,
  ExpenseAccountSummaryLine,
  ExpenseSummaryResponse,
  InvoiceSummaryResponse,
  VendorExpenseSummaryLine,
} from './types';

const SEGMENT_COLORS = [
  'var(--color-primary)',
  'var(--color-warning)',
  'var(--color-info)',
  'var(--color-success)',
  'var(--color-secondary)',
];

const OTHER_COLOR = '#B8C2CC';

export interface ExpenseSegment {
  key: string;
  label: string;
  amount: number;
  color: string;
}

function lineLabel(line: ExpenseAccountSummaryLine): string {
  return line.expenseAccountName?.trim() || line.expenseAccountCode?.trim() || 'Uncategorized';
}

function segmentFor(line: ExpenseAccountSummaryLine, index: number): ExpenseSegment {
  return {
    key: line.expenseAccountId,
    label: lineLabel(line),
    amount: line.totalAmount,
    color: SEGMENT_COLORS[index % SEGMENT_COLORS.length],
  };
}

export function buildExpenseSegments(
  lines: readonly ExpenseAccountSummaryLine[],
  maxSegments = 4,
): ExpenseSegment[] {
  const sorted = lines
    .filter((line) => Number.isFinite(line.totalAmount) && line.totalAmount > 0)
    .sort(
      (left, right) =>
        right.totalAmount - left.totalAmount || lineLabel(left).localeCompare(lineLabel(right)),
    );

  if (sorted.length === 0) return [];

  if (maxSegments <= 1) {
    return [segmentFor(sorted[0], 0)];
  }

  if (sorted.length <= maxSegments) {
    return sorted.map(segmentFor);
  }

  const visibleCount = maxSegments - 1;
  const visible = sorted.slice(0, visibleCount).map(segmentFor);
  const remaining = sorted.slice(visibleCount);
  const remainingTotal = remaining.reduce((total, line) => total + line.totalAmount, 0);

  if (remainingTotal <= 0) return visible;

  return [
    ...visible,
    {
      key: 'other',
      label: `Other (${remaining.length} accounts)`,
      amount: remainingTotal,
      color: OTHER_COLOR,
    },
  ];
}

export function getTopVendors(
  lines: readonly VendorExpenseSummaryLine[],
  limit = 5,
): VendorExpenseSummaryLine[] {
  if (limit <= 0) return [];

  return [...lines]
    .sort(
      (left, right) =>
        right.totalAmount - left.totalAmount || left.vendorName.localeCompare(right.vendorName),
    )
    .slice(0, limit);
}

export function calculatePercent(amount: number, total: number): number {
  if (!Number.isFinite(amount) || !Number.isFinite(total) || total <= 0) return 0;
  return Math.min(100, Math.max(0, (amount / total) * 100));
}

export function getOutstandingPercent(invoices: InvoiceSummaryResponse): number {
  return calculatePercent(invoices.totalOutstanding, invoices.totalInvoiced);
}

export function hasRevenueActivity(dashboard: DashboardResponse): boolean {
  return (
    dashboard.totalRevenue !== 0 ||
    dashboard.totalExpenses !== 0 ||
    dashboard.netProfit !== 0
  );
}

export function hasExpenseActivity(expenses: ExpenseSummaryResponse): boolean {
  return expenses.totalAmount > 0 && expenses.byAccount.length > 0;
}
