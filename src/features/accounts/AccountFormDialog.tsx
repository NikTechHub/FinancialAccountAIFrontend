import {
  useEffect,
  useId,
  useRef,
  useState,
  type FormEvent,
} from 'react';
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
import { Textarea } from 'src/components/ui/textarea';
import { ApiError } from 'src/lib/api/client';
import { accountTypeOptions } from './display';
import { getAccountErrorMessage } from './errors';
import type {
  AccountApi,
  AccountFormValues,
  AccountParentOption,
  AccountRecord,
} from './types';
import {
  emptyAccountForm,
  toCreateAccountInput,
  toUpdateAccountInput,
  validateAccountForm,
  valuesFromAccount,
} from './validation';

type AccountFormMode = 'create' | 'edit';

const noParentValue = '__none__';

interface AccountFormDialogProps {
  open: boolean;
  mode: AccountFormMode;
  record: AccountRecord | null;
  api: AccountApi;
  onOpenChange: (open: boolean) => void;
  onSaved: (record: AccountRecord, mode: AccountFormMode) => void;
}

interface FieldErrorProps {
  id: string;
  message?: string;
}

function FieldError({ id, message }: FieldErrorProps) {
  if (!message) return null;
  return (
    <p id={id} className="mt-1 text-sm text-error">
      {message}
    </p>
  );
}

