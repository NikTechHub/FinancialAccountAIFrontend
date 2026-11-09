import { Alert, AlertDescription, AlertTitle } from 'src/components/ui/alert';
import { Badge } from 'src/components/ui/badge';
import { Button } from 'src/components/ui/button';
import type {
  DocumentExtraction,
  DocumentRecord,
  OcrResult,
  ProcessingStatus,
} from './types';
import { StructuredDataView } from './StructuredDataView';
import { extractionModelNotice, formatConfidence, parseStructuredData } from './validation';

interface DocumentProcessingPanelProps {
  document: DocumentRecord;
  ocr: OcrResult | null;
  extraction: DocumentExtraction | null;
  canWrite: boolean;
  ocrQueued: boolean;
  extractionQueued: boolean;
  pollingPaused: boolean;
  organizationCurrency: string;
  action: string | null;
  onStartOcr: () => Promise<boolean>;
  onStartExtraction: () => Promise<boolean>;
  onRefresh: () => void;
}

const statusLabels: Record<ProcessingStatus, string> = {
  PENDING: 'Pending',
  PROCESSING: 'Processing',
  COMPLETED: 'Completed',
  FAILED: 'Failed',
};

const statusVariants: Record<
  ProcessingStatus,
  'gray' | 'lightWarning' | 'lightSuccess' | 'lightError'
> = {
  PENDING: 'gray',
  PROCESSING: 'lightWarning',
  COMPLETED: 'lightSuccess',
  FAILED: 'lightError',
};

function formatDateTime(value: string | null) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
}

