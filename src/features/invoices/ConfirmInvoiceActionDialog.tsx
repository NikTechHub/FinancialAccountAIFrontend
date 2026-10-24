import { useEffect, useRef, useState } from 'react';
import { Alert, AlertDescription, AlertTitle } from 'src/components/ui/alert';
import { Button } from 'src/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from 'src/components/ui/dialog';
import { formatInvoiceAmount, formatInvoiceDate } from './display';
import { getInvoiceErrorMessage } from './errors';
import type { InvoiceAction, InvoiceRecord } from './types';

interface ConfirmInvoiceActionDialogProps {
  open: boolean;
  record: InvoiceRecord | null;
  action: InvoiceAction;
  currency: string;
  onOpenChange: (open: boolean) => void;
  onConfirm: (record: InvoiceRecord, action: InvoiceAction) => Promise<void>;
}

export function ConfirmInvoiceActionDialog({
  open,
  record,
  action,
  currency,
  onOpenChange,
  onConfirm,
}: ConfirmInvoiceActionDialogProps) {
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const submittingRef = useRef(false);

  useEffect(() => {
    if (!open) return;
    setError(null);
    submittingRef.current = false;
    setIsSubmitting(false);
  }, [open, record, action]);

  function handleOpenChange(nextOpen: boolean) {
    if (submittingRef.current) return;
    onOpenChange(nextOpen);
  }

  async function handleConfirm() {
    if (!record || submittingRef.current) return;

    submittingRef.current = true;
    setIsSubmitting(true);
    setError(null);

    try {
      await onConfirm(record, action);
    } catch (confirmError) {
      setError(getInvoiceErrorMessage(confirmError, action));
    } finally {
      submittingRef.current = false;
      setIsSubmitting(false);
    }
  }

  const isIssue = action === 'issue';
  const title = isIssue ? 'Issue this invoice?' : 'Void this draft invoice?';
  const confirmLabel = isIssue ? 'Issue invoice' : 'Void invoice';

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription className="text-muted-foreground">
            {record
              ? `${record.invoiceNumber} · ${record.customerName} · ${formatInvoiceAmount(
                  record.totalAmount,
                  currency,
                )} dated ${formatInvoiceDate(record.invoiceDate)}`
              : 'Choose an invoice to continue.'}
          </DialogDescription>
        </DialogHeader>

        <div className="rounded-lg border border-border p-3 text-sm text-muted-foreground dark:border-white/10">
          {isIssue
            ? 'Issuing posts a journal entry to accounts receivable and revenue. The invoice becomes read-only and cannot be edited or voided.'
            : 'Voiding keeps this draft in history but marks it as void. This action cannot be undone.'}
        </div>

        {error && (
          <Alert variant="lighterror">
            <AlertTitle>
              {isIssue ? 'Unable to issue invoice' : 'Unable to void invoice'}
            </AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => handleOpenChange(false)}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant={isIssue ? 'success' : 'error'}
            onClick={handleConfirm}
            disabled={isSubmitting || !record}
          >
            {isSubmitting
              ? isIssue
                ? 'Issuing...'
                : 'Voiding...'
              : confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
