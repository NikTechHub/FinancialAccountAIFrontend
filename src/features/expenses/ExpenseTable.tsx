import { Ban, CheckCircle2, Pencil } from 'lucide-react';
import { Badge } from 'src/components/ui/badge';
import { Button } from 'src/components/ui/button';
import { Label } from 'src/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from 'src/components/ui/select';
import { Skeleton } from 'src/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from 'src/components/ui/table';
import type { ExpenseRecord, ExpenseStatus } from './types';

const pageSizeOptions = [10, 20, 50];

const statusStyles: Record<ExpenseStatus, { label: string; variant: 'lightSuccess' | 'lightWarning' | 'gray' }> = {
  DRAFT: { label: 'Draft', variant: 'lightWarning' },
  RECORDED: { label: 'Recorded', variant: 'lightSuccess' },
  VOID: { label: 'Void', variant: 'gray' },
};

interface ExpenseTableProps {
  records: ExpenseRecord[];
  currency: string;
  isLoading: boolean;
  canWrite: boolean;
  isFiltered: boolean;
  page: number;
  pageSize: number;
  totalPages: number;
  totalElements: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
  onClearFilters: () => void;
  onEdit: (record: ExpenseRecord) => void;
  onAction: (record: ExpenseRecord, action: 'record' | 'void') => void;
}

function formatDate(value: string) {
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(date);
}

function formatAmount(value: number, currency: string) {
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
    }).format(value);
  } catch {
    return `${currency} ${value.toFixed(2)}`;
  }
}

export function ExpenseTable({
  records,
  currency,
  isLoading,
  canWrite,
  isFiltered,
  page,
  pageSize,
  totalPages,
  totalElements,
  onPageChange,
  onPageSizeChange,
  onClearFilters,
  onEdit,
  onAction,
}: ExpenseTableProps) {
  const columnCount = canWrite ? 7 : 6;
  const canGoPrevious = page > 0 && !isLoading;
  const canGoNext = page + 1 < totalPages && !isLoading;

  return (
    <div>
      <div className="overflow-x-auto">
        <Table aria-label="Expenses table">
          <TableHeader>
            <TableRow>
              <TableHead className="min-w-[120px]">Date</TableHead>
              <TableHead className="min-w-[190px]">Vendor</TableHead>
              <TableHead className="min-w-[180px]">Expense account</TableHead>
              <TableHead className="min-w-[110px] text-right">Amount</TableHead>
              <TableHead className="min-w-[140px]">Reference</TableHead>
              <TableHead className="min-w-[100px]">Status</TableHead>
              {canWrite && <TableHead className="min-w-[220px] text-right">Actions</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading &&
              Array.from({ length: 5 }).map((_, index) => (
                <TableRow key={`skeleton-${index}`}>
                  {Array.from({ length: columnCount }).map((__, cellIndex) => (
                    <TableCell key={cellIndex}>
                      <Skeleton className="h-5 w-full max-w-[150px]" />
                    </TableCell>
                  ))}
                </TableRow>
              ))}

            {!isLoading && records.length === 0 && (
              <TableRow>
                <TableCell colSpan={columnCount} className="p-10 text-center">
                  <p className="text-base font-medium">
                    {isFiltered ? 'No expenses match your filters' : 'No expenses yet'}
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {isFiltered
                      ? 'Try a different search or clear the filters.'
                      : 'Create a draft expense to get started.'}
                  </p>
                  {isFiltered && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="mt-4"
                      onClick={onClearFilters}
                    >
                      Clear filters
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            )}

            {!isLoading &&
              records.map((record) => {
                const status = statusStyles[record.status];
                const isDraft = record.status === 'DRAFT';

                return (
                  <TableRow key={record.id}>
                    <TableCell>
                      <p>{formatDate(record.expenseDate)}</p>
                      <p className="text-xs text-muted-foreground">{record.organizationName}</p>
                    </TableCell>
                    <TableCell>
                      <div className="max-w-[240px] whitespace-normal break-words">
                        <p className="font-medium">{record.vendorName ?? 'No vendor'}</p>
                        {record.description && (
                          <p className="text-xs text-muted-foreground">{record.description}</p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <p className="font-medium">{record.expenseAccountName}</p>
                      <p className="text-xs text-muted-foreground">
                        {record.expenseAccountCode} · paid from {record.paymentAccountName}
                      </p>
                    </TableCell>
                    <TableCell className="text-right font-medium tabular-nums">
                      {formatAmount(record.amount, currency)}
                    </TableCell>
                    <TableCell className="max-w-[180px] truncate" title={record.reference ?? ''}>
                      {record.reference || '—'}
                    </TableCell>
                    <TableCell>
                      <Badge variant={status.variant}>{status.label}</Badge>
                    </TableCell>
                    {canWrite && (
                      <TableCell>
                        <div className="flex flex-wrap items-center justify-end gap-1">
                          {isDraft && (
                            <>
                              <Button
                                type="button"
                                variant="ghostprimary"
                                size="sm"
                                className="h-8 px-2"
                                onClick={() => onEdit(record)}
                                aria-label={`Edit expense from ${record.expenseDate}`}
                              >
                                <Pencil className="size-4" />
                                Edit
                              </Button>
                              <Button
                                type="button"
                                variant="ghostprimary"
                                size="sm"
                                className="h-8 px-2"
                                onClick={() => onAction(record, 'record')}
                                aria-label={`Record expense from ${record.expenseDate}`}
                              >
                                <CheckCircle2 className="size-4" />
                                Record
                              </Button>
                              <Button
                                type="button"
                                variant="ghosterror"
                                size="sm"
                                className="h-8 px-2"
                                onClick={() => onAction(record, 'void')}
                                aria-label={`Void expense from ${record.expenseDate}`}
                              >
                                <Ban className="size-4" />
                                Void
                              </Button>
                            </>
                          )}
                          {!isDraft && (
                            <span className="text-xs text-muted-foreground">No actions</span>
                          )}
                        </div>
                      </TableCell>
                    )}
                  </TableRow>
                );
              })}
          </TableBody>
        </Table>
      </div>

      {!isLoading && (
        <div className="flex flex-col gap-4 border-t border-border p-4 sm:flex-row sm:items-center sm:justify-between dark:border-white/10">
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => onPageChange(page - 1)}
              disabled={!canGoPrevious}
            >
              Previous
            </Button>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => onPageChange(page + 1)}
              disabled={!canGoNext}
            >
              Next
            </Button>
          </div>

          <div className="text-sm text-muted-foreground">
            Page {totalPages === 0 ? 0 : page + 1} of {totalPages}
            <span className="mx-2">·</span>
            {totalElements} {totalElements === 1 ? 'expense' : 'expenses'}
          </div>

          <div className="flex items-center gap-2">
            <Label
              htmlFor="expense-page-size"
              className="whitespace-nowrap text-sm text-muted-foreground"
            >
              Rows per page
            </Label>
            <Select
              value={String(pageSize)}
              onValueChange={(value) => onPageSizeChange(Number(value))}
            >
              <SelectTrigger id="expense-page-size" className="w-[84px]">
                <SelectValue placeholder="Rows" />
              </SelectTrigger>
              <SelectContent>
                {pageSizeOptions.map((size) => (
                  <SelectItem key={size} value={String(size)}>
                    {size}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      )}
    </div>
  );
}
