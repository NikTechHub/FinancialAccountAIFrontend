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
import { Textarea } from 'src/components/ui/textarea';
import { ApiError } from 'src/lib/api/client';
import { getPartyErrorMessage } from './errors';
import type {
  PartyApi,
  PartyFormValues,
  PartyLabels,
  PartyRecord,
} from './types';
import {
  emptyPartyForm,
  toPartyInput,
  validatePartyForm,
  valuesFromRecord,
} from './validation';

type PartyFormMode = 'create' | 'edit';

interface PartyFormDialogProps {
  open: boolean;
  mode: PartyFormMode;
  record: PartyRecord | null;
  api: PartyApi;
  labels: PartyLabels;
  onOpenChange: (open: boolean) => void;
  onSaved: (record: PartyRecord, mode: PartyFormMode) => void;
}

interface FieldProps {
  id: string;
  label: string;
  value: string;
  error?: string;
  required?: boolean;
  autoComplete?: string;
  maxLength?: number;
  onChange: (value: string) => void;
}

function TextField({
  id,
  label,
  value,
  error,
  required,
  autoComplete,
  maxLength,
  onChange,
}: FieldProps) {
  const errorId = `${id}-error`;

  return (
    <div>
      <Label htmlFor={id}>
        {label}
        {required && (
          <span className="text-error" aria-hidden="true">
            *
          </span>
        )}
      </Label>
      <Input
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        variant={error ? 'failure' : 'default'}
        autoComplete={autoComplete}
        maxLength={maxLength}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : undefined}
        className="mt-2"
      />
      {error && (
        <p id={errorId} className="mt-1 text-sm text-error">
          {error}
        </p>
      )}
    </div>
  );
}

export function PartyFormDialog({
  open,
  mode,
  record,
  api,
  labels,
  onOpenChange,
  onSaved,
}: PartyFormDialogProps) {
  const formId = useId();
  const [values, setValues] = useState<PartyFormValues>(emptyPartyForm);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const savingRef = useRef(false);

  useEffect(() => {
    if (!open) return;

    setValues(record ? valuesFromRecord(record) : { ...emptyPartyForm });
    setFieldErrors({});
    setError(null);
    savingRef.current = false;
    setIsSaving(false);
  }, [open, record, mode]);

  const isCreate = mode === 'create';

  function updateField(field: keyof PartyFormValues, value: string) {
    setValues((current) => ({ ...current, [field]: value }));
    setFieldErrors((current) => {
      if (!current[field]) return current;
      const next = { ...current };
      delete next[field];
      return next;
    });
  }

  function handleOpenChange(nextOpen: boolean) {
    if (savingRef.current) return;
    onOpenChange(nextOpen);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (savingRef.current) return;

    const validationErrors = validatePartyForm(values);
    if (Object.keys(validationErrors).length > 0) {
      setFieldErrors(validationErrors);
      setError(null);
      return;
    }

    savingRef.current = true;
    setIsSaving(true);
    setError(null);
    setFieldErrors({});

    try {
      const input = toPartyInput(values);
      const saved =
        isCreate || !record ? await api.create(input) : await api.update(record.id, input);
      onSaved(saved, mode);
    } catch (submitError) {
      if (submitError instanceof ApiError && submitError.fieldErrors) {
        setFieldErrors(submitError.fieldErrors);
      }
      setError(getPartyErrorMessage(submitError, labels, isCreate ? 'create' : 'update'));
    } finally {
      savingRef.current = false;
      setIsSaving(false);
    }
  }

  const title = isCreate ? `Add ${labels.lowerSingular}` : `Edit ${labels.lowerSingular}`;
  const submitLabel = isCreate
    ? `Create ${labels.lowerSingular}`
    : 'Save changes';

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription className="text-muted-foreground">
            {isCreate
              ? `Add a ${labels.lowerSingular} to your organization. Only the name is required.`
              : `Update ${labels.lowerSingular} details. Clearing a field removes its saved value.`}
          </DialogDescription>
        </DialogHeader>

        {error && (
          <Alert variant="lighterror">
            <AlertTitle>Unable to save {labels.lowerSingular}</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <form onSubmit={handleSubmit} noValidate>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <TextField
                id={`${formId}-name`}
                label="Name"
                value={values.name}
                error={fieldErrors.name}
                required
                autoComplete="organization"
                maxLength={255}
                onChange={(value) => updateField('name', value)}
              />
            </div>

            <TextField
              id={`${formId}-email`}
              label="Email"
              value={values.email}
              error={fieldErrors.email}
              autoComplete="email"
              maxLength={255}
              onChange={(value) => updateField('email', value)}
            />

            <TextField
              id={`${formId}-phone`}
              label="Phone"
              value={values.phone}
              error={fieldErrors.phone}
              autoComplete="tel"
              maxLength={50}
              onChange={(value) => updateField('phone', value)}
            />

            <TextField
              id={`${formId}-tax`}
              label="Tax identifier"
              value={values.taxIdentifier}
              error={fieldErrors.taxIdentifier}
              maxLength={100}
              onChange={(value) => updateField('taxIdentifier', value)}
            />

            <TextField
              id={`${formId}-terms`}
              label="Payment terms"
              value={values.paymentTerms}
              error={fieldErrors.paymentTerms}
              maxLength={100}
              onChange={(value) => updateField('paymentTerms', value)}
            />

            <div className="sm:col-span-2">
              <Label htmlFor={`${formId}-address`}>Address</Label>
              <Textarea
                id={`${formId}-address`}
                value={values.address}
                onChange={(event) => updateField('address', event.target.value)}
                maxLength={500}
                rows={3}
                aria-invalid={fieldErrors.address ? true : undefined}
                aria-describedby={fieldErrors.address ? `${formId}-address-error` : undefined}
                className={fieldErrors.address ? 'border-error' : undefined}
              />
              {fieldErrors.address && (
                <p id={`${formId}-address-error`} className="mt-1 text-sm text-error">
                  {fieldErrors.address}
                </p>
              )}
            </div>
          </div>

          <DialogFooter className="mt-6">
            <Button
              type="button"
              variant="outline"
              onClick={() => handleOpenChange(false)}
              disabled={isSaving}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSaving}>
              {isSaving ? 'Saving...' : submitLabel}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
