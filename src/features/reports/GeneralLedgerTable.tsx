import { Link } from 'react-router';
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
import type { GeneralLedgerLine } from './types';
import { formatReportAmount, formatReportDate } from './display';

const pageSizeOptions = [10, 20, 50];

interface GeneralLedgerTableProps {
  lines: GeneralLedgerLine[];
  isLoading: boolean;
  currency: string;
  fromDate: string;
  toDate: string;
  page: number;
  pageSize: number;
  totalPages: number;
  totalElements: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
  onResetPeriod: () => void;
}

export function GeneralLedgerTable({
  lines,
  isLoading,
  currency,
  fromDate,
  toDate,
  page,
  pageSize,
  totalPages,
  totalElements,
  onPageChange,
  onPageSizeChange,
  onResetPeriod,
}: GeneralLedgerTableProps) {
  const columnCount = 7;
  const canGoPrevious = page > 0 && !isLoading;
  const canGoNext = page + 1 < totalPages && !isLoading;

  return (
    <div>
      {isLoading && (
        <span role="status" className="sr-only">
          Loading general ledger...
        </span>
      )}

      <Table aria-label="General ledger table">
        <TableHeader>
          <TableRow>
            <TableHead className="min-w-[110px]">Date</TableHead>
            <TableHead className="min-w-[120px]">Entry #</TableHead>
            <TableHead className="min-w-[120px]">Reference</TableHead>
            <TableHead className="min-w-[210px]">Description</TableHead>
            <TableHead className="min-w-[170px]">Line description</TableHead>
            <TableHead className="min-w-[130px] text-right">
              Debit ({currency})
            </TableHead>
            <TableHead className="min-w-[130px] text-right">
              Credit ({currency})
            </TableHead>
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

          {!isLoading && lines.length === 0 && (
            <TableRow>
              <TableCell colSpan={columnCount} className="p-10 text-center">
                <p className="text-base font-medium">
                  No posted activity for this account
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  There are no posted journal lines between {formatReportDate(fromDate)} and{' '}
                  {formatReportDate(toDate)}.
                </p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="mt-4"
                  onClick={onResetPeriod}
                >
                  Reset to year to date
                </Button>
              </TableCell>
            </TableRow>
          )}

          {!isLoading &&
            lines.map((line, index) => (
              <TableRow
                key={`${line.journalEntryId}-${line.accountId}-${index}`}
              >
                <TableCell>{formatReportDate(line.entryDate)}</TableCell>
                <TableCell>
                  <Link
                    to={`/journal-entries?entryId=${encodeURIComponent(line.journalEntryId)}`}
                    className="font-medium text-primary hover:underline"
                  >
                    {line.entryNumber}
                  </Link>
                </TableCell>
                <TableCell
                  className="max-w-[160px] truncate"
                  title={line.reference ?? ''}
                >
                  {line.reference || '—'}
                </TableCell>
                <TableCell
                  className="max-w-[260px] truncate"
                  title={line.description ?? ''}
                >
                  {line.description || '—'}
                </TableCell>
                <TableCell
                  className="max-w-[220px] truncate"
                  title={line.lineDescription ?? ''}
                >
                  {line.lineDescription || '—'}
                </TableCell>
                <TableCell className="text-right font-medium tabular-nums">
                  {formatReportAmount(line.debitAmount, currency)}
                </TableCell>
                <TableCell className="text-right font-medium tabular-nums">
                  {formatReportAmount(line.creditAmount, currency)}
                </TableCell>
              </TableRow>
            ))}
        </TableBody>
      </Table>

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
            <span>Page {totalPages === 0 ? 0 : page + 1} of {totalPages}</span>
            <span className="mx-2">·</span>
            <span>{totalElements} {totalElements === 1 ? 'line' : 'lines'}</span>
          </div>

          <div className="flex items-center gap-2">
            <Label
              htmlFor="general-ledger-page-size"
              className="whitespace-nowrap text-sm text-muted-foreground"
            >
              Rows per page
            </Label>
            <Select
              value={String(pageSize)}
              onValueChange={(value) => onPageSizeChange(Number(value))}
            >
              <SelectTrigger id="general-ledger-page-size" className="w-[84px]">
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
