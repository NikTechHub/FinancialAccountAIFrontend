import {
  useEffect,
  useId,
  useRef,
  useState,
  type FormEvent,
} from 'react';
import { Plus, Trash2 } from 'lucide-react';
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
import type { AccountOption } from 'src/features/expenses/types';
import { invoiceApi } from './api';
import { formatInvoiceAmount } from './display';
import { getInvoiceErrorMessage, invoiceFieldErrors } from './errors';
import type {
  InvoiceFormValues,
  InvoiceLineFormValues,
  InvoiceLookups,
  InvoiceRecord,
} from './types';
import {
  calculateInvoicePreview,
  emptyInvoiceForm,
  emptyInvoiceLine,
  invoiceToForm,
  linePreview,
  toCreateInvoiceInput,
  toUpdateInvoiceInput,
  validateInvoiceForm,
  type InvoiceFormErrors,
} from './validation';

type InvoiceFormMode = 'create' | 'edit';

interface InvoiceFormDialogProps {
  open: boolean;
  mode: InvoiceFormMode;
  record: InvoiceRecord | null;
  currency: string;
  onOpenChange: (open: boolean) => void;
  onSaved: (record: InvoiceRecord, mode: InvoiceFormMode) => void;
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
            <SelectItem
              key={option.value}
              value={option.value}
              disabled={option.disabled}
            >
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

export function InvoiceFormDialog({
  open,
  mode,
  record,
  currency,
  onOpenChange,
  onSaved,
}: InvoiceFormDialogProps) {
  const formId = useId();
  const [values, setValues] = useState<InvoiceFormValues>(emptyInvoiceForm);
  const [fieldErrors, setFieldErrors] = useState<InvoiceFormErrors>({});
  const [error, setError] = useState<string | null>(null);
  const [lookups, setLookups] = useState<InvoiceLookups | null>(null);
  const [lookupsLoading, setLookupsLoading] = useState(false);
  const [lookupsError, setLookupsError] = useState<string | null>(null);
  const [reloadLookups, setReloadLookups] = useState(0);
  const [isSaving, setIsSaving] = useState(false);
  const savingRef = useRef(false);

  useEffect(() => {
    if (!open) return;

    setValues(record ? invoiceToForm(record) : emptyInvoiceForm());
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
        const data = await invoiceApi.lookups(controller.signal);
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
        setLookupsError(getInvoiceErrorMessage(loadError, 'load'));
      } finally {
        if (active) setLookupsLoading(false);
      }
    })();