export function DocumentProcessingPanel({
  document,
  ocr,
  extraction,
  canWrite,
  ocrQueued,
  extractionQueued,
  pollingPaused,
  organizationCurrency,
  action,
  onStartOcr,
  onStartExtraction,
  onRefresh,
}: DocumentProcessingPanelProps) {
  const busy = action !== null;
  const ocrStatus =
    ocr?.status ??
    (document.status === 'PROCESSING' || ocrQueued ? 'PENDING' : null);
  const canStartOcr =
    canWrite &&
    !ocr &&
    !ocrQueued &&
    document.status !== 'PROCESSING';
  const canStartExtraction =
    canWrite &&
    ocr?.status === 'COMPLETED' &&
    extraction === null &&
    !extractionQueued;
  const modelNotice = extraction
    ? extractionModelNotice(extraction.model)
    : null;

  return (
    <div className="space-y-5">
      <p className="text-xs text-muted-foreground">
        Processing runs asynchronously on the server. This page checks for updates
        automatically while work is active.
      </p>
      {pollingPaused && (
        <Alert variant="lightwarning">
          <AlertTitle>Processing status has not changed</AlertTitle>
          <AlertDescription className="flex flex-wrap items-center justify-between gap-3">
            <span>The worker has not reported a completed or failed state after several minutes. Refresh the saved status; if it remains pending, ask an administrator to check Kafka and the processing worker before retrying.</span>
            <Button type="button" variant="outline" size="sm" onClick={onRefresh}>Refresh status</Button>
          </AlertDescription>
        </Alert>
      )}

      <section className="rounded-lg border border-border p-4 dark:border-white/10">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h4 className="font-semibold">OCR</h4>
            <p className="mt-1 text-sm text-muted-foreground">
              Extracts text from the stored document.
            </p>
          </div>
          {ocrStatus && (
            <Badge variant={statusVariants[ocrStatus]}>{statusLabels[ocrStatus]}</Badge>
          )}
        </div>

        {!ocr && ocrQueued && (
          <p role="status" className="mt-3 text-sm text-muted-foreground">
            OCR request accepted. Waiting for the processing record to appear.
          </p>
        )}

        {!ocr && !ocrQueued && document.status !== 'PROCESSING' && (
          <div className="mt-3 space-y-3">
            <p className="text-sm text-muted-foreground">
              {document.status === 'FAILED'
                ? 'Document processing failed. You can retry OCR.'
                : 'OCR has not been started for this document.'}
            </p>
            {canWrite ? (
              <Button
                type="button"
                size="sm"
                onClick={() => void onStartOcr()}
                disabled={busy || !canStartOcr}
              >
                {action === 'ocr' ? 'Queueing OCR...' : 'Run OCR'}
              </Button>
            ) : (
              <p className="text-sm text-muted-foreground">
                A user with write access can start OCR.
              </p>
            )}
          </div>
        )}

        {!ocr && !ocrQueued && document.status === 'PROCESSING' && (
          <p role="status" className="mt-3 text-sm text-muted-foreground">
            OCR is queued or processing. The status will update automatically.
          </p>
        )}

        {ocr && (
          <div className="mt-3 space-y-3">
            {ocr.status === 'PENDING' && (
              <p role="status" className="text-sm text-muted-foreground">
                OCR is queued. Waiting for the worker to start processing.
              </p>
            )}
            {ocr.status === 'PROCESSING' && (
              <p role="status" className="text-sm text-muted-foreground">
                OCR is processing. This page will update automatically.
              </p>
            )}
            {ocrQueued && (
              <p role="status" className="text-sm text-muted-foreground">
                OCR request accepted. Waiting for the updated processing status.
              </p>
            )}
            <div className="flex flex-wrap gap-x-6 gap-y-1 text-xs text-muted-foreground">
              <span>Started: {formatDateTime(ocr.processingStartedAt)}</span>
              <span>Completed: {formatDateTime(ocr.processingCompletedAt)}</span>
              {ocr.pageCount !== null && <span>Pages: {ocr.pageCount}</span>}
            </div>

            {ocr.errorMessage && (
              <Alert variant="lighterror">
                <AlertTitle>OCR failed</AlertTitle>
                <AlertDescription>{ocr.errorMessage}</AlertDescription>
              </Alert>
            )}

            {ocr.status === 'FAILED' && canWrite && (
              <Button
                type="button"
                variant="outlineerror"
                size="sm"
                onClick={() => void onStartOcr()}
                disabled={busy || ocrQueued}
              >
                {ocrQueued
                  ? 'Waiting for OCR status...'
                  : action === 'ocr'
                    ? 'Queueing OCR...'
                    : 'Retry OCR'}
              </Button>
            )}

            {ocr.status === 'COMPLETED' && (
              <details className="rounded-md bg-muted/50 p-3">
                <summary className="cursor-pointer text-sm font-medium">
                  View extracted text
                </summary>
                <pre className="mt-2 max-h-72 overflow-auto whitespace-pre-wrap break-words text-xs">
                  {ocr.extractedText || 'No text was extracted.'}
                </pre>
              </details>
            )}
          </div>
        )}
      </section>

      <section className="rounded-lg border border-border p-4 dark:border-white/10">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h4 className="font-semibold">AI data extraction</h4>
            <p className="mt-1 text-sm text-muted-foreground">
              Suggests structured invoice or receipt fields from the OCR text.
            </p>
          </div>
          {extraction && (
            <Badge variant={statusVariants[extraction.status]}>
              {statusLabels[extraction.status]}
            </Badge>
          )}
        </div>

        {ocr?.status !== 'COMPLETED' && !extraction && (
          <p className="mt-3 text-sm text-muted-foreground">
            Extraction becomes available after OCR completes.
          </p>
        )}

        {ocr?.status === 'COMPLETED' && !extraction && (
          <div className="mt-3 space-y-3">
            <p className="text-sm text-muted-foreground">
              Waiting for extraction. It is normally queued automatically after OCR.
            </p>
            {extractionQueued && (
              <p role="status" className="text-sm text-muted-foreground">
                Extraction request accepted. Waiting for the processing record to
                appear.
              </p>
            )}
            {canStartExtraction && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => void onStartExtraction()}
                disabled={busy || !canStartExtraction}
              >
                {action === 'extraction' ? 'Queueing extraction...' : 'Queue extraction'}
              </Button>
            )}
          </div>
        )}

        {extraction && (
          <div className="mt-3 space-y-3">
            {extraction.status === 'PENDING' && (
              <p role="status" className="text-sm text-muted-foreground">
                Extraction is queued. Waiting for the worker to start processing.
              </p>
            )}
            {extraction.status === 'PROCESSING' && (
              <p role="status" className="text-sm text-muted-foreground">
                Extraction is processing. This page will update automatically.
              </p>
            )}
            <div className="flex flex-wrap gap-x-6 gap-y-1 text-xs text-muted-foreground">
              <span>Model: {extraction.model || '—'}</span>
              <span>Prompt: {extraction.promptVersion || '—'}</span>
              <span>Completed: {formatDateTime(extraction.processingCompletedAt)}</span>
              <span>Confidence: {formatConfidence(extraction.confidence) ?? '—'}</span>
            </div>

            {modelNotice && (
              <Alert variant="lightwarning">
                <AlertTitle>Backend-reported extraction model</AlertTitle>
                <AlertDescription>{modelNotice}</AlertDescription>
              </Alert>
            )}

            {extraction.errorMessage && (
              <Alert variant="lighterror">
                <AlertTitle>Extraction failed</AlertTitle>
                <AlertDescription>{extraction.errorMessage}</AlertDescription>
              </Alert>
            )}

            {extraction.status === 'FAILED' && canWrite && ocr?.status === 'COMPLETED' && (
              <Button
                type="button"
                variant="outlineerror"
                size="sm"
                onClick={() => void onStartExtraction()}
                disabled={busy || extractionQueued}
              >
                {extractionQueued
                  ? 'Waiting for extraction status...'
                  : action === 'extraction'
                    ? 'Queueing extraction...'
                    : 'Retry extraction'}
              </Button>
            )}

            {extraction.status === 'COMPLETED' && (
              <div>
                {(() => {
                  const documentCurrency = parseStructuredData(extraction.structuredData)?.currency;
                  return documentCurrency && documentCurrency.toUpperCase() !== organizationCurrency.toUpperCase() ? (
                    <Alert variant="lightwarning" className="mb-3">
                      <AlertTitle>Document currency differs from organization base currency</AlertTitle>
                      <AlertDescription>{documentCurrency} is preserved from the document; it is not converted to {organizationCurrency}. Verify the currency before approving the review.</AlertDescription>
                    </Alert>
                  ) : null;
                })()}
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <h5 className="text-sm font-semibold">AI extraction suggestion</h5>
                  <Badge variant="lightInfo">Not accounting data</Badge>
                </div>
                <p className="mb-3 text-xs text-muted-foreground">
                  These values are model suggestions and may be incorrect. They are not
                  an approved invoice or expense.
                </p>
                <StructuredDataView
                  data={extraction.structuredData}
                  label="AI extraction suggestion"
                />
              </div>
            )}
          </div>
        )}
      </section>
    </div>
  );
}
