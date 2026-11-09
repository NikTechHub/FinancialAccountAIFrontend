import { useEffect, useId, useRef, useState, type FormEvent } from 'react';
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
import { Input } from 'src/components/ui/input';
import { Label } from 'src/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from 'src/components/ui/select';
import { expenseApi } from 'src/features/expenses/api';
import type { ExpenseRecord } from 'src/features/expenses/types';
import { documentApi } from './api';
import { getDocumentErrorMessage } from './errors';
import type { DocumentRecord, DocumentType } from './types';
import { formatMoney } from 'src/features/money/format';
import { formatFileSize, validateDocumentFile } from './validation';

interface DocumentUploadDialogProps {
  open: boolean;
  currency: string;
  onOpenChange: (open: boolean) => void;
  onUploaded: (document: DocumentRecord) => void;
}

const documentTypes: { value: DocumentType; label: string }[] = [
  { value: 'RECEIPT', label: 'Receipt' },
  { value: 'EXPENSE_RECEIPT', label: 'Expense receipt' },
  { value: 'INVOICE', label: 'Invoice' },
  { value: 'OTHER', label: 'Other document' },
];

export function DocumentUploadDialog({
  open,
  currency,
  onOpenChange,
  onUploaded,
}: DocumentUploadDialogProps) {
  const fileInputId = useId();
  const expenseSelectId = useId();
  const typeSelectId = useId();
  const [file, setFile] = useState<File | null>(null);
  const [documentType, setDocumentType] = useState<DocumentType | ''>('');
  const [expenseId, setExpenseId] = useState('');
  const [fileError, setFileError] = useState<string | null>(null);
  const [typeError, setTypeError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [expenses, setExpenses] = useState<ExpenseRecord[]>([]);
  const [expensesError, setExpensesError] = useState<string | null>(null);
  const [expensesLoading, setExpensesLoading] = useState(false);
  const [expenseReloadKey, setExpenseReloadKey] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const uploadingRef = useRef(false);

  useEffect(() => {
    if (!open) return;
    setFile(null);
    setDocumentType('');
    setExpenseId('');
    setFileError(null);
    setTypeError(null);
    setError(null);
    uploadingRef.current = false;
    setIsUploading(false);
  }, [open]);

  useEffect(() => {
    if (!open) return;

    const controller = new AbortController();
    let active = true;
    setExpensesLoading(true);
    setExpensesError(null);

    void (async () => {
      try {
        const result = await expenseApi.list(
          {
            page: 0,
            size: 100,
            reference: '',
            status: '',
            sort: 'expenseDate,desc',
          },
          controller.signal,
        );
        if (!active) return;
        setExpenses(result.content);
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
        setExpensesError('Linked expenses could not be loaded.');
      } finally {
        if (active) setExpensesLoading(false);
      }
    })();

    return () => {
      active = false;
      controller.abort();
    };
  }, [open, expenseReloadKey]);

  function handleOpenChange(nextOpen: boolean) {
    if (uploadingRef.current) return;
    onOpenChange(nextOpen);
  }

  function handleFileChange(nextFile: File | null) {
    setFile(nextFile);
    setFileError(nextFile ? validateDocumentFile(nextFile) : null);
    setError(null);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (uploadingRef.current) return;

    const nextFileError = validateDocumentFile(file);
    const nextTypeError = documentType ? null : 'Choose a document type.';
    setFileError(nextFileError);
    setTypeError(nextTypeError);

    if (nextFileError || nextTypeError || !file || !documentType) return;

    uploadingRef.current = true;
    setIsUploading(true);
    setError(null);

    try {
      const uploaded = await documentApi.upload({
        file,
        documentType,
        ...(expenseId ? { expenseId } : {}),
      });
      onUploaded(uploaded);
    } catch (uploadError) {
      setError(getDocumentErrorMessage(uploadError, 'upload'));
    } finally {
      uploadingRef.current = false;
      setIsUploading(false);
    }
  }

  function expenseLabel(expense: ExpenseRecord) {
    const amount = formatMoney(expense.amount, currency);
    const label = expense.description || expense.reference || expense.expenseAccountName;
    return `${expense.expenseDate} · ${label} · ${amount}`;
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Upload document</DialogTitle>
          <DialogDescription className="text-muted-foreground">
            Upload a PDF or image up to 10 MB. The file is stored securely and can be
            linked to an expense.
          </DialogDescription>
        </DialogHeader>

        {error && (
          <Alert variant="lighterror">
            <AlertTitle>Unable to upload document</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <form onSubmit={handleSubmit} noValidate>
          <div className="grid gap-4">
            <div>
              <Label htmlFor={fileInputId}>
                Document file
                <span className="text-error" aria-hidden="true">
                  *
                </span>
              </Label>
              <Input
                id={fileInputId}
                type="file"
                accept=".pdf,.jpg,.jpeg,.png,.webp,application/pdf,image/jpeg,image/png,image/webp"
                onChange={(event) =>
                  handleFileChange(event.target.files?.[0] ?? null)
                }
                aria-invalid={fileError ? true : undefined}
                aria-describedby={fileError ? `${fileInputId}-error` : undefined}
                variant={fileError ? 'failure' : 'default'}
                className="mt-2"
                disabled={isUploading}
              />
              {file && !fileError && (
                <p className="mt-1 text-xs text-muted-foreground">
                  {file.name} · {formatFileSize(file.size)}
                </p>
              )}
              {fileError && (
                <p id={`${fileInputId}-error`} className="mt-1 text-sm text-error">
                  {fileError}
                </p>
              )}
            </div>

            <div>
              <Label htmlFor={typeSelectId}>
                Document type
                <span className="text-error" aria-hidden="true">
                  *
                </span>
              </Label>
              <Select
                value={documentType}
                onValueChange={(value) => {
                  setDocumentType(value as DocumentType);
                  setTypeError(null);
                }}
                disabled={isUploading}
              >
                <SelectTrigger
                  id={typeSelectId}
                  className="mt-2 w-full"
                  aria-invalid={typeError ? true : undefined}
                  aria-describedby={typeError ? `${typeSelectId}-error` : undefined}
                >
                  <SelectValue placeholder="Choose a document type" />
                </SelectTrigger>
                <SelectContent>
                  {documentTypes.map((type) => (
                    <SelectItem key={type.value} value={type.value}>
                      {type.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {typeError && (
                <p id={`${typeSelectId}-error`} className="mt-1 text-sm text-error">
                  {typeError}
                </p>
              )}
            </div>

            <div>
              <Label htmlFor={expenseSelectId}>Linked expense</Label>
              <Select
                value={expenseId || '__none__'}
                onValueChange={(value) =>
                  setExpenseId(value === '__none__' ? '' : value)
                }
                disabled={isUploading || expensesLoading}
              >
                <SelectTrigger id={expenseSelectId} className="mt-2 w-full">
                  <SelectValue
                    placeholder={
                      expensesLoading ? 'Loading expenses...' : 'No linked expense'
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">No linked expense</SelectItem>
                  {expenses.map((expense) => (
                    <SelectItem key={expense.id} value={expense.id}>
                      {expenseLabel(expense)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="mt-1 text-xs text-muted-foreground">
                Optional. Linking associates this file with an existing expense.
              </p>
              {expensesError && (
                <p className="mt-1 text-sm text-error">
                  {expensesError}{' '}
                  <Button
                    type="button"
                    variant="link"
                    className="h-auto p-0"
                    onClick={() => setExpenseReloadKey((key) => key + 1)}
                  >
                    Retry
                  </Button>
                </p>
              )}
            </div>
          </div>

          <DialogFooter className="mt-6">
            <Button
              type="button"
              variant="outline"
              onClick={() => handleOpenChange(false)}
              disabled={isUploading}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isUploading}>
              {isUploading ? 'Uploading...' : 'Upload document'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
