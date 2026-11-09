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
import { getJournalEntryErrorMessage } from './errors';
import type { JournalEntryRecord } from './types';

interface ConfirmJournalActionDialogProps {
  open: boolean;
  record: JournalEntryRecord | null;
  action: 'post' | 'void';
  onOpenChange: (open: boolean) => void;
  onConfirm: (record: JournalEntryRecord, action: 'post' | 'void') => Promise<void>;
}

export function ConfirmJournalActionDialog({
  open,
  record,
  action,
  onOpenChange,
  onConfirm,
}: ConfirmJournalActionDialogProps) {
  const [error, setError] = useState<string | null>(null);
  const [isWorking, setIsWorking] = useState(false);
  const workingRef = useRef(false);

  useEffect(() => {
    if (!open) return;
    setError(null);
    workingRef.current = false;
    setIsWorking(false);
  }, [open, record, action]);

  function handleOpenChange(nextOpen: boolean) {
    if (workingRef.current) return;
    onOpenChange(nextOpen);
  }

  async function handleConfirm() {
    if (!record || workingRef.current) return;
    workingRef.current = true;
    setIsWorking(true);
    setError(null);
    try {
      await onConfirm(record, action);
    } catch (confirmError) {
      setError(getJournalEntryErrorMessage(confirmError, action));
    } finally {
      workingRef.current = false;
      setIsWorking(false);
    }
  }

  const title =
    action === 'post' ? 'Post journal entry?' : 'Void journal entry?';
  const description =
    action === 'post'
      ? record
        ? `Posting "${record.entryNumber}" will finalize it and make it read-only.`
        : 'Posting will finalize the entry.'
      : record
        ? `Voiding "${record.entryNumber}" will mark it as void. This cannot be undone.`
        : 'Voiding will mark the entry as void.';

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription className="text-muted-foreground">
            {description}
          </DialogDescription>
        </DialogHeader>

        {error && (
          <Alert variant="lighterror">
            <AlertTitle>Unable to {action}</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => handleOpenChange(false)}
            disabled={isWorking}
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant={action === 'post' ? 'default' : 'error'}
            onClick={handleConfirm}
            disabled={isWorking}
          >
            {isWorking
              ? action === 'post'
                ? 'Posting...'
                : 'Voiding...'
              : action === 'post'
                ? 'Post entry'
                : 'Void entry'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
