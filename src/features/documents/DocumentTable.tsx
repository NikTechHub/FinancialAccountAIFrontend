import { Download, Eye, Trash2 } from 'lucide-react';
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
import type { DocumentRecord, DocumentStatus, DocumentType } from './types';
import { formatFileSize } from './validation';

const pageSizeOptions = [10, 20, 50];

const typeLabels: Record<DocumentType, string> = {
  INVOICE: 'Invoice',
  RECEIPT: 'Receipt',
  EXPENSE_RECEIPT: 'Expense receipt',
  OTHER: 'Other',
};

const statusStyles: Record<
  DocumentStatus,
  { label: string; variant: 'gray' | 'lightWarning' | 'lightSuccess' | 'lightError' }
> = {
  UPLOADED: { label: 'Uploaded', variant: 'gray' },
  PROCESSING: { label: 'Processing', variant: 'lightWarning' },
  PROCESSED: { label: 'Processed', variant: 'lightSuccess' },
  FAILED: { label: 'Failed', variant: 'lightError' },
};

interface DocumentTableProps {
  records: DocumentRecord[];
  isLoading: boolean;
  canWrite: boolean;
  isFiltered: boolean;
  downloadingId: string | null;
  page: number;
  pageSize: number;
  totalPages: number;
  totalElements: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
  onClearSearch: () => void;
  onOpen: (record: DocumentRecord) => void;
  onDownload: (record: DocumentRecord) => void;
  onDelete: (record: DocumentRecord) => void;
}

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(date);
}

export function DocumentTable({
  records,
  isLoading,
  canWrite,
  isFiltered,
  downloadingId,
  page,
  pageSize,
  totalPages,
  totalElements,
  onPageChange,
  onPageSizeChange,
  onClearSearch,
  onOpen,
  onDownload,
  onDelete,
}: DocumentTableProps) {
  const columnCount = 7;
  const canGoPrevious = page > 0 && !isLoading;
  const canGoNext = page + 1 < totalPages && !isLoading;

  return (
    <div>
      <div className="overflow-x-auto">
        <Table aria-label="Documents table">
          <TableHeader>
            <TableRow>
              <TableHead className="min-w-[230px]">Document</TableHead>
              <TableHead className="min-w-[120px]">Type</TableHead>
              <TableHead className="min-w-[130px]">Linked record</TableHead>
              <TableHead className="min-w-[110px]">Status</TableHead>
              <TableHead className="min-w-[110px]">Uploaded</TableHead>
              <TableHead className="min-w-[90px] text-right">Size</TableHead>
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
                    {isFiltered ? 'No documents match your search' : 'No documents yet'}
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {isFiltered
                      ? 'Try a different file name or clear the search.'
                      : 'Upload a receipt or invoice to process it.'}
                  </p>
                  {isFiltered && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="mt-4"
                      onClick={onClearSearch}
                    >
                      Clear search
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            )}

            {!isLoading &&
              records.map((record) => {
                const status = statusStyles[record.status];
                return (
                  <TableRow key={record.id}>
                    <TableCell>
                      <button
                        type="button"
                        className="max-w-[300px] whitespace-normal break-words text-left font-medium text-primary hover:underline"
                        onClick={() => onOpen(record)}
                      >
                        {record.originalFileName}
                      </button>
                      <p className="max-w-[260px] truncate text-xs text-muted-foreground">
                        SHA-256 {record.checksum.slice(0, 12)}…
                      </p>
                    </TableCell>
                    <TableCell>{typeLabels[record.documentType]}</TableCell>
                    <TableCell>
                      {record.expenseId ? (
                        <Badge variant="lightPrimary" title={record.expenseId}>
                          Expense {record.expenseId.slice(0, 8)}
                        </Badge>
                      ) : record.invoiceId ? (
                        <Badge variant="lightInfo" title={record.invoiceId}>
                          Invoice {record.invoiceId.slice(0, 8)}
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground">Unlinked</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant={status.variant}>{status.label}</Badge>
                    </TableCell>
                    <TableCell>{formatDate(record.createdAt)}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatFileSize(record.fileSize)}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap items-center justify-end gap-1">
                          <Button
                            type="button"
                            variant="ghostprimary"
                            size="sm"
                            className="h-8 px-2"
                            onClick={() => onOpen(record)}
                            aria-label={`Open ${record.originalFileName}`}
                          >
                            <Eye className="size-4" />
                            Open
                          </Button>
                          <Button
                            type="button"
                            variant="ghostprimary"
                            size="sm"
                            className="h-8 px-2"
                            onClick={() => onDownload(record)}
                            disabled={downloadingId === record.id}
                            aria-label={`Download ${record.originalFileName}`}
                          >
                            <Download className="size-4" />
                            {downloadingId === record.id ? 'Downloading...' : 'Download'}
                          </Button>
                          {canWrite && (
                            <Button
                              type="button"
                              variant="ghosterror"
                              size="sm"
                              className="h-8 px-2"
                              onClick={() => onDelete(record)}
                              aria-label={`Delete ${record.originalFileName}`}
                            >
                              <Trash2 className="size-4" />
                              Delete
                            </Button>
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
            {totalElements} {totalElements === 1 ? 'document' : 'documents'}
          </div>

          <div className="flex items-center gap-2">
            <Label
              htmlFor="document-page-size"
              className="whitespace-nowrap text-sm text-muted-foreground"
            >
              Rows per page
            </Label>
            <Select
              value={String(pageSize)}
              onValueChange={(value) => onPageSizeChange(Number(value))}
            >
              <SelectTrigger id="document-page-size" className="w-[84px]">
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
