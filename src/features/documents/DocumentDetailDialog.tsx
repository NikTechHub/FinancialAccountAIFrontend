import { useId } from 'react';
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
import type {
  DocumentRecord,
  DocumentStatus,
  DocumentType,
  StructuredExtractionData,
} from './types';
import { DocumentProcessingPanel } from './DocumentProcessingPanel';
import { DocumentReviewPanel } from './DocumentReviewPanel';
import { useDocumentProcessing } from './useDocumentProcessing';
import { formatFileSize } from './validation';

interface DocumentDetailDialogProps {
  open: boolean;
  record: DocumentRecord | null;
  currency: string;
  canWrite: boolean;
  isDownloading: boolean;
  onOpenChange: (open: boolean) => void;
  onDownload: (record: DocumentRecord) => void;
}

const typeLabels: Record<DocumentType, string> = {
  INVOICE: 'Invoice',
  RECEIPT: 'Receipt',
  EXPENSE_RECEIPT: 'Expense receipt',
  OTHER: 'Other',
};

const statusLabels: Record<DocumentStatus, string> = {
  UPLOADED: 'Uploaded',
  PROCESSING: 'Processing',
  PROCESSED: 'Processed',
  FAILED: 'Failed',
};

const statusVariants: Record<
  DocumentStatus,
  'gray' | 'lightWarning' | 'lightSuccess' | 'lightError'
> = {
  UPLOADED: 'gray',
  PROCESSING: 'lightWarning',
  PROCESSED: 'lightSuccess',
  FAILED: 'lightError',
};

function formatDateTime(value: string | null | undefined) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
}

function MetaItem({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </dt>
      <dd className="mt-1 break-words text-sm">{children}</dd>
    </div>
  );
}

export function DocumentDetailDialog({
  open,
  record,
  currency,
  canWrite,
  isDownloading,
  onOpenChange,
  onDownload,
}: DocumentDetailDialogProps) {
  const id = useId();
  const processing = useDocumentProcessing({
    documentId: record?.id ?? null,
    open,
  });
  const document = processing.document ?? record;

  async function handleSaveReview(data: StructuredExtractionData) {
    return processing.saveReview(data);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Document details</DialogTitle>
          <DialogDescription className="break-all text-muted-foreground">
            {document?.originalFileName ?? 'Loading document...'}
          </DialogDescription>
        </DialogHeader>

        {processing.actionNotice && (
          <Alert variant="lightsuccess">
            <AlertTitle>{processing.actionNotice}</AlertTitle>
            <AlertDescription className="mt-2 flex items-center justify-between gap-3">
              <span>The document view will refresh automatically.</span>
              <Button
                type="button"
                variant="ghostsuccess"
                size="sm"
                onClick={() => processing.setActionNotice(null)}
              >
                Dismiss
              </Button>
            </AlertDescription>
          </Alert>
        )}

        {processing.actionError && (
          <Alert variant="lighterror">
            <AlertTitle>Document action failed</AlertTitle>
            <AlertDescription>{processing.actionError}</AlertDescription>
          </Alert>
        )}

        {processing.error && (
          <Alert variant="lighterror">
            <AlertTitle>Unable to load document details</AlertTitle>
            <AlertDescription>
              <p>{processing.error}</p>
              <Button
                type="button"
                variant="outlineerror"
                size="sm"
                className="mt-3"
                onClick={processing.reload}
              >
                Try again
              </Button>
            </AlertDescription>
          </Alert>
        )}

        {processing.loading && !document && (
          <div className="space-y-3" role="status" aria-label="Loading document details">
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-48 w-full" />
          </div>
        )}

        {document && (
          <div className="space-y-5">
            <section
              aria-label="Document overview"
              className="rounded-lg border border-border p-4 dark:border-white/10"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h3 className="font-semibold">Overview</h3>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Document {document.id}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={statusVariants[document.status]}>
                    {statusLabels[document.status]}
                  </Badge>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => onDownload(document)}
                    disabled={isDownloading}
                  >
                    {isDownloading ? 'Downloading...' : 'Download file'}
                  </Button>
                </div>
              </div>

              <dl className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <MetaItem label="Type">{typeLabels[document.documentType]}</MetaItem>
                <MetaItem label="File size">{formatFileSize(document.fileSize)}</MetaItem>
                <MetaItem label="Content type">{document.contentType}</MetaItem>
                <MetaItem label="Uploaded">{formatDateTime(document.createdAt)}</MetaItem>
                <MetaItem label="Updated">{formatDateTime(document.updatedAt)}</MetaItem>
                <MetaItem label="Linked record">
                  {document.expenseId
                    ? `Expense ${document.expenseId}`
                    : document.invoiceId
                      ? `Invoice ${document.invoiceId}`
                      : 'Not linked'}
                </MetaItem>
                <div className="sm:col-span-2 lg:col-span-3">
                  <MetaItem label="SHA-256 checksum">
                    <span className="break-all font-mono text-xs">{document.checksum}</span>
                  </MetaItem>
                </div>
              </dl>
              <p className="mt-3 text-xs text-muted-foreground">
                Organization currency: {currency}. Document status is reported by the
                backend; no processing step is inferred by this page.
              </p>
            </section>

            <section aria-labelledby={`${id}-processing`}>
              <h3 id={`${id}-processing`} className="mb-3 font-semibold">
                Processing
              </h3>
              <DocumentProcessingPanel
                document={document}
                ocr={processing.ocr}
                extraction={processing.extraction}
                canWrite={canWrite}
                ocrQueued={processing.ocrQueued}
                extractionQueued={processing.extractionQueued}
                action={processing.action}
                onStartOcr={processing.startOcr}
                onStartExtraction={processing.startExtraction}
              />
            </section>

            <section aria-labelledby={`${id}-review`}>
              <h3 id={`${id}-review`} className="mb-3 font-semibold">
                Human review
              </h3>
              <DocumentReviewPanel
                extraction={processing.extraction}
                review={processing.review}
                canWrite={canWrite}
                action={processing.action}
                onCreate={processing.createReview}
                onSave={handleSaveReview}
                onApprove={processing.approveReview}
                onReject={processing.rejectReview}
                onReopen={processing.reopenReview}
              />
            </section>
          </div>
        )}

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
