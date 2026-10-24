import { useEffect, useState } from 'react';
import { Alert, AlertDescription, AlertTitle } from 'src/components/ui/alert';
import { Badge } from 'src/components/ui/badge';
import { Button } from 'src/components/ui/button';
import { Input } from 'src/components/ui/input';
import { Label } from 'src/components/ui/label';
import { Textarea } from 'src/components/ui/textarea';
import type { DocumentExtraction, DocumentReview } from './types';
import {
  lineItemsFromReview,
  parseStructuredData,
  reviewFormFromReview,
  structuredToForm,
  toReviewedData,
  validateReviewForm,
  type ReviewFormErrors,
} from './validation';
import { StructuredDataView } from './StructuredDataView';

interface DocumentReviewPanelProps {
  extraction: DocumentExtraction | null;
  review: DocumentReview | null;
  canWrite: boolean;
  action: string | null;
  onCreate: () => Promise<boolean>;
  onSave: (data: ReturnType<typeof toReviewedData>) => Promise<boolean>;
  onApprove: (comment: string) => Promise<boolean>;
  onReject: (comment: string) => Promise<boolean>;
  onReopen: () => Promise<boolean>;
}

const statusLabels = {
  PENDING: 'Pending review',
  APPROVED: 'Approved',
  REJECTED: 'Rejected',
} as const;

const statusVariants = {
  PENDING: 'lightWarning',
  APPROVED: 'lightSuccess',
  REJECTED: 'lightError',
} as const;

