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
import { getExpenseErrorMessage } from './errors';
import type { ExpenseAction, ExpenseRecord } from './types';
import { formatMoney } from 'src/features/money/format';

interface ConfirmExpenseActionDialogProps {
  open: boolean;
  record: ExpenseRecord | null;
  action: ExpenseAction;
  currency: string;
  onOpenChange: (open: boolean) => void;
  onConfirm: (record: ExpenseRecord, action: ExpenseAction) => Promise<void>;
}

function formatAmount(value: number, currency: string) {
  return formatMoney(value, currency);
}

export function ConfirmExpenseActionDialog({
  open,
  record,
  action,
  currency,
  onOpenChange,
  onConfirm,
}: ConfirmExpenseActionDialogProps) {
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
      setError(getExpenseErrorMessage(confirmError, action));
    } finally {
      submittingRef.current = false;
      setIsSubmitting(false);
    }
  }

  const isRecord = action === 'record';
  const title = isRecord ? 'Record this expense?' : 'Void this draft expense?';
  const confirmLabel = isRecord ? 'Record expense' : 'Void expense';

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription className="text-muted-foreground">
            {record
              ? `${record.vendorName ?? 'No vendor'} · ${formatAmount(record.amount, currency)} on ${record.expenseDate}`
              : 'Choose an expense to continue.'}
          </DialogDescription>
        </DialogHeader>

        <div className="rounded-lg border border-border p-3 text-sm text-muted-foreground dark:border-white/10">
          {isRecord
            ? 'Recording posts an irreversible journal entry using the selected expense and payment accounts. The expense can no longer be edited or voided.'
            : 'Voiding keeps the expense in history but removes it from consideration as a draft. This action cannot be undone.'}
        </div>

        {error && (
          <Alert variant="lighterror">
            <AlertTitle>{isRecord ? 'Unable to record expense' : 'Unable to void expense'}</AlertTitle>
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
            variant={isRecord ? 'success' : 'error'}
            onClick={handleConfirm}
            disabled={isSubmitting || !record}
          >
            {isSubmitting
              ? isRecord
                ? 'Recording...'
                : 'Voiding...'
              : confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
