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
import { getPartyErrorMessage } from './errors';
import type { PartyLabels, PartyRecord } from './types';

interface ConfirmDeactivateDialogProps {
  open: boolean;
  record: PartyRecord | null;
  labels: PartyLabels;
  onOpenChange: (open: boolean) => void;
  onConfirm: (record: PartyRecord) => Promise<void>;
}

export function ConfirmDeactivateDialog({
  open,
  record,
  labels,
  onOpenChange,
  onConfirm,
}: ConfirmDeactivateDialogProps) {
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
      setError(getPartyErrorMessage(confirmError, labels, 'deactivate'));
    } finally {
      deactivatingRef.current = false;
      setIsDeactivating(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Deactivate {labels.lowerSingular}?</DialogTitle>
          <DialogDescription className="text-muted-foreground">
            {record ? `"${record.name}"` : `This ${labels.lowerSingular}`} will be hidden
            from active {labels.lowerPlural} lists. Existing records will not be deleted.
          </DialogDescription>
        </DialogHeader>

        {error && (
          <Alert variant="lighterror">
            <AlertTitle>Unable to deactivate {labels.lowerSingular}</AlertTitle>
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
          <Button type="button" variant="error" onClick={handleConfirm} disabled={isDeactivating}>
            {isDeactivating ? 'Deactivating...' : 'Deactivate'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
