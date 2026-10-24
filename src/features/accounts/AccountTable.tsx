import { Pencil, PowerOff } from 'lucide-react';
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
import { accountTypeMeta, formatAccountDate } from './display';
import type { AccountRecord } from './types';

const pageSizeOptions = [10, 20, 50];

interface AccountTableProps {
  records: AccountRecord[];
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
  onEdit: (record: AccountRecord) => void;
  onDeactivate: (record: AccountRecord) => void;
}

export function AccountTable({
  records,
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
  onDeactivate,
}: AccountTableProps) {
  const columnCount = canWrite ? 7 : 6;
  const canGoPrevious = page > 0 && !isLoading;
  const canGoNext = page + 1 < totalPages && !isLoading;

  return (
    <div>
      <div className="overflow-x-auto">
        <Table aria-label="Chart of accounts table">
          <TableHeader>
            <TableRow>
              <TableHead className="min-w-[110px]">Code</TableHead>
              <TableHead className="min-w-[210px]">Account</TableHead>
              <TableHead className="min-w-[110px]">Type</TableHead>
              <TableHead className="min-w-[170px]">Parent account</TableHead>
              <TableHead className="min-w-[90px]">Status</TableHead>
              <TableHead className="min-w-[120px]">Updated</TableHead>
              {canWrite && <TableHead className="min-w-[170px] text-right">Actions</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading &&
              Array.from({ length: 5 }).map((_, index) => (
                <TableRow key={`skeleton-${index}`}>
                  {Array.from({ length: columnCount }).map((__, cellIndex) => (
                    <TableCell key={cellIndex}>
                      <Skeleton className="h-5 w-full max-w-[160px]" />
                    </TableCell>
                  ))}
                </TableRow>
              ))}

            {!isLoading && records.length === 0 && (
              <TableRow>
                <TableCell colSpan={columnCount} className="p-10 text-center">
                  <p className="text-base font-medium">
                    {isFiltered
                      ? 'No accounts match your filters'
                      : 'No accounts yet'}
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {isFiltered
                      ? 'Try a different code, name, or account type.'
                      : 'Add an account to build your chart of accounts.'}
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
                const typeMeta = accountTypeMeta[record.type];

                return (
                  <TableRow key={record.id}>
                    <TableCell className="font-mono text-sm">{record.code}</TableCell>
                    <TableCell>
                      <div className="max-w-[280px] whitespace-normal break-words">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-medium">{record.name}</p>
                          {record.systemAccount && (
                            <Badge variant="lightInfo">System</Badge>
                          )}
                        </div>
                        {record.description && (
                          <p className="mt-1 text-xs text-muted-foreground">
                            {record.description}
                          </p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={typeMeta.variant}>{typeMeta.label}</Badge>
                    </TableCell>
                    <TableCell className="max-w-[200px] whitespace-normal break-words text-sm">
                      {record.parentAccountName ?? '—'}
                    </TableCell>
                    <TableCell>
                      <Badge variant={record.active ? 'lightSuccess' : 'gray'}>
                        {record.active ? 'Active' : 'Inactive'}
                      </Badge>
                    </TableCell>
                    <TableCell>{formatAccountDate(record.updatedAt)}</TableCell>
                    {canWrite && (
                      <TableCell>
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            type="button"
                            variant="ghostprimary"
                            size="sm"
                            className="h-8 px-2"
                            onClick={() => onEdit(record)}
                            aria-label={`Edit account ${record.code}`}
                          >
                            <Pencil className="size-4" />
                            Edit
                          </Button>
                          {!record.systemAccount && (
                            <Button
                              type="button"
                              variant="ghosterror"
                              size="sm"
                              className="h-8 px-2"
                              onClick={() => onDeactivate(record)}
                              aria-label={`Deactivate account ${record.code}`}
                            >
                              <PowerOff className="size-4" />
                              Deactivate
                            </Button>
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
            {totalElements} {totalElements === 1 ? 'account' : 'accounts'}
          </div>

          <div className="flex items-center gap-2">
            <Label
              htmlFor="account-page-size"
              className="whitespace-nowrap text-sm text-muted-foreground"
            >
              Rows per page
            </Label>
            <Select
              value={String(pageSize)}
              onValueChange={(value) => onPageSizeChange(Number(value))}
            >
              <SelectTrigger id="account-page-size" className="w-[84px]">
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
