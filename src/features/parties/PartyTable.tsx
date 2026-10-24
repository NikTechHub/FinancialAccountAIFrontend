import { Pencil, UserX } from 'lucide-react';
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
import type { PartyLabels, PartyRecord } from './types';

const pageSizeOptions = [10, 20, 50];

interface PartyTableProps {
  records: PartyRecord[];
  labels: PartyLabels;
  isLoading: boolean;
  canEdit: boolean;
  canDeactivate: boolean;
  isFiltered: boolean;
  emptyDescription: string;
  page: number;
  pageSize: number;
  totalPages: number;
  totalElements: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
  onClearSearch: () => void;
  onEdit: (record: PartyRecord) => void;
  onDeactivate: (record: PartyRecord) => void;
}

function formatDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';

  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(date);
}

function valueOrDash(value: string | null): string {
  return value?.trim() ? value : '—';
}

export function PartyTable({
  records,
  labels,
  isLoading,
  canEdit,
  canDeactivate,
  isFiltered,
  emptyDescription,
  page,
  pageSize,
  totalPages,
  totalElements,
  onPageChange,
  onPageSizeChange,
  onClearSearch,
  onEdit,
  onDeactivate,
}: PartyTableProps) {
  const showActions = canEdit || canDeactivate;
  const columnCount = showActions ? 7 : 6;
  const canGoPrevious = page > 0 && !isLoading;
  const canGoNext = page + 1 < totalPages && !isLoading;

  return (
    <div>
      <div className="overflow-x-auto">
        <Table aria-label={`${labels.plural} table`}>
          <TableHeader>
            <TableRow>
              <TableHead className="min-w-[170px]">Name</TableHead>
              <TableHead className="min-w-[180px]">Contact</TableHead>
              <TableHead className="min-w-[110px]">Tax identifier</TableHead>
              <TableHead className="min-w-[110px]">Payment terms</TableHead>
              <TableHead className="min-w-[100px]">Created</TableHead>
              <TableHead className="min-w-[80px]">Status</TableHead>
              {showActions && <TableHead className="min-w-[160px] text-right">Actions</TableHead>}
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
                      ? `No ${labels.lowerPlural} match your search`
                      : `No ${labels.lowerPlural} yet`}
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {isFiltered
                      ? 'Try a different name or clear the search.'
                      : emptyDescription}
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
              records.map((record) => (
                <TableRow key={record.id}>
                  <TableCell>
                    <div className="max-w-[240px] whitespace-normal break-words">
                      <p className="font-medium">{record.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {record.organizationName}
                      </p>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="max-w-[220px] whitespace-normal break-all text-sm">
                      <p>{valueOrDash(record.email)}</p>
                      <p className="text-muted-foreground">{valueOrDash(record.phone)}</p>
                    </div>
                  </TableCell>
                  <TableCell className="max-w-[180px] truncate" title={record.taxIdentifier ?? ''}>
                    {valueOrDash(record.taxIdentifier)}
                  </TableCell>
                  <TableCell className="max-w-[180px] truncate" title={record.paymentTerms ?? ''}>
                    {valueOrDash(record.paymentTerms)}
                  </TableCell>
                  <TableCell>{formatDate(record.createdAt)}</TableCell>
                  <TableCell>
                    <Badge variant={record.active ? 'lightSuccess' : 'gray'}>
                      {record.active ? 'Active' : 'Inactive'}
                    </Badge>
                  </TableCell>
                  {showActions && (
                    <TableCell>
                      <div className="flex items-center justify-end gap-1">
                        {canEdit && (
                          <Button
                            type="button"
                            variant="ghostprimary"
                            size="sm"
                            className="h-8 px-2"
                            onClick={() => onEdit(record)}
                            aria-label={`Edit ${record.name}`}
                          >
                            <Pencil className="size-4" />
                            Edit
                          </Button>
                        )}
                        {canDeactivate && (
                          <Button
                            type="button"
                            variant="ghosterror"
                            size="sm"
                            className="h-8 px-2"
                            onClick={() => onDeactivate(record)}
                            aria-label={`Deactivate ${record.name}`}
                          >
                            <UserX className="size-4" />
                            Deactivate
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  )}
                </TableRow>
              ))}
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
            {totalElements} {totalElements === 1 ? 'record' : 'records'}
          </div>

          <div className="flex items-center gap-2">
            <Label
              htmlFor="party-page-size"
              className="whitespace-nowrap text-sm text-muted-foreground"
            >
              Rows per page
            </Label>
            <Select
              value={String(pageSize)}
              onValueChange={(value) => onPageSizeChange(Number(value))}
            >
              <SelectTrigger id="party-page-size" className="w-[84px]">
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