function TextField({
  id,
  label,
  value,
  error,
  required,
  maxLength,
  autoComplete,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  error?: string;
  required?: boolean;
  maxLength?: number;
  autoComplete?: string;
  onChange: (value: string) => void;
}) {
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
        maxLength={maxLength}
        autoComplete={autoComplete}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-error` : undefined}
        className="mt-2"
      />
      <FieldError id={`${id}-error`} message={error} />
    </div>
  );
}

function parentOptionLabel(option: AccountParentOption): string {
  const indent = '— '.repeat(option.depth);
  return `${indent}${option.code} — ${option.name}`;
}

export function AccountFormDialog({
  open,
  mode,
  record,
  api,
  onOpenChange,
  onSaved,
}: AccountFormDialogProps) {
  const formId = useId();
  const [values, setValues] = useState<AccountFormValues>(emptyAccountForm);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [parentOptions, setParentOptions] = useState<AccountParentOption[]>([]);
  const [parentOptionsLoading, setParentOptionsLoading] = useState(false);
  const [parentOptionsError, setParentOptionsError] = useState<string | null>(
    null,
  );
  const [reloadParentsKey, setReloadParentsKey] = useState(0);
  const savingRef = useRef(false);

  useEffect(() => {
    if (!open) return;

    setValues(record ? valuesFromAccount(record) : { ...emptyAccountForm });
    setFieldErrors({});
    setError(null);
    savingRef.current = false;
    setIsSaving(false);
  }, [open, record, mode]);

  useEffect(() => {
    if (!open) return;

    const controller = new AbortController();
    let active = true;

    setParentOptionsLoading(true);
    setParentOptionsError(null);

    void (async () => {
      try {
        const options = await api.parentOptions(
          record?.id ?? null,
          controller.signal,
        );
        if (!active) return;
        setParentOptions(options);
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
        setParentOptions([]);
        setParentOptionsError(
          'Unable to load parent account choices. Parent selection is unavailable.',
        );
      } finally {
        if (active) setParentOptionsLoading(false);
      }
    })();

    return () => {
      active = false;
      controller.abort();
    };
  }, [api, open, record, reloadParentsKey]);

  const isCreate = mode === 'create';
  const options = [...parentOptions];

  if (
    record?.parentAccountId &&
    record.parentAccountName &&
    !options.some((option) => option.id === record.parentAccountId)
  ) {
    options.unshift({
      id: record.parentAccountId,
      code: '',
      name: record.parentAccountName,
      type: record.type,
      depth: 0,
    });
  }

  const parentValue = values.parentAccountId || noParentValue;
  const parentDisabled = parentOptionsLoading || Boolean(parentOptionsError);
  const cannotClearParent = Boolean(record?.parentAccountId);

  function updateField(field: keyof AccountFormValues, value: string) {
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

    const validationErrors = validateAccountForm(values);
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
      const saved =
        isCreate || !record
          ? await api.create(toCreateAccountInput(values))
          : await api.update(record.id, toUpdateAccountInput(values, record));
      onSaved(saved, mode);
    } catch (submitError) {
      const nextFieldErrors =
        submitError instanceof ApiError && submitError.fieldErrors
          ? { ...submitError.fieldErrors }
          : {};

      if (
        submitError instanceof ApiError &&
        submitError.status === 409 &&
        !nextFieldErrors.code
      ) {
        nextFieldErrors.code =
          'An account with this code already exists. Use a different code.';
      }

      setFieldErrors(nextFieldErrors);
      setError(
        getAccountErrorMessage(
          submitError,
          isCreate ? 'create' : 'update',
        ),
      );
    } finally {
      savingRef.current = false;
      setIsSaving(false);
    }
  }

  const title = isCreate ? 'Add account' : 'Edit account';
  const submitLabel = isCreate ? 'Create account' : 'Save changes';

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription className="text-muted-foreground">
            {isCreate
              ? 'Add an active account to your chart of accounts.'
              : 'Update the fields supported by the account API.'}
          </DialogDescription>
        </DialogHeader>

        {error && (
          <Alert variant="lighterror">
            <AlertTitle>Unable to save account</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {parentOptionsError && (
          <Alert variant="lightwarning">
            <AlertTitle>Parent accounts unavailable</AlertTitle>
            <AlertDescription className="mt-2 flex items-center justify-between gap-3">
              <span>{parentOptionsError}</span>
              <Button
                type="button"
                variant="ghostwarning"
                size="sm"
                onClick={() => setReloadParentsKey((key) => key + 1)}
              >
                Retry
              </Button>
            </AlertDescription>
          </Alert>
        )}

        <form onSubmit={handleSubmit} noValidate>
          <div className="grid gap-4 sm:grid-cols-2">
            <TextField
              id={`${formId}-code`}
              label="Account code"
              value={values.code}
              error={fieldErrors.code}
              required
              maxLength={20}
              autoComplete="off"
              onChange={(value) => updateField('code', value)}
            />

            <div>
              <Label htmlFor={`${formId}-type`}>
                Account type
                <span className="text-error" aria-hidden="true">
                  *
                </span>
              </Label>
              <Select
                value={values.type}
                onValueChange={(value) => updateField('type', value)}
              >
                <SelectTrigger
                  id={`${formId}-type`}
                  className="mt-2 w-full"
                  aria-invalid={fieldErrors.type ? true : undefined}
                  aria-describedby={
                    fieldErrors.type ? `${formId}-type-error` : undefined
                  }
                >
                  <SelectValue placeholder="Select account type" />
                </SelectTrigger>
                <SelectContent>
                  {accountTypeOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FieldError
                id={`${formId}-type-error`}
                message={fieldErrors.type}
              />
            </div>

            <div className="sm:col-span-2">
              <TextField
                id={`${formId}-name`}
                label="Account name"
                value={values.name}
                error={fieldErrors.name}
                required
                maxLength={255}
                autoComplete="off"
                onChange={(value) => updateField('name', value)}
              />
            </div>

            <div className="sm:col-span-2">
              <Label htmlFor={`${formId}-parent`}>Parent account</Label>
              <Select
                value={parentValue}
                onValueChange={(value) =>
                  updateField(
                    'parentAccountId',
                    value === noParentValue ? '' : value,
                  )
                }
                disabled={parentDisabled}
              >
                <SelectTrigger id={`${formId}-parent`} className="mt-2 w-full">
                  <SelectValue
                    placeholder={
                      parentOptionsLoading ? 'Loading accounts...' : 'No parent'
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={noParentValue} disabled={cannotClearParent}>
                    No parent account
                  </SelectItem>
                  {options.map((option) => (
                    <SelectItem key={option.id} value={option.id}>
                      {option.code
                        ? parentOptionLabel(option)
                        : `${option.name} (inactive)`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="mt-1 text-xs text-muted-foreground">
                {cannotClearParent
                  ? 'The current API cannot remove an existing parent account.'
                  : 'Optional. Only active accounts are available as parents.'}
              </p>
              <FieldError
                id={`${formId}-parent-error`}
                message={fieldErrors.parentAccountId}
              />
            </div>

            <div className="sm:col-span-2">
              <Label htmlFor={`${formId}-description`}>
                Description
              </Label>
              <Textarea
                id={`${formId}-description`}
                value={values.description}
                onChange={(event) =>
                  updateField('description', event.target.value)
                }
                maxLength={500}
                rows={3}
                aria-invalid={fieldErrors.description ? true : undefined}
                aria-describedby={
                  fieldErrors.description
                    ? `${formId}-description-error`
                    : undefined
                }
                className={fieldErrors.description ? 'mt-2 border-error' : 'mt-2'}
              />
              <FieldError
                id={`${formId}-description-error`}
                message={fieldErrors.description}
              />
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
