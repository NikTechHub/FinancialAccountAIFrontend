import { useEffect, useState, type ReactNode } from 'react';
import { Ban, CheckCircle2, Pencil } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from 'src/components/ui/alert';
import { Badge } from 'src/components/ui/badge';
import { Button } from 'src/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from 'src/components/ui/dialog';
import { Skeleton } from 'src/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from 'src/components/ui/table';
import { journalEntryApi } from './api';
import {
  formatJournalAmount,
  formatJournalDate,
  formatJournalDateTime,
  journalEntryStatusMeta,
} from './display';
import { getJournalEntryErrorMessage } from './errors';
import type { JournalEntryApi, JournalEntryRecord } from './types';

interface JournalDetailDialogProps {
  open: boolean;
  entryId: string | null;
  currency: string;
  canWrite: boolean;
  onOpenChange: (open: boolean) => void;
  onEdit: (record: JournalEntryRecord) => void;
  onAction: (record: JournalEntryRecord, action: 'post' | 'void') => void;
  api?: JournalEntryApi;
}

function DetailItem({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div>
      <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </dt>
      <dd className="mt-1 text-sm">{children}</dd>
    </div>
  );
}

export function JournalDetailDialog({
  open,
  entryId,
  currency,
  canWrite,
  onOpenChange,
  onEdit,
  onAction,
  api = journalEntryApi,
}: JournalDetailDialogProps) {
  const [record, setRecord] = useState<JournalEntryRecord | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    if (!open || !entryId) {
      setRecord(null);
      setError(null);
      setLoading(false);
      return;
    }

    const controller = new AbortController();
    let active = true;
    setLoading(true);
    setError(null);

    void (async () => {
      try {
        const data = await api.get(entryId, controller.signal);
        if (!active) return;
        setRecord(data);
      } catch (loadError) {
        if (!active) return;
        if (
          typeof loadError === 'object' &&
          loadError !== null &&
          'name' in loadError &&
          loadError.name === 'AbortError'
        ) {
          return;
        }
        setRecord(null);
        setError(getJournalEntryErrorMessage(loadError, 'load'));
      } finally {
        if (active) setLoading(false);
      }
    })();

    return () => {
      active = false;
      controller.abort();
    };
  }, [api, open, entryId, reloadKey]);

  const status = record ? journalEntryStatusMeta[record.status] : null;
  const isDraft = record?.status === 'DRAFT';
  const isBalanced = record
    ? record.totalDebits === record.totalCredits
    : false;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex flex-wrap items-center gap-2">
            <DialogTitle>
              {record ? `Journal entry ${record.entryNumber}` : 'Journal entry details'}
            </DialogTitle>
            {status && <Badge variant={status.variant}>{status.label}</Badge>}
          </div>
          <DialogDescription className="text-muted-foreground">
            Review the journal entry, account lines, and accounting status from the server.
          </DialogDescription>
        </DialogHeader>

        {loading && (
          <div role="status" className="space-y-3">
            <span className="sr-only">Loading journal entry details...</span>
            <Skeleton className="h-6 w-56" />
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-40 w-full" />
          </div>
        )}

        {!loading && error && (
          <Alert variant="lighterror">
            <AlertTitle>Unable to load journal entry</AlertTitle>
            <AlertDescription>
              <p>{error}</p>
              <Button
                type="button"
                variant="outlineerror"
                size="sm"
                className="mt-3"
                onClick={() => setReloadKey((key) => key + 1)}
              >
                Try again
              </Button>
            </AlertDescription>
          </Alert>
        )}

        {!loading && !error && !record && (
          <p className="text-sm text-muted-foreground">
            No journal entry was selected.
          </p>
        )}

        {!loading && !error && record && (
          <div className="space-y-6">
            <dl className="grid gap-4 rounded-lg border border-border p-4 sm:grid-cols-2 lg:grid-cols-3 dark:border-white/10">
              <DetailItem label="Entry date">
                {formatJournalDate(record.entryDate)}
              </DetailItem>
              <DetailItem label="Reference">
                {record.reference || 'Not set'}
              </DetailItem>
              <DetailItem label="Organization">
                {record.organizationName}
              </DetailItem>
              <DetailItem label="Created by">
                {record.createdByEmail}
              </DetailItem>
              <DetailItem label="Created">
                {formatJournalDateTime(record.createdAt)}
              </DetailItem>
              <DetailItem label="Last updated">
                {formatJournalDateTime(record.updatedAt)}
              </DetailItem>
            </dl>

            {record.description && (
              <div>
                <h6 className="text-sm font-semibold">Description</h6>
                <p className="mt-1 whitespace-pre-wrap text-sm text-muted-foreground">
                  {record.description}
                </p>
              </div>
            )}

            <div>
              <h6 className="mb-3 font-semibold">Lines</h6>
              <div className="overflow-x-auto rounded-lg border border-border dark:border-white/10">
                <Table aria-label="Journal entry lines">
                  <TableHeader>
                    <TableRow>
                      <TableHead className="min-w-[190px]">Account</TableHead>
                      <TableHead className="min-w-[180px]">Description</TableHead>
                      <TableHead className="min-w-[110px] text-right">Debit</TableHead>
                      <TableHead className="min-w-[110px] text-right">Credit</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {record.lines.map((line) => (
                      <TableRow key={line.id}>
                        <TableCell>
                          <p>{line.accountName}</p>
                          <p className="text-xs text-muted-foreground">
                            {line.accountCode}
                          </p>
                        </TableCell>
                        <TableCell className="whitespace-normal break-words">
                          {line.description || '—'}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {line.debitAmount > 0
                            ? formatJournalAmount(line.debitAmount, currency)
                            : '—'}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {line.creditAmount > 0
                            ? formatJournalAmount(line.creditAmount, currency)
                            : '—'}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>

            <div className="ml-auto w-full max-w-sm space-y-2 rounded-lg border border-border p-4 text-sm dark:border-white/10">
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">
                  Total debits ({currency})
                </dt>
                <dd className="font-medium tabular-nums">
                  {formatJournalAmount(record.totalDebits, currency)}
                </dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">
                  Total credits ({currency})
                </dt>
                <dd className="font-medium tabular-nums">
                  {formatJournalAmount(record.totalCredits, currency)}
                </dd>
              </div>
              <div className="flex justify-between gap-4 border-t border-border pt-2 dark:border-white/10">
                <dt className="text-muted-foreground">Balance</dt>
                <dd className={isBalanced ? 'text-success' : 'text-error'}>
                  {isBalanced ? 'Balanced' : 'Out of balance'}
                </dd>
              </div>
            </div>

            {isDraft && !isBalanced && (
              <Alert variant="lightwarning">
                <AlertTitle>Entry is out of balance</AlertTitle>
                <AlertDescription>
                  Debits and credits must be equal before this entry can be posted.
                  Edit the draft to correct the lines.
                </AlertDescription>
              </Alert>
            )}

            {record.status === 'POSTED' && (
              <p className="text-xs text-muted-foreground">
                Posted entries are read-only. They cannot be edited, voided, or
                reversed through the current API. Record a new adjusting journal
                entry to correct a posted entry.
              </p>
            )}

            {record.status === 'VOID' && (
              <p className="text-xs text-muted-foreground">
                Void entries are read-only and cannot be edited or posted again.
              </p>
            )}
          </div>
        )}

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            aria-label="Close details"
          >
            Close
          </Button>
          {record && isDraft && canWrite && (
            <>
              <Button type="button" onClick={() => onEdit(record)}>
                <Pencil className="size-4" />
                Edit
              </Button>
              <Button
                type="button"
                variant="outlineerror"
                onClick={() => onAction(record, 'void')}
              >
                <Ban className="size-4" />
                Void
              </Button>
              <Button
                type="button"
                variant="success"
                onClick={() => onAction(record, 'post')}
                disabled={!isBalanced}
                title={
                  isBalanced
                    ? 'Post this draft entry'
                    : 'Debits and credits must balance before posting'
                }
              >
                <CheckCircle2 className="size-4" />
                Post
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
