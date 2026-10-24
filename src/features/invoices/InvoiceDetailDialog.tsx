import { useEffect, useState, type ReactNode } from 'react';
import { Ban, Pencil, Send } from 'lucide-react';
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
import { invoiceApi } from './api';
import {
  formatInvoiceAmount,
  formatInvoiceDate,
  formatInvoiceDateTime,
  formatInvoiceNumber,
  invoiceStatusMeta,
} from './display';
import { getInvoiceErrorMessage } from './errors';
import type { InvoiceAction, InvoiceRecord } from './types';

interface InvoiceDetailDialogProps {
  open: boolean;
  invoiceId: string | null;
  currency: string;
  canWrite: boolean;
  onOpenChange: (open: boolean) => void;
  onEdit: (record: InvoiceRecord) => void;
  onAction: (record: InvoiceRecord, action: InvoiceAction) => void;
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

export function InvoiceDetailDialog({
  open,
  invoiceId,
  currency,
  canWrite,
  onOpenChange,
  onEdit,
  onAction,
}: InvoiceDetailDialogProps) {
  const [record, setRecord] = useState<InvoiceRecord | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    if (!open || !invoiceId) {
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
        const data = await invoiceApi.get(invoiceId, controller.signal);
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
        setError(getInvoiceErrorMessage(loadError, 'load'));
      } finally {
        if (active) setLoading(false);
      }
    })();

    return () => {
      active = false;
      controller.abort();
    };
  }, [open, invoiceId, reloadKey]);

  const status = record ? invoiceStatusMeta[record.status] : null;
  const isDraft = record?.status === 'DRAFT';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex flex-wrap items-center gap-2">
            <DialogTitle>
              {record ? `Invoice ${record.invoiceNumber}` : 'Invoice details'}
            </DialogTitle>
            {status && <Badge variant={status.variant}>{status.label}</Badge>}
          </div>
          <DialogDescription className="text-muted-foreground">
            View the invoice, line items, and accounting status from the server.
          </DialogDescription>
        </DialogHeader>

        {loading && (
          <div role="status" className="space-y-3">
            <span className="sr-only">Loading invoice details...</span>
            <Skeleton className="h-6 w-56" />
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-40 w-full" />
          </div>
        )}

        {!loading && error && (
          <Alert variant="lighterror">
            <AlertTitle>Unable to load invoice</AlertTitle>
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
            No invoice was selected.
          </p>
        )}

        {!loading && !error && record && (
          <div className="space-y-6">
            <dl className="grid gap-4 rounded-lg border border-border p-4 sm:grid-cols-2 lg:grid-cols-3 dark:border-white/10">
              <DetailItem label="Customer">{record.customerName}</DetailItem>
              <DetailItem label="Invoice date">
                {formatInvoiceDate(record.invoiceDate)}
              </DetailItem>
              <DetailItem label="Due date">
                {record.dueDate ? formatInvoiceDate(record.dueDate) : 'Not set'}
              </DetailItem>
              <DetailItem label="Organization">
                {record.organizationName}
              </DetailItem>
              <DetailItem label="Created by">
                {record.createdByEmail}
              </DetailItem>
              <DetailItem label="Created">
                {formatInvoiceDateTime(record.createdAt)}
              </DetailItem>
              <DetailItem label="Last updated">
                {formatInvoiceDateTime(record.updatedAt)}
              </DetailItem>
              <DetailItem label="Journal entry">
                {record.journalEntryId ? (
                  <span className="break-all font-mono text-xs">
                    {record.journalEntryId}
                  </span>
                ) : (
                  'Not posted'
                )}
              </DetailItem>
            </dl>

            <div>
              <h6 className="mb-3 font-semibold">Line items</h6>
              <div className="overflow-x-auto rounded-lg border border-border dark:border-white/10">
                <Table aria-label="Invoice line items">
                  <TableHeader>
                    <TableRow>
                      <TableHead className="min-w-[180px]">Description</TableHead>
                      <TableHead className="min-w-[160px]">Revenue account</TableHead>
                      <TableHead className="text-right">Quantity</TableHead>
                      <TableHead className="text-right">Unit price</TableHead>
                      <TableHead className="text-right">Tax</TableHead>
                      <TableHead className="text-right">Discount</TableHead>
                      <TableHead className="text-right">Line total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {record.lines.map((line) => (
                      <TableRow key={line.id}>
                        <TableCell className="whitespace-normal break-words">
                          {line.description || 'No description'}
                        </TableCell>
                        <TableCell>
                          <p>{line.revenueAccountName}</p>
                          <p className="text-xs text-muted-foreground">
                            {line.revenueAccountCode}
                          </p>
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {formatInvoiceNumber(line.quantity)}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {formatInvoiceAmount(line.unitPrice, currency)}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {formatInvoiceNumber(line.taxRate)}%
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {formatInvoiceAmount(line.discountAmount, currency)}
                        </TableCell>
                        <TableCell className="text-right font-medium tabular-nums">
                          {formatInvoiceAmount(line.lineTotal, currency)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-4">
                {record.notes && (
                  <div>
                    <h6 className="text-sm font-semibold">Notes</h6>
                    <p className="mt-1 whitespace-pre-wrap text-sm text-muted-foreground">
                      {record.notes}
                    </p>
                  </div>
                )}
                {record.terms && (
                  <div>
                    <h6 className="text-sm font-semibold">Terms</h6>
                    <p className="mt-1 whitespace-pre-wrap text-sm text-muted-foreground">
                      {record.terms}
                    </p>
                  </div>
                )}
              </div>

              <dl className="ml-auto w-full max-w-sm space-y-2 rounded-lg border border-border p-4 text-sm dark:border-white/10">
                <div className="flex justify-between gap-4">
                  <dt className="text-muted-foreground">Subtotal</dt>
                  <dd className="tabular-nums">
                    {formatInvoiceAmount(record.subtotal, currency)}
                  </dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-muted-foreground">Discount</dt>
                  <dd className="tabular-nums">
                    {formatInvoiceAmount(record.discountAmount, currency)}
                  </dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-muted-foreground">Tax</dt>
                  <dd className="tabular-nums">
                    {formatInvoiceAmount(record.taxAmount, currency)}
                  </dd>
                </div>
                <div className="flex justify-between gap-4 border-t border-border pt-2 font-semibold dark:border-white/10">
                  <dt>Total</dt>
                  <dd className="tabular-nums">
                    {formatInvoiceAmount(record.totalAmount, currency)}
                  </dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-muted-foreground">Amount paid</dt>
                  <dd className="tabular-nums">
                    {formatInvoiceAmount(record.amountPaid, currency)}
                  </dd>
                </div>
                <div className="flex justify-between gap-4 border-t border-border pt-2 font-semibold dark:border-white/10">
                  <dt>Balance due</dt>
                  <dd className="tabular-nums">
                    {formatInvoiceAmount(record.balanceDue, currency)}
                  </dd>
                </div>
              </dl>
            </div>

            <p className="text-xs text-muted-foreground">
              Payment recording is not available through the current API.
              Amount paid and balance due are shown as reported by the server.
            </p>

            {record.status !== 'DRAFT' && canWrite && (
              <p className="text-xs text-muted-foreground">
                Only draft invoices can be edited, issued, or voided.
              </p>
            )}
          </div>
        )}

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            Close
          </Button>
          {record && isDraft && canWrite && (
            <>
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
                onClick={() => onAction(record, 'issue')}
              >
                <Send className="size-4" />
                Issue
              </Button>
              <Button type="button" onClick={() => onEdit(record)}>
                <Pencil className="size-4" />
                Edit
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
