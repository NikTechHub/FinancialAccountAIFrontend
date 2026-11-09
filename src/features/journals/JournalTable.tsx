import { Ban, CheckCircle2, Eye, Pencil } from 'lucide-react';
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
import type { JournalEntryRecord } from './types';
import {
  formatJournalAmount,
  formatJournalDate,
  journalEntryStatusMeta,
} from './display';

const pageSizeOptions = [10, 20, 50];

interface JournalTableProps {
  records: JournalEntryRecord[];
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
  onView: (record: JournalEntryRecord) => void;
  onEdit: (record: JournalEntryRecord) => void;
  onAction: (record: JournalEntryRecord, action: 'post' | 'void') => void;
}

export function JournalTable({
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
}: JournalTableProps) {
  const columnCount = 8;
  const canGoPrevious = page > 0 && !isLoading;
  const canGoNext = page + 1 < totalPages && !isLoading;

  return (
    <div>
      {isLoading && (
        <span role="status" className="sr-only">
          Loading journal entries...
        </span>
      )}
      <div className="overflow-x-auto">
        <Table aria-label="Journal entries table">
          <TableHeader>
            <TableRow>
              <TableHead className="min-w-[120px]">Entry #</TableHead>
              <TableHead className="min-w-[110px]">Date</TableHead>
              <TableHead className="min-w-[180px]">Description</TableHead>
              <TableHead className="min-w-[110px] text-right">Debits</TableHead>
              <TableHead className="min-w-[110px] text-right">Credits</TableHead>
              <TableHead className="min-w-[100px]">Status</TableHead>
              <TableHead className="min-w-[120px]">Reference</TableHead>
              <TableHead className="min-w-[220px] text-right">Actions</TableHead>
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
                    {isFiltered ? 'No journal entries match your filters' : 'No journal entries yet'}
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {isFiltered
                      ? 'Try a different search or clear the filters.'
                      : canWrite
                        ? 'Create a draft journal entry to get started.'
                        : 'Journal entries will appear here once they are created.'}
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
                const status = journalEntryStatusMeta[record.status];
                const isDraft = record.status === 'DRAFT';

                return (
                  <TableRow key={record.id}>
                    <TableCell className="font-medium">{record.entryNumber}</TableCell>
                    <TableCell>{formatJournalDate(record.entryDate)}</TableCell>
                    <TableCell className="max-w-[240px] truncate" title={record.description ?? ''}>
                      {record.description || '—'}
                    </TableCell>
                    <TableCell className="text-right font-medium tabular-nums">
                      {formatJournalAmount(record.totalDebits, currency)}
                    </TableCell>
                    <TableCell className="text-right font-medium tabular-nums">
                      {formatJournalAmount(record.totalCredits, currency)}
                    </TableCell>
                    <TableCell>
                      <Badge variant={status.variant}>{status.label}</Badge>
                    </TableCell>
                    <TableCell className="max-w-[160px] truncate" title={record.reference ?? ''}>
                      {record.reference || '—'}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap items-center justify-end gap-1">
                        <Button
                          type="button"
                          variant="ghostprimary"
                          size="sm"
                          className="h-8 px-2"
                          onClick={() => onView(record)}
                          aria-label={`View journal entry ${record.entryNumber}`}
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
                              aria-label={`Edit journal entry ${record.entryNumber}`}
                            >
                              <Pencil className="size-4" />
                              Edit
                            </Button>
                            <Button
                              type="button"
                              variant="ghostprimary"
                              size="sm"
                              className="h-8 px-2"
                              onClick={() => onAction(record, 'post')}
                              aria-label={`Post journal entry ${record.entryNumber}`}
                            >
                              <CheckCircle2 className="size-4" />
                              Post
                            </Button>
                            <Button
                              type="button"
                              variant="ghosterror"
                              size="sm"
                              className="h-8 px-2"
                              onClick={() => onAction(record, 'void')}
                              aria-label={`Void journal entry ${record.entryNumber}`}
                            >
                              <Ban className="size-4" />
                              Void
                            </Button>
                          </>
                        )}
                        {!isDraft && (
                          <span className="px-2 text-xs text-muted-foreground">
                            Read-only
                          </span>
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
            {totalElements} {totalElements === 1 ? 'entry' : 'entries'}
          </div>

          <div className="flex items-center gap-2">
            <Label
              htmlFor="journal-page-size"
              className="whitespace-nowrap text-sm text-muted-foreground"
            >
              Rows per page
            </Label>
            <Select
              value={String(pageSize)}
              onValueChange={(value) => onPageSizeChange(Number(value))}
            >
              <SelectTrigger id="journal-page-size" className="w-[84px]">
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