    return () => {
      active = false;
      controller.abort();
    };
  }, [open, reloadLookups]);

  const allAccounts = lookups?.revenueAccounts ?? [];
  const activeRevenueAccounts = allAccounts.filter((account) => account.active);
  const activeCustomers = (lookups?.customers ?? []).filter(
    (customer) => customer.active,
  );

  const customerOptions = activeCustomers.map((customer) => ({
    value: customer.id,
    label: customer.name,
  }));
  if (
    record &&
    !customerOptions.some((option) => option.value === record.customerId)
  ) {
    customerOptions.push({
      value: record.customerId,
      label: `${record.customerName} (inactive)`,
    });
  }

  const revenueOptions = activeRevenueAccounts.map((account) => ({
    value: account.id,
    label: accountLabel(account),
  }));
  for (const line of record?.lines ?? []) {
    if (!revenueOptions.some((option) => option.value === line.revenueAccountId)) {
      revenueOptions.push({
        value: line.revenueAccountId,
        label: `${line.revenueAccountCode} — ${line.revenueAccountName} (inactive)`,
      });
    }
  }

  const activeRevenueAccountIds = activeRevenueAccounts.map(
    (account) => account.id,
  );
  const preview = calculateInvoicePreview(values.lines);
  const isCreate = mode === 'create';
  const canSubmit =
    Boolean(lookups) &&
    !lookupsLoading &&
    customerOptions.length > 0 &&
    revenueOptions.length > 0;

  function updateField(field: keyof InvoiceFormValues, value: string) {
    setValues((current) => ({ ...current, [field]: value }));
    setFieldErrors((current) => {
      if (!current[field]) return current;
      const next = { ...current };
      delete next[field];
      return next;
    });
  }

  function updateLine(
    index: number,
    field: keyof InvoiceLineFormValues,
    value: string,
  ) {
    setValues((current) => ({
      ...current,
      lines: current.lines.map((line, lineIndex) =>
        lineIndex === index ? { ...line, [field]: value } : line,
      ),
    }));
    setFieldErrors((current) => {
      const key = `lines.${index}.${field}`;
      if (!current[key] && !current.lines) return current;
      const next = { ...current };
      delete next[key];
      delete next.lines;
      return next;
    });
  }

  function addLine() {
    setValues((current) => ({
      ...current,
      lines: [...current.lines, emptyInvoiceLine()],
    }));
    setFieldErrors((current) =>
      Object.fromEntries(
        Object.entries(current).filter(([key]) => !key.startsWith('lines.')),
      ),
    );
  }

  function removeLine(index: number) {
    setValues((current) => ({
      ...current,
      lines: current.lines.filter((_, lineIndex) => lineIndex !== index),
    }));
    setFieldErrors((current) =>
      Object.fromEntries(
        Object.entries(current).filter(([key]) => !key.startsWith('lines.')),
      ),
    );
  }

  function handleOpenChange(nextOpen: boolean) {
    if (savingRef.current) return;
    onOpenChange(nextOpen);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (savingRef.current) return;

    const validationErrors = validateInvoiceForm(values, {
      existingDueDate: record?.dueDate ?? null,
      activeRevenueAccountIds,
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
          ? await invoiceApi.create(toCreateInvoiceInput(values))
          : await invoiceApi.update(record.id, toUpdateInvoiceInput(values));
      onSaved(saved, mode);
    } catch (submitError) {
      setFieldErrors(invoiceFieldErrors(submitError));
      setError(getInvoiceErrorMessage(submitError, isCreate ? 'create' : 'update'));
    } finally {
      savingRef.current = false;
      setIsSaving(false);
    }
  }

  const title = isCreate ? 'Create invoice' : 'Edit draft invoice';
  const submitLabel = isCreate ? 'Create draft' : 'Save changes';

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-4xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription className="text-muted-foreground">
            {isCreate
              ? 'Create a draft invoice. Issuing it later posts the accounting entry.'
              : 'Update this draft invoice. Issued and void invoices cannot be edited.'}
          </DialogDescription>
        </DialogHeader>

        {error && (
          <Alert variant="lighterror">
            <AlertTitle>Unable to save invoice</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {lookupsError && (
          <Alert variant="lighterror">
            <AlertTitle>Unable to load customers and revenue accounts</AlertTitle>
            <AlertDescription>
              <p>{lookupsError}</p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="mt-3"
                onClick={() => setReloadLookups((key) => key + 1)}
              >
                Retry
              </Button>
            </AlertDescription>
          </Alert>
        )}

        {!lookupsError && lookupsLoading && (
          <p role="status" className="text-sm text-muted-foreground">
            Loading customers and revenue accounts...
          </p>
        )}

        {!lookupsError &&
          lookups &&
          customerOptions.length === 0 &&
          revenueOptions.length === 0 && (
            <Alert variant="lightwarning">
              <AlertTitle>Invoice setup is incomplete</AlertTitle>
              <AlertDescription>
                Add an active customer and an active revenue account before
                creating an invoice.
              </AlertDescription>
            </Alert>
          )}

        {!lookupsError &&
          lookups &&
          customerOptions.length > 0 &&
          revenueOptions.length === 0 && (
            <Alert variant="lightwarning">
              <AlertTitle>No active revenue accounts</AlertTitle>
              <AlertDescription>
                Add an active revenue account before creating or saving an
                invoice.
              </AlertDescription>
            </Alert>
          )}

        {!lookupsError &&
          lookups &&
          customerOptions.length === 0 &&
          revenueOptions.length > 0 && (
            <Alert variant="lightwarning">
              <AlertTitle>No active customers</AlertTitle>
              <AlertDescription>
                Add an active customer before creating an invoice.
              </AlertDescription>
            </Alert>
          )}

        <form onSubmit={handleSubmit} noValidate>
          <div className="grid gap-4 sm:grid-cols-2">
            <SelectField
              id={`${formId}-customer`}
              label="Customer"
              value={values.customerId}
              placeholder="Choose a customer"
              options={customerOptions}
              error={fieldErrors.customerId}
              disabled={!canSubmit}
              required
              onChange={(value) => updateField('customerId', value)}
            />

            <div>
              <Label htmlFor={`${formId}-number`}>
                Invoice number
                <span className="text-error" aria-hidden="true">
                  *
                </span>
              </Label>
              <Input
                id={`${formId}-number`}
                value={values.invoiceNumber}
                onChange={(event) =>
                  updateField('invoiceNumber', event.target.value)
                }
                maxLength={50}
                variant={fieldErrors.invoiceNumber ? 'failure' : 'default'}
                aria-invalid={fieldErrors.invoiceNumber ? true : undefined}
                aria-describedby={
                  fieldErrors.invoiceNumber
                    ? `${formId}-number-error`
                    : undefined
                }
                className="mt-2"
                placeholder="INV-1001"
              />
              <FieldError
                id={`${formId}-number-error`}
                message={fieldErrors.invoiceNumber}
              />
            </div>

            <div>
              <Label htmlFor={`${formId}-date`}>
                Invoice date
                <span className="text-error" aria-hidden="true">
                  *
                </span>
              </Label>
              <Input
                id={`${formId}-date`}
                type="date"
                value={values.invoiceDate}
                onChange={(event) =>
                  updateField('invoiceDate', event.target.value)
                }
                variant={fieldErrors.invoiceDate ? 'failure' : 'default'}
                aria-invalid={fieldErrors.invoiceDate ? true : undefined}
                aria-describedby={
                  fieldErrors.invoiceDate
                    ? `${formId}-date-error`
                    : undefined
                }
                className="mt-2"
              />
              <FieldError
                id={`${formId}-date-error`}
                message={fieldErrors.invoiceDate}
              />
            </div>

            <div>
              <Label htmlFor={`${formId}-due-date`}>Due date</Label>
              <Input
                id={`${formId}-due-date`}
                type="date"
                value={values.dueDate}
                onChange={(event) => updateField('dueDate', event.target.value)}
                variant={fieldErrors.dueDate ? 'failure' : 'default'}
                aria-invalid={fieldErrors.dueDate ? true : undefined}
                aria-describedby={
                  fieldErrors.dueDate ? `${formId}-due-date-error` : undefined
                }
                className="mt-2"
              />
              <FieldError
                id={`${formId}-due-date-error`}
                message={fieldErrors.dueDate}
              />
              {record?.dueDate && (
                <p className="mt-1 text-xs text-muted-foreground">
                  The backend cannot clear an existing due date; choose another
                  date or keep the current one.
                </p>
              )}
            </div>

            <div className="sm:col-span-2">
              <Label htmlFor={`${formId}-notes`}>Notes</Label>
              <Textarea
                id={`${formId}-notes`}
                value={values.notes}
                onChange={(event) => updateField('notes', event.target.value)}
                maxLength={1000}
                rows={2}
                aria-invalid={fieldErrors.notes ? true : undefined}
                aria-describedby={
                  fieldErrors.notes ? `${formId}-notes-error` : undefined
                }
                className={fieldErrors.notes ? 'border-error' : undefined}
                placeholder="Notes visible on the invoice"
              />
              <FieldError
                id={`${formId}-notes-error`}
                message={fieldErrors.notes}
              />
            </div>

            <div className="sm:col-span-2">
              <Label htmlFor={`${formId}-terms`}>Terms</Label>
              <Textarea
                id={`${formId}-terms`}
                value={values.terms}
                onChange={(event) => updateField('terms', event.target.value)}
                maxLength={1000}
                rows={2}
                aria-invalid={fieldErrors.terms ? true : undefined}
                aria-describedby={
                  fieldErrors.terms ? `${formId}-terms-error` : undefined
                }
                className={fieldErrors.terms ? 'border-error' : undefined}
                placeholder="Payment terms"
              />
              <FieldError
                id={`${formId}-terms-error`}
                message={fieldErrors.terms}
              />
            </div>
          </div>

          <div className="mt-6">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h6 className="font-semibold">Line items</h6>
                <p className="text-xs text-muted-foreground">
                  Amounts are recalculated by the server when the invoice is
                  saved.
                </p>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={addLine}
                disabled={!canSubmit}
              >
                <Plus className="size-4" />
                Add line
              </Button>
            </div>

            {fieldErrors.lines && (
              <p className="mt-2 text-sm text-error">{fieldErrors.lines}</p>
            )}

            <div className="mt-3 space-y-4">
              {values.lines.map((line, index) => {
                const prefix = `lines.${index}`;
                const lineTotals = linePreview(line);

                return (
                  <div
                    key={index}
                    className="rounded-lg border border-border p-4 dark:border-white/10"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-sm font-medium">Line {index + 1}</p>
                      <div className="flex items-center gap-3">
                        <p className="text-sm font-medium tabular-nums">
                          {formatInvoiceAmount(lineTotals.lineTotal, currency)}
                        </p>
                        <Button
                          type="button"
                          variant="ghosterror"
                          size="sm"
                          className="h-8 px-2"
                          onClick={() => removeLine(index)}
                          disabled={values.lines.length === 1}
                          aria-label={`Remove line ${index + 1}`}
                        >
                          <Trash2 className="size-4" />
                          Remove
                        </Button>
                      </div>
                    </div>

                    <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                      <div className="sm:col-span-2 lg:col-span-4">
                        <Label htmlFor={`${formId}-${prefix}-description`}>
                          Description
                        </Label>
                        <Input
                          id={`${formId}-${prefix}-description`}
                          value={line.description}
                          onChange={(event) =>
                            updateLine(index, 'description', event.target.value)
                          }
                          maxLength={500}
                          className="mt-2"
                          placeholder="What is being invoiced?"
                          aria-invalid={
                            fieldErrors[`${prefix}.description`] ? true : undefined
                          }
                          aria-describedby={
                            fieldErrors[`${prefix}.description`]
                              ? `${formId}-${prefix}-description-error`
                              : undefined
                          }
                          variant={
                            fieldErrors[`${prefix}.description`]
                              ? 'failure'
                              : 'default'
                          }
                        />
                        <FieldError
                          id={`${formId}-${prefix}-description-error`}
                          message={fieldErrors[`${prefix}.description`]}
                        />
                      </div>

                      <div>
                        <Label htmlFor={`${formId}-${prefix}-quantity`}>
                          Quantity
                          <span className="text-error" aria-hidden="true">
                            *
                          </span>
                        </Label>
                        <Input
                          id={`${formId}-${prefix}-quantity`}
                          inputMode="decimal"
                          value={line.quantity}
                          onChange={(event) =>
                            updateLine(index, 'quantity', event.target.value)
                          }
                          className="mt-2"
                          placeholder="1"
                          aria-invalid={
                            fieldErrors[`${prefix}.quantity`] ? true : undefined
                          }
                          aria-describedby={
                            fieldErrors[`${prefix}.quantity`]
                              ? `${formId}-${prefix}-quantity-error`
                              : undefined
                          }
                          variant={
                            fieldErrors[`${prefix}.quantity`]
                              ? 'failure'
                              : 'default'
                          }
                        />
                        <FieldError
                          id={`${formId}-${prefix}-quantity-error`}
                          message={fieldErrors[`${prefix}.quantity`]}
                        />
                      </div>

                      <div>
                        <Label htmlFor={`${formId}-${prefix}-price`}>
                          Unit price ({currency})
                          <span className="text-error" aria-hidden="true">
                            *
                          </span>
                        </Label>
                        <Input
                          id={`${formId}-${prefix}-price`}
                          inputMode="decimal"
                          value={line.unitPrice}
                          onChange={(event) =>
                            updateLine(index, 'unitPrice', event.target.value)
                          }
                          className="mt-2"
                          placeholder="0.00"
                          aria-invalid={
                            fieldErrors[`${prefix}.unitPrice`] ? true : undefined
                          }
                          aria-describedby={
                            fieldErrors[`${prefix}.unitPrice`]
                              ? `${formId}-${prefix}-price-error`
                              : undefined
                          }
                          variant={
                            fieldErrors[`${prefix}.unitPrice`]
                              ? 'failure'
                              : 'default'
                          }
                        />
                        <FieldError
                          id={`${formId}-${prefix}-price-error`}
                          message={fieldErrors[`${prefix}.unitPrice`]}
                        />
                      </div>

                      <div>
                        <Label htmlFor={`${formId}-${prefix}-tax`}>
                          Tax rate (%)
                          <span className="text-error" aria-hidden="true">
                            *
                          </span>
                        </Label>
                        <Input
                          id={`${formId}-${prefix}-tax`}
                          inputMode="decimal"
                          value={line.taxRate}
                          onChange={(event) =>
                            updateLine(index, 'taxRate', event.target.value)
                          }
                          className="mt-2"
                          placeholder="0"
                          aria-invalid={
                            fieldErrors[`${prefix}.taxRate`] ? true : undefined
                          }
                          aria-describedby={
                            fieldErrors[`${prefix}.taxRate`]
                              ? `${formId}-${prefix}-tax-error`
                              : undefined
                          }
                          variant={
                            fieldErrors[`${prefix}.taxRate`]
                              ? 'failure'
                              : 'default'
                          }
                        />
                        <FieldError
                          id={`${formId}-${prefix}-tax-error`}
                          message={fieldErrors[`${prefix}.taxRate`]}
                        />
                      </div>

                      <div>
                        <Label htmlFor={`${formId}-${prefix}-discount`}>
                          Discount ({currency})
                          <span className="text-error" aria-hidden="true">
                            *
                          </span>
                        </Label>
                        <Input
                          id={`${formId}-${prefix}-discount`}
                          inputMode="decimal"
                          value={line.discountAmount}
                          onChange={(event) =>
                            updateLine(
                              index,
                              'discountAmount',
                              event.target.value,
                            )
                          }
                          className="mt-2"
                          placeholder="0.00"
                          aria-invalid={
                            fieldErrors[`${prefix}.discountAmount`]
                              ? true
                              : undefined
                          }
                          aria-describedby={
                            fieldErrors[`${prefix}.discountAmount`]
                              ? `${formId}-${prefix}-discount-error`
                              : undefined
                          }
                          variant={
                            fieldErrors[`${prefix}.discountAmount`]
                              ? 'failure'
                              : 'default'
                          }
                        />
                        <FieldError
                          id={`${formId}-${prefix}-discount-error`}
                          message={fieldErrors[`${prefix}.discountAmount`]}
                        />
                      </div>

                      <div className="sm:col-span-2">
                        <SelectField
                          id={`${formId}-${prefix}-account`}
                          label="Revenue account"
                          value={line.revenueAccountId}
                          placeholder="Choose a revenue account"
                          options={revenueOptions}
                          error={fieldErrors[`${prefix}.revenueAccountId`]}
                          disabled={!canSubmit}
                          required
                          onChange={(value) =>
                            updateLine(index, 'revenueAccountId', value)
                          }
                        />
                      </div>

                      <div className="sm:col-span-2 lg:col-span-4">
                        <div className="flex flex-wrap gap-x-5 gap-y-1 text-xs text-muted-foreground">
                          <span>
                            Subtotal:{' '}
                            {formatInvoiceAmount(lineTotals.lineSubtotal, currency)}
                          </span>
                          <span>
                            Tax:{' '}
                            {formatInvoiceAmount(lineTotals.lineTaxAmount, currency)}
                          </span>
                          <span>
                            Total:{' '}
                            {formatInvoiceAmount(lineTotals.lineTotal, currency)}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="mt-5 rounded-lg border border-border p-4 dark:border-white/10">
            <dl className="ml-auto grid max-w-sm gap-2 text-sm">
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">Subtotal</dt>
                <dd className="tabular-nums">
                  {formatInvoiceAmount(preview.subtotal, currency)}
                </dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">Discount</dt>
                <dd className="tabular-nums">
                  {formatInvoiceAmount(preview.discountAmount, currency)}
                </dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">Tax</dt>
                <dd className="tabular-nums">
                  {formatInvoiceAmount(preview.taxAmount, currency)}
                </dd>
              </div>
              <div className="flex justify-between gap-4 border-t border-border pt-2 font-semibold dark:border-white/10">
                <dt>Total</dt>
                <dd className="tabular-nums">
                  {formatInvoiceAmount(preview.totalAmount, currency)}
                </dd>
              </div>
            </dl>
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