function ReviewField({
  id,
  label,
  value,
  error,
  onChange,
  type = 'text',
  maxLength,
}: {
  id: string;
  label: string;
  value: string;
  error?: string;
  onChange: (value: string) => void;
  type?: string;
  maxLength?: number;
}) {
  return (
    <div>
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        maxLength={maxLength}
        variant={error ? 'failure' : 'default'}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-error` : undefined}
        className="mt-2"
      />
      {error && (
        <p id={`${id}-error`} className="mt-1 text-sm text-error">
          {error}
        </p>
      )}
    </div>
  );
}

export function DocumentReviewPanel({
  extraction,
  review,
  canWrite,
  action,
  onCreate,
  onSave,
  onApprove,
  onReject,
  onReopen,
}: DocumentReviewPanelProps) {
  const [values, setValues] = useState(() => structuredToForm(null));
  const [fieldErrors, setFieldErrors] = useState<ReviewFormErrors>({});
  const [comment, setComment] = useState('');

  useEffect(() => {
    if (!review) {
      setValues(structuredToForm(null));
      setComment('');
      setFieldErrors({});
      return;
    }
    setValues(reviewFormFromReview(review));
    setComment(review.reviewComment ?? '');
    setFieldErrors({});
  }, [review]);

  if (!extraction || extraction.status !== 'COMPLETED') {
    if (extraction?.status === 'FAILED') {
      return (
        <p className="text-sm text-muted-foreground">
          Review becomes available after extraction succeeds.
        </p>
      );
    }
    return (
      <p className="text-sm text-muted-foreground">
        Review becomes available after OCR and data extraction complete.
      </p>
    );
  }

  if (!review) {
    return (
      <div className="space-y-3">
        <p className="text-sm text-muted-foreground">
          Extraction is complete. Start a human review to compare and correct the
          AI-suggested values before approval.
        </p>
        {canWrite ? (
          <Button
            type="button"
            onClick={() => void onCreate()}
            disabled={action !== null}
          >
            {action === 'create-review' ? 'Starting review...' : 'Start review'}
          </Button>
        ) : (
          <Alert variant="lightinfo">
            <AlertTitle>Read-only access</AlertTitle>
            <AlertDescription>
              A reviewer with write access must start and approve the review.
            </AlertDescription>
          </Alert>
        )}
      </div>
    );
  }

  const parsedReviewed = parseStructuredData(review.reviewedData);
  const parsedOriginal = parseStructuredData(review.originalAiData);
  const dataForComparison = parsedReviewed
    ? structuredToForm(parsedReviewed)
    : parsedOriginal
      ? structuredToForm(parsedOriginal)
      : structuredToForm(null);
  const isDirty = JSON.stringify(values) !== JSON.stringify(dataForComparison);
  const isEditable =
    canWrite &&
    (review.status === 'PENDING' || review.status === 'REJECTED') &&
    Boolean(parsedReviewed ?? parsedOriginal);
  const canDecide = review.status === 'PENDING' && !isDirty;
  const busy = action !== null;

  function updateField(field: keyof typeof values, value: string) {
    setValues((current) => ({ ...current, [field]: value }));
    setFieldErrors((current) => {
      if (!current[field]) return current;
      const next = { ...current };
      delete next[field];
      return next;
    });
  }

  async function handleSave() {
    if (!isEditable || !review) return;
    const errors = validateReviewForm(values);
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) return;
    await onSave(toReviewedData(values, lineItemsFromReview(review)));
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant={statusVariants[review.status]}>
          {statusLabels[review.status]}
        </Badge>
        {review.reviewedBy && (
          <span className="text-xs text-muted-foreground">
            {review.reviewedBy.firstName} {review.reviewedBy.lastName} ·{' '}
            {review.reviewedBy.email}
          </span>
        )}
        {review.reviewedAt && (
          <span className="text-xs text-muted-foreground">
            {new Date(review.reviewedAt).toLocaleString()}
          </span>
        )}
      </div>

      {review.status === 'APPROVED' && (
        <Alert variant="lightsuccess">
          <AlertTitle>Approved review data</AlertTitle>
          <AlertDescription>
            Approved data is retained for audit. Approval does not create an invoice
            or post an expense.
            {review.reviewComment && (
              <span className="mt-2 block">Comment: {review.reviewComment}</span>
            )}
          </AlertDescription>
        </Alert>
      )}

      {review.status === 'REJECTED' && (
        <Alert variant="lighterror">
          <AlertTitle>Review rejected</AlertTitle>
          <AlertDescription>
            {review.reviewComment || 'No rejection comment was provided.'}
          </AlertDescription>
        </Alert>
      )}

      {!isEditable && (
        <div>
          <h4 className="mb-2 text-sm font-semibold">Review data</h4>
          <StructuredDataView data={review.reviewedData} label="Review data" />
        </div>
      )}

      {isEditable && (
        <>
          <Alert variant="lightinfo">
            <AlertTitle>Human review copy</AlertTitle>
            <AlertDescription>
              The form starts from a copy of the AI suggestion. Line items are preserved
              read-only when you save corrections to header fields.
            </AlertDescription>
          </Alert>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <ReviewField
              id="review-document-type"
              label="Document type"
              value={values.documentType}
              onChange={(value) => updateField('documentType', value)}
            />
            <ReviewField
              id="review-invoice-number"
              label="Invoice number"
              value={values.invoiceNumber}
              error={fieldErrors.invoiceNumber}
              maxLength={100}
              onChange={(value) => updateField('invoiceNumber', value)}
            />
            <ReviewField
              id="review-currency"
              label="Currency"
              value={values.currency}
              error={fieldErrors.currency}
              maxLength={3}
              onChange={(value) => updateField('currency', value)}
            />
            <ReviewField
              id="review-invoice-date"
              label="Invoice date"
              type="date"
              value={values.invoiceDate}
              error={fieldErrors.invoiceDate}
              onChange={(value) => updateField('invoiceDate', value)}
            />
            <ReviewField
              id="review-due-date"
              label="Due date"
              type="date"
              value={values.dueDate}
              error={fieldErrors.dueDate}
              onChange={(value) => updateField('dueDate', value)}
            />
            <ReviewField
              id="review-payment-terms"
              label="Payment terms"
              value={values.paymentTerms}
              onChange={(value) => updateField('paymentTerms', value)}
            />
            <ReviewField
              id="review-vendor-name"
              label="Vendor"
              value={values.vendorName}
              onChange={(value) => updateField('vendorName', value)}
            />
            <ReviewField
              id="review-vendor-tax"
              label="Vendor tax ID"
              value={values.vendorTaxIdentifier}
              onChange={(value) => updateField('vendorTaxIdentifier', value)}
            />
            <ReviewField
              id="review-vendor-email"
              label="Vendor email"
              type="email"
              value={values.vendorEmail}
              onChange={(value) => updateField('vendorEmail', value)}
            />
            <ReviewField
              id="review-vendor-phone"
              label="Vendor phone"
              value={values.vendorPhone}
              onChange={(value) => updateField('vendorPhone', value)}
            />
            <ReviewField
              id="review-customer-name"
              label="Customer"
              value={values.customerName}
              onChange={(value) => updateField('customerName', value)}
            />
            <ReviewField
              id="review-customer-tax"
              label="Customer tax ID"
              value={values.customerTaxIdentifier}
              onChange={(value) => updateField('customerTaxIdentifier', value)}
            />
            <ReviewField
              id="review-subtotal"
              label="Subtotal"
              value={values.subtotal}
              error={fieldErrors.subtotal}
              onChange={(value) => updateField('subtotal', value)}
            />
            <ReviewField
              id="review-tax"
              label="Tax amount"
              value={values.taxAmount}
              error={fieldErrors.taxAmount}
              onChange={(value) => updateField('taxAmount', value)}
            />
            <ReviewField
              id="review-discount"
              label="Discount amount"
              value={values.discountAmount}
              error={fieldErrors.discountAmount}
              onChange={(value) => updateField('discountAmount', value)}
            />
            <ReviewField
              id="review-total"
              label="Total amount"
              value={values.totalAmount}
              error={fieldErrors.totalAmount}
              onChange={(value) => updateField('totalAmount', value)}
            />
            <div className="sm:col-span-2 lg:col-span-3">
              <Label htmlFor="review-notes">Notes</Label>
              <Textarea
                id="review-notes"
                value={values.notes}
                onChange={(event) => updateField('notes', event.target.value)}
                maxLength={2000}
                rows={3}
                className={fieldErrors.notes ? 'border-error' : undefined}
              />
              {fieldErrors.notes && (
                <p className="mt-1 text-sm text-error">{fieldErrors.notes}</p>
              )}
            </div>
          </div>

          <div>
            <Label htmlFor="review-comment">Review comment</Label>
            <Textarea
              id="review-comment"
              value={comment}
              onChange={(event) => setComment(event.target.value)}
              rows={2}
              maxLength={2000}
              className="mt-2"
              placeholder="Optional context for approval or rejection"
            />
          </div>

          {isDirty && (
            <p className="text-sm text-warning">
              Save your corrections before approving or rejecting this review.
            </p>
          )}

          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => void handleSave()}
              disabled={busy || !isDirty}
            >
              {action === 'save-review' ? 'Saving...' : 'Save changes'}
            </Button>
            {review.status === 'PENDING' && (
              <>
                <Button
                  type="button"
                  variant="success"
                  onClick={() => void onApprove(comment)}
                  disabled={busy || !canDecide}
                >
                  {action === 'approve' ? 'Approving...' : 'Approve review'}
                </Button>
                <Button
                  type="button"
                  variant="error"
                  onClick={() => void onReject(comment)}
                  disabled={busy || !canDecide}
                >
                  {action === 'reject' ? 'Rejecting...' : 'Reject review'}
                </Button>
              </>
            )}
            {review.status === 'REJECTED' && (
              <Button
                type="button"
                onClick={() => void onReopen()}
                disabled={busy || isDirty}
              >
                {action === 'reopen' ? 'Reopening...' : 'Reopen for review'}
              </Button>
            )}
          </div>
          {review.status === 'REJECTED' && isDirty && (
            <p className="text-sm text-muted-foreground">
              Save your corrections before reopening the review.
            </p>
          )}
        </>
      )}

      {canWrite && review.status === 'APPROVED' && (
        <p className="text-xs text-muted-foreground">
          Approved reviews are read-only. Reopen is available only for rejected reviews.
        </p>
      )}

      {!parsedReviewed && !parsedOriginal && (
        <Alert variant="lightwarning">
          <AlertTitle>Unrecognized review format</AlertTitle>
          <AlertDescription>
            The stored review data is not in the expected structured format, so it is
            shown read-only.
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}
