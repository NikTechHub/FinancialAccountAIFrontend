import { Ban, Eye, Pencil, Send } from 'lucide-react';
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
import {
  formatInvoiceAmount,
  formatInvoiceDate,
  invoiceStatusMeta,
} from './display';
import type { InvoiceAction, InvoiceRecord } from './types';

const pageSizeOptions = [10, 20, 50];

interface InvoiceTableProps {
  records: InvoiceRecord[];
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
  onView: (record: InvoiceRecord) => void;
  onEdit: (record: InvoiceRecord) => void;
  onAction: (record: InvoiceRecord, action: InvoiceAction) => void;
}

export function InvoiceTable({
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
  onView,
  onEdit,
  onAction,
}: InvoiceTableProps) {
  const columnCount = 7;
  const canGoPrevious = page > 0 && !isLoading;
  const canGoNext = page + 1 < totalPages && !isLoading;

  return (
    <div>
      <div className="overflow-x-auto">
        <Table aria-label="Invoices table">
          <TableHeader>
            <TableRow>
              <TableHead className="min-w-[150px]">Invoice</TableHead>
              <TableHead className="min-w-[180px]">Customer</TableHead>
              <TableHead className="min-w-[120px]">Invoice date</TableHead>
              <TableHead className="min-w-[110px]">Due date</TableHead>
              <TableHead className="min-w-[120px] text-right">Total</TableHead>
              <TableHead className="min-w-[130px]">Status</TableHead>
              <TableHead className="min-w-[230px] text-right">Actions</TableHead>
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
                    {isFiltered ? 'No invoices match your filter' : 'No invoices yet'}
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {isFiltered
                      ? 'Try a different filter or clear it to see all invoices.'
                      : 'Create a draft invoice to get started.'}
                  </p>
                  {isFiltered && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="mt-4"
                      onClick={onClearFilters}
                    >
                      Clear filter
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            )}

            {!isLoading &&
              records.map((record) => {
                const status = invoiceStatusMeta[record.status];
                const isDraft = record.status === 'DRAFT';

                return (
                  <TableRow key={record.id}>
                    <TableCell>
                      <button
                        type="button"
                        className="text-left font-medium text-primary hover:underline"
                        onClick={() => onView(record)}
                      >
                        {record.invoiceNumber}
                      </button>
                      <p className="text-xs text-muted-foreground">
                        {record.organizationName}
                      </p>
                    </TableCell>
                    <TableCell>
                      <div className="max-w-[220px] whitespace-normal break-words">
                        {record.customerName}
                      </div>
                    </TableCell>
                    <TableCell>{formatInvoiceDate(record.invoiceDate)}</TableCell>
                    <TableCell>
                      {record.dueDate ? formatInvoiceDate(record.dueDate) : '—'}
                    </TableCell>
                    <TableCell className="text-right font-medium tabular-nums">
                      {formatInvoiceAmount(record.totalAmount, currency)}
                    </TableCell>
                    <TableCell>
                      <Badge variant={status.variant}>{status.label}</Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap items-center justify-end gap-1">
                        <Button
                          type="button"
                          variant="ghostprimary"
                          size="sm"
                          className="h-8 px-2"
                          onClick={() => onView(record)}
                          aria-label={`View invoice ${record.invoiceNumber}`}
                        >
                          <Eye className="size-4" />
                          View
                        </Button>
                        {isDraft && canWrite && (
                          <>
                            <Button
                              type="button"
                              variant="ghostprimary"
                              size="sm"
                              className="h-8 px-2"
                              onClick={() => onEdit(record)}
                              aria-label={`Edit invoice ${record.invoiceNumber}`}
                            >
                              <Pencil className="size-4" />
                              Edit
                            </Button>
                            <Button
                              type="button"
                              variant="ghostprimary"
                              size="sm"
                              className="h-8 px-2"
                              onClick={() => onAction(record, 'issue')}
                              aria-label={`Issue invoice ${record.invoiceNumber}`}
                            >
                              <Send className="size-4" />
                              Issue
                            </Button>
                            <Button
                              type="button"
                              variant="ghosterror"
                              size="sm"
                              className="h-8 px-2"
                              onClick={() => onAction(record, 'void')}
                              aria-label={`Void invoice ${record.invoiceNumber}`}
                            >
                              <Ban className="size-4" />
                              Void
                            </Button>
                          </>
                        )}
                      </div>
                    </TableCell>
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
            {totalElements} {totalElements === 1 ? 'invoice' : 'invoices'}
          </div>

          <div className="flex items-center gap-2">
            <Label
              htmlFor="invoice-page-size"
              className="whitespace-nowrap text-sm text-muted-foreground"
            >
              Rows per page
            </Label>
            <Select
              value={String(pageSize)}
              onValueChange={(value) => onPageSizeChange(Number(value))}
            >
              <SelectTrigger id="invoice-page-size" className="w-[84px]">
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
