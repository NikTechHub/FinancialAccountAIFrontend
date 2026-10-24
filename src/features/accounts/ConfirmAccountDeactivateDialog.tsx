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
import { getAccountErrorMessage } from './errors';
import type { AccountRecord } from './types';

interface ConfirmAccountDeactivateDialogProps {
  open: boolean;
  record: AccountRecord | null;
  onOpenChange: (open: boolean) => void;
  onConfirm: (record: AccountRecord) => Promise<void>;
}

export function ConfirmAccountDeactivateDialog({
  open,
  record,
  onOpenChange,
  onConfirm,
}: ConfirmAccountDeactivateDialogProps) {
  const [error, setError] = useState<string | null>(null);
  const [isDeactivating, setIsDeactivating] = useState(false);
  const deactivatingRef = useRef(false);

  useEffect(() => {
    if (!open) return;
    setError(null);
    deactivatingRef.current = false;
    setIsDeactivating(false);
  }, [open, record]);

  function handleOpenChange(nextOpen: boolean) {
    if (deactivatingRef.current) return;
    onOpenChange(nextOpen);
  }

  async function handleConfirm() {
    if (!record || deactivatingRef.current) return;

    deactivatingRef.current = true;
    setIsDeactivating(true);
    setError(null);

    try {
      await onConfirm(record);
    } catch (confirmError) {
      setError(getAccountErrorMessage(confirmError, 'deactivate'));
    } finally {
      deactivatingRef.current = false;
      setIsDeactivating(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Deactivate account?</DialogTitle>
          <DialogDescription className="text-muted-foreground">
            {record ? `"${record.code} — ${record.name}"` : 'This account'} will
            be removed from the active chart of accounts. Existing invoices and
            journal entries will keep their references, and this screen does not
            offer a restore action.
          </DialogDescription>
        </DialogHeader>

        {error && (
          <Alert variant="lighterror">
            <AlertTitle>Unable to deactivate account</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => handleOpenChange(false)}
            disabled={isDeactivating}
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="error"
            onClick={handleConfirm}
            disabled={isDeactivating}
          >
            {isDeactivating ? 'Deactivating...' : 'Deactivate account'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
