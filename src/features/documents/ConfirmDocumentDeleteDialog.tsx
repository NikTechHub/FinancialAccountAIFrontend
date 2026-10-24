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
import { getDocumentErrorMessage } from './errors';
import type { DocumentRecord } from './types';

interface ConfirmDocumentDeleteDialogProps {
  open: boolean;
  record: DocumentRecord | null;
  onOpenChange: (open: boolean) => void;
  onConfirm: (record: DocumentRecord) => Promise<void>;
}

export function ConfirmDocumentDeleteDialog({
  open,
  record,
  onOpenChange,
  onConfirm,
}: ConfirmDocumentDeleteDialogProps) {
  const [error, setError] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const deletingRef = useRef(false);

  useEffect(() => {
    if (!open) return;
    setError(null);
    deletingRef.current = false;
    setIsDeleting(false);
  }, [open, record]);

  function handleOpenChange(nextOpen: boolean) {
    if (deletingRef.current) return;
    onOpenChange(nextOpen);
  }

  async function handleConfirm() {
    if (!record || deletingRef.current) return;

    deletingRef.current = true;
    setIsDeleting(true);
    setError(null);

    try {
      await onConfirm(record);
    } catch (deleteError) {
      setError(getDocumentErrorMessage(deleteError, 'delete'));
    } finally {
      deletingRef.current = false;
      setIsDeleting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Delete document?</DialogTitle>
          <DialogDescription className="break-all text-muted-foreground">
            {record?.originalFileName ?? 'This document'} will be permanently removed
            from storage, including its metadata and processing results.
          </DialogDescription>
        </DialogHeader>

        <div className="rounded-lg border border-border p-3 text-sm text-muted-foreground dark:border-white/10">
          This action cannot be undone. The linked invoice or expense is not deleted.
        </div>

        {error && (
          <Alert variant="lighterror">
            <AlertTitle>Unable to delete document</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => handleOpenChange(false)}
            disabled={isDeleting}
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="error"
            onClick={handleConfirm}
            disabled={isDeleting || !record}
          >
            {isDeleting ? 'Deleting...' : 'Delete document'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
