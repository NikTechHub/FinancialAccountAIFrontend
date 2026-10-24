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
import { Textarea } from 'src/components/ui/textarea';
import { expenseApi } from './api';
import { expenseFieldErrors, getExpenseErrorMessage } from './errors';
import type {
  AccountOption,
  ExpenseFormValues,
  ExpenseLookups,
  ExpenseRecord,
  VendorOption,
} from './types';
import {
  emptyExpenseForm,
  expenseToForm,
  toCreateExpenseInput,
  toUpdateExpenseInput,
  validateExpenseForm,
  type ExpenseFormErrors,
} from './validation';

type ExpenseFormMode = 'create' | 'edit';

interface ExpenseFormDialogProps {
  open: boolean;
  mode: ExpenseFormMode;
  record: ExpenseRecord | null;
  currency: string;
  onOpenChange: (open: boolean) => void;
  onSaved: (record: ExpenseRecord, mode: ExpenseFormMode) => void;
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

function SelectField({
  id,
  label,
  value,
  placeholder,
  options,
  error,
  disabled,
  required,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  placeholder: string;
  options: { value: string; label: string; disabled?: boolean }[];
  error?: string;
  disabled?: boolean;
  required?: boolean;
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
      <Select value={value} onValueChange={onChange} disabled={disabled}>
        <SelectTrigger
          id={id}
          className="mt-2 w-full"
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${id}-error` : undefined}
        >
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value} disabled={option.disabled}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <FieldError id={`${id}-error`} message={error} />
    </div>
  );
}

function accountLabel(account: AccountOption) {
  return `${account.code} — ${account.name}${account.active ? '' : ' (inactive)'}`;
}

function withCurrentAccount(
  accounts: AccountOption[],
  current: { id: string; code: string; name: string } | null,
) {
  if (!current || accounts.some((account) => account.id === current.id)) return accounts;
  return [
    ...accounts,
    {
      id: current.id,
      code: current.code,
      name: current.name,
      type: 'EXPENSE' as const,
      active: false,
    },
  ];
}

function withCurrentVendor(vendors: VendorOption[], record: ExpenseRecord | null) {
  if (!record?.vendorId || !record.vendorName) return vendors;
  if (vendors.some((vendor) => vendor.id === record.vendorId)) return vendors;
  return [...vendors, { id: record.vendorId, name: `${record.vendorName} (inactive)` }];
}

export function ExpenseFormDialog({
  open,
  mode,
  record,
  currency,
  onOpenChange,
  onSaved,
}: ExpenseFormDialogProps) {
  const formId = useId();
  const [values, setValues] = useState<ExpenseFormValues>(emptyExpenseForm);
  const [fieldErrors, setFieldErrors] = useState<ExpenseFormErrors>({});
  const [error, setError] = useState<string | null>(null);
  const [lookups, setLookups] = useState<ExpenseLookups | null>(null);
  const [lookupsLoading, setLookupsLoading] = useState(false);
  const [lookupsError, setLookupsError] = useState<string | null>(null);
  const [reloadLookups, setReloadLookups] = useState(0);
  const [isSaving, setIsSaving] = useState(false);
  const savingRef = useRef(false);

  useEffect(() => {
    if (!open) return;

    setValues(record ? expenseToForm(record) : emptyExpenseForm());
    setFieldErrors({});
    setError(null);
    savingRef.current = false;
    setIsSaving(false);
  }, [open, record, mode]);

  useEffect(() => {
    if (!open) return;

    const controller = new AbortController();
    let active = true;
    setLookupsLoading(true);
    setLookupsError(null);

    void (async () => {
      try {
        const data = await expenseApi.lookups(controller.signal);
        if (!active) return;
        setLookups(data);
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
        setLookups(null);
        setLookupsError(getExpenseErrorMessage(loadError, 'load'));
      } finally {
        if (active) setLookupsLoading(false);
      }
    })();

    return () => {
      active = false;
      controller.abort();
    };
  }, [open, reloadLookups]);

  const isCreate = mode === 'create';
  const allAccounts = lookups?.accounts ?? [];
  const expenseAccounts = withCurrentAccount(
    allAccounts.filter(
      (account) => account.active && account.type === 'EXPENSE',
    ),
    record
      ? {
          id: record.expenseAccountId,
          code: record.expenseAccountCode,
          name: record.expenseAccountName,
        }
      : null,
  );
  const paymentAccounts = withCurrentAccount(
    allAccounts.filter((account) => account.active),
    record
      ? {
          id: record.paymentAccountId,
          code: record.paymentAccountCode,
          name: record.paymentAccountName,
        }
      : null,
  );
  const vendors = withCurrentVendor(lookups?.vendors ?? [], record);

  function updateField(field: keyof ExpenseFormValues, value: string) {
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

    const validationErrors = validateExpenseForm(values, {
      existingVendorId: record?.vendorId,
    });
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
          ? await expenseApi.create(toCreateExpenseInput(values))
          : await expenseApi.update(record.id, toUpdateExpenseInput(values, record));
      onSaved(saved, mode);
    } catch (submitError) {
      setFieldErrors(expenseFieldErrors(submitError) as ExpenseFormErrors);
      setError(
        getExpenseErrorMessage(submitError, isCreate ? 'create' : 'update'),
      );
    } finally {
      savingRef.current = false;
      setIsSaving(false);
    }
  }

  const title = isCreate ? 'Add expense' : 'Edit draft expense';
  const submitLabel = isCreate ? 'Create draft' : 'Save changes';
  const canSubmit = Boolean(lookups) && !lookupsLoading;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription className="text-muted-foreground">
            {isCreate
              ? 'Create a draft expense. Recording it later posts the journal entry.'
              : 'Update this draft expense. Recorded and void expenses cannot be edited.'}
          </DialogDescription>
        </DialogHeader>

        {error && (
          <Alert variant="lighterror">
            <AlertTitle>Unable to save expense</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {lookupsError && (
          <Alert variant="lighterror">
            <AlertTitle>Unable to load accounts and vendors</AlertTitle>
            <AlertDescription>{lookupsError}</AlertDescription>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="mt-3"
              onClick={() => setReloadLookups((key) => key + 1)}
            >
              Retry
            </Button>
          </Alert>
        )}

        {!lookupsError && lookupsLoading && (
          <p role="status" className="text-sm text-muted-foreground">
            Loading accounts and vendors...
          </p>
        )}

        {!lookupsError && lookups && expenseAccounts.length === 0 && (
          <Alert variant="lightwarning">
            <AlertTitle>No active expense accounts</AlertTitle>
            <AlertDescription>
              Ask an administrator to add an active expense account before creating
              an expense.
            </AlertDescription>
          </Alert>
        )}

        <form onSubmit={handleSubmit} noValidate>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor={`${formId}-date`}>
                Expense date
                <span className="text-error" aria-hidden="true">
                  *
                </span>
              </Label>
              <Input
                id={`${formId}-date`}
                type="date"
                value={values.expenseDate}
                onChange={(event) => updateField('expenseDate', event.target.value)}
                variant={fieldErrors.expenseDate ? 'failure' : 'default'}
                aria-invalid={fieldErrors.expenseDate ? true : undefined}
                aria-describedby={
                  fieldErrors.expenseDate ? `${formId}-date-error` : undefined
                }
                className="mt-2"
              />
              <FieldError
                id={`${formId}-date-error`}
                message={fieldErrors.expenseDate}
              />
            </div>

            <div>
              <Label htmlFor={`${formId}-amount`}>
                Amount ({currency})
                <span className="text-error" aria-hidden="true">
                  *
                </span>
              </Label>
              <Input
                id={`${formId}-amount`}
                inputMode="decimal"
                value={values.amount}
                onChange={(event) => updateField('amount', event.target.value)}
                variant={fieldErrors.amount ? 'failure' : 'default'}
                aria-invalid={fieldErrors.amount ? true : undefined}
                aria-describedby={
                  fieldErrors.amount ? `${formId}-amount-error` : undefined
                }
                className="mt-2"
                placeholder="0.00"
              />
              <FieldError
                id={`${formId}-amount-error`}
                message={fieldErrors.amount}
              />
            </div>

            <SelectField
              id={`${formId}-expense-account`}
              label="Expense account"
              value={values.expenseAccountId}
              placeholder="Choose an expense account"
              options={expenseAccounts.map((account) => ({
                value: account.id,
                label: accountLabel(account),
                disabled: !account.active,
              }))}
              error={fieldErrors.expenseAccountId}
              disabled={!canSubmit}
              required
              onChange={(value) => updateField('expenseAccountId', value)}
            />

            <SelectField
              id={`${formId}-payment-account`}
              label="Paid from"
              value={values.paymentAccountId}
              placeholder="Choose a payment account"
              options={paymentAccounts.map((account) => ({
                value: account.id,
                label: accountLabel(account),
                disabled: !account.active,
              }))}
              error={fieldErrors.paymentAccountId}
              disabled={!canSubmit}
              required
              onChange={(value) => updateField('paymentAccountId', value)}
            />

            <div className="sm:col-span-2">
              <SelectField
                id={`${formId}-vendor`}
                label="Vendor"
                value={values.vendorId || (record?.vendorId ? '' : '__none__')}
                placeholder="No vendor"
                options={[
                  ...(record?.vendorId
                    ? []
                    : [{ value: '__none__', label: 'No vendor' }]),
                  ...vendors.map((vendor) => ({
                    value: vendor.id,
                    label: vendor.name,
                  })),
                ]}
                error={fieldErrors.vendorId}
                disabled={!canSubmit}
                onChange={(value) =>
                  updateField('vendorId', value === '__none__' ? '' : value)
                }
              />
              <p className="mt-1 text-xs text-muted-foreground">
                Optional. {record?.vendorId
                  ? 'A saved vendor cannot be removed from an existing expense.'
                  : 'Leave unassigned if no vendor applies.'}
              </p>
            </div>

            <div className="sm:col-span-2">
              <Label htmlFor={`${formId}-reference`}>Reference</Label>
              <Input
                id={`${formId}-reference`}
                value={values.reference}
                onChange={(event) => updateField('reference', event.target.value)}
                maxLength={100}
                aria-invalid={fieldErrors.reference ? true : undefined}
                aria-describedby={
                  fieldErrors.reference ? `${formId}-reference-error` : undefined
                }
                variant={fieldErrors.reference ? 'failure' : 'default'}
                className="mt-2"
                placeholder="Receipt or invoice reference"
              />
              <FieldError
                id={`${formId}-reference-error`}
                message={fieldErrors.reference}
              />
            </div>

            <div className="sm:col-span-2">
              <Label htmlFor={`${formId}-description`}>Description</Label>
              <Textarea
                id={`${formId}-description`}
                value={values.description}
                onChange={(event) => updateField('description', event.target.value)}
                maxLength={500}
                rows={3}
                aria-invalid={fieldErrors.description ? true : undefined}
                aria-describedby={
                  fieldErrors.description ? `${formId}-description-error` : undefined
                }
                className={fieldErrors.description ? 'border-error' : undefined}
                placeholder="What was this expense for?"
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
            <Button type="submit" disabled={isSaving || !canSubmit}>
              {isSaving ? 'Saving...' : submitLabel}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
