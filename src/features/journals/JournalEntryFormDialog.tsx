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
import { journalEntryApi } from './api';
import { getJournalEntryErrorMessage, mapJournalEntryFieldErrors } from './errors';
import type {
  AccountOption,
  JournalEntryApi,
  JournalEntryFormValues,
  JournalEntryLookups,
  JournalEntryRecord,
} from './types';
import {
  emptyJournalEntryForm,
  hasJournalEntryChanges,
  hasJournalEntryFormErrors,
  journalEntryToForm,
  toCreateJournalEntryInput,
  toUpdateJournalEntryInput,
  validateJournalEntryForm,
  type JournalEntryFormErrors,
} from './validation';

type Mode = 'create' | 'edit';

interface Props {
  open: boolean;
  mode: Mode;
  record: JournalEntryRecord | null;
  organizationId: string;
  onOpenChange: (open: boolean) => void;
  onSaved: (record: JournalEntryRecord, mode: Mode) => void;
  api?: JournalEntryApi;
}

function accountLabel(account: AccountOption) {
  return `${account.code} — ${account.name}${account.active ? '' : ' (inactive)'}`;
}

export function JournalEntryFormDialog({
  open,
  mode,
  record,
  organizationId,
  onOpenChange,
  onSaved,
  api = journalEntryApi,
}: Props) {
  const formId = useId();
  const [values, setValues] = useState<JournalEntryFormValues>(emptyJournalEntryForm);
  const [fieldErrors, setFieldErrors] = useState<JournalEntryFormErrors>({});
  const [error, setError] = useState<string | null>(null);
  const [lookups, setLookups] = useState<JournalEntryLookups | null>(null);
  const [lookupsLoading, setLookupsLoading] = useState(false);
  const [lookupsError, setLookupsError] = useState<string | null>(null);
  const [reloadLookups, setReloadLookups] = useState(0);
  const [isSaving, setIsSaving] = useState(false);
  const savingRef = useRef(false);

  const isEdit = mode === 'edit' && record !== null;
  const hasChanges = isEdit ? hasJournalEntryChanges(values, record) : true;

  useEffect(() => {
    if (!open) return;
    setValues(record ? journalEntryToForm(record) : emptyJournalEntryForm);
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
        const data = await api.lookups(controller.signal);
        if (!active) return;
        setLookups(data);
      } catch (loadError) {
        if (!active) return;
        if (
          typeof loadError === 'object' &&
          loadError !== null &&
          'name' in loadError &&
          loadError.name === 'AbortError'
        )
          return;
        setLookups(null);
        setLookupsError(getJournalEntryErrorMessage(loadError, 'lookup'));
      } finally {
        if (active) setLookupsLoading(false);
      }
    })();
    return () => {
      active = false;
      controller.abort();
    };
  }, [api, open, reloadLookups]);

  const accounts = (lookups?.accounts ?? []).filter(
    (account) => !organizationId || account.organizationId === organizationId,
  );
  const accountOptions = [...accounts];

  if (record) {
    record.lines.forEach((line) => {
      if (accountOptions.some((account) => account.id === line.accountId)) return;
      accountOptions.push({
        id: line.accountId,
        organizationId: record.organizationId,
        code: line.accountCode,
        name: line.accountName,
        type: '',
        active: false,
      });
    });
  }

  function updateLine(index: number, field: string, value: string) {
    setValues((current) => {
      const lines = [...current.lines];
      lines[index] = { ...lines[index], [field]: value };
      return { ...current, lines };
    });
  }

  function addLine() {
    setValues((current) => ({
      ...current,
      lines: [...current.lines, { accountId: '', description: '', debitAmount: '', creditAmount: '' }],
    }));
  }

  function removeLine(index: number) {
    setValues((current) => {
      if (current.lines.length <= 2) return current;
      const lines = current.lines.filter((_, i) => i !== index);
      return { ...current, lines };
    });
  }

  function handleOpenChange(nextOpen: boolean) {
    if (savingRef.current) return;
    onOpenChange(nextOpen);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (savingRef.current) return;
    if (isEdit && !hasChanges) return;

    const validationErrors = validateJournalEntryForm(values);
    if (hasJournalEntryFormErrors(validationErrors)) {
      setFieldErrors(validationErrors);
      setError(null);
      return;
    }

    savingRef.current = true;
    setIsSaving(true);
    setError(null);
    setFieldErrors({});

    try {
      let saved: JournalEntryRecord;
      if (isEdit && record) {
        const updateInput = toUpdateJournalEntryInput(values, record);
        saved = await api.update(record.id, updateInput);
      } else {
        saved = await api.create(toCreateJournalEntryInput(values));
      }
      onSaved(saved, mode);
    } catch (submitError) {
      setFieldErrors(mapJournalEntryFieldErrors(submitError));
      setError(getJournalEntryErrorMessage(submitError, isEdit ? 'update' : 'create'));
    } finally {
      savingRef.current = false;
      setIsSaving(false);
    }
  }

  const isCreate = !isEdit;
  const title = isCreate ? 'Create journal entry' : 'Edit draft journal entry';
  const submitLabel = isCreate ? 'Create draft' : 'Save changes';
  const lookupsReady =
    Boolean(lookups) && !lookupsLoading && accounts.length > 0;
  const saveDisabled = isSaving || !lookupsReady || (isEdit && !hasChanges);

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription className="text-muted-foreground">
            {isCreate
              ? 'Create a draft journal entry. Post it later to finalize.'
              : 'Update this draft journal entry. Posted entries cannot be edited.'}
          </DialogDescription>
        </DialogHeader>

        {error && (
          <Alert variant="lighterror">
            <AlertTitle>Unable to save journal entry</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {lookupsError && (
          <Alert variant="lighterror">
            <AlertTitle>Unable to load accounts</AlertTitle>
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
            Loading accounts...
          </p>
        )}

        {!lookupsError && !lookupsLoading && lookups && accounts.length === 0 && (
          <Alert variant="lightwarning">
            <AlertTitle>No active accounts available</AlertTitle>
            <AlertDescription>
              Add active accounts in Chart of Accounts before creating a journal
              entry for this organization.
            </AlertDescription>
          </Alert>
        )}

        <form onSubmit={handleSubmit} noValidate>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor={`${formId}-entryNumber`}>
                Entry number
                <span className="text-error" aria-hidden="true">
                  *
                </span>
              </Label>
              <Input
                id={`${formId}-entryNumber`}
                value={values.entryNumber}
                onChange={(event) =>
                  setValues((c) => ({ ...c, entryNumber: event.target.value }))
                }
                maxLength={50}
                className="mt-2"
                variant={fieldErrors.entryNumber ? 'failure' : 'default'}
                aria-invalid={Boolean(fieldErrors.entryNumber)}
                aria-describedby={
                  fieldErrors.entryNumber ? `${formId}-entryNumber-error` : undefined
                }
              />
              {fieldErrors.entryNumber && (
                <p id={`${formId}-entryNumber-error`} className="mt-1 text-sm text-error">
                  {fieldErrors.entryNumber}
                </p>
              )}
            </div>
            <div>
              <Label htmlFor={`${formId}-entryDate`}>
                Entry date
                <span className="text-error" aria-hidden="true">
                  *
                </span>
              </Label>
              <Input
                id={`${formId}-entryDate`}
                type="date"
                value={values.entryDate}
                onChange={(event) =>
                  setValues((c) => ({ ...c, entryDate: event.target.value }))
                }
                className="mt-2"
                variant={fieldErrors.entryDate ? 'failure' : 'default'}
                aria-invalid={Boolean(fieldErrors.entryDate)}
                aria-describedby={
                  fieldErrors.entryDate ? `${formId}-entryDate-error` : undefined
                }
              />
              {fieldErrors.entryDate && (
                <p id={`${formId}-entryDate-error`} className="mt-1 text-sm text-error">
                  {fieldErrors.entryDate}
                </p>
              )}
            </div>
            <div className="sm:col-span-2">
              <Label htmlFor={`${formId}-reference`}>Reference</Label>
              <Input
                id={`${formId}-reference`}
                value={values.reference}
                onChange={(event) =>
                  setValues((c) => ({ ...c, reference: event.target.value }))
                }
                maxLength={100}
                className="mt-2"
                variant={fieldErrors.reference ? 'failure' : 'default'}
                aria-invalid={Boolean(fieldErrors.reference)}
                aria-describedby={
                  fieldErrors.reference ? `${formId}-reference-error` : undefined
                }
              />
              {fieldErrors.reference && (
                <p id={`${formId}-reference-error`} className="mt-1 text-sm text-error">
                  {fieldErrors.reference}
                </p>
              )}
            </div>
            <div className="sm:col-span-2">
              <Label htmlFor={`${formId}-description`}>Description</Label>
              <Textarea
                id={`${formId}-description`}
                value={values.description}
                onChange={(event) =>
                  setValues((c) => ({ ...c, description: event.target.value }))
                }
                maxLength={500}
                rows={2}
                className="mt-2"
                aria-invalid={Boolean(fieldErrors.description)}
                aria-describedby={
                  fieldErrors.description ? `${formId}-description-error` : undefined
                }
              />
              {fieldErrors.description && (
                <p id={`${formId}-description-error`} className="mt-1 text-sm text-error">
                  {fieldErrors.description}
                </p>
              )}
            </div>
          </div>

          <div className="mt-6">
            <div className="mb-2 flex items-center justify-between">
              <h6 className="font-semibold">Lines</h6>
              <Button type="button" variant="outline" size="sm" onClick={addLine}>
                Add line
              </Button>
            </div>
            {fieldErrors.lines && (
              <p className="mb-2 text-sm text-error">{fieldErrors.lines}</p>
            )}
            {fieldErrors.balance && (
              <p className="mb-2 text-sm text-error">{fieldErrors.balance}</p>
            )}
            <div className="space-y-3">
              {values.lines.map((line, index) => {
                const lineError = fieldErrors.lineErrors?.[index];
                const generalErrorId = `${formId}-line-${index}-general-error`;
                return (
                  <div
                    key={index}
                    className="grid gap-2 rounded-lg border border-border p-3 sm:grid-cols-5 dark:border-white/10"
                  >
                    <div className="sm:col-span-2">
                      <Label htmlFor={`${formId}-line-${index}-account`}>
                        <span className="sr-only">Line {index + 1} </span>
                        Account
                      </Label>
                      <Select
                        value={line.accountId}
                        onValueChange={(value) => updateLine(index, 'accountId', value)}
                        disabled={!lookupsReady}
                      >
                        <SelectTrigger
                          id={`${formId}-line-${index}-account`}
                          className="mt-1 w-full"
                          aria-invalid={Boolean(lineError?.accountId)}
                          aria-describedby={
                            lineError?.accountId
                              ? `${formId}-line-${index}-account-error`
                              : undefined
                          }
                        >
                          <SelectValue placeholder="Choose account" />
                        </SelectTrigger>
                        <SelectContent>
                          {accountOptions.map((account) => (
                            <SelectItem
                              key={account.id}
                              value={account.id}
                              disabled={!account.active}
                            >
                              {accountLabel(account)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {lineError?.accountId && (
                        <p
                          id={`${formId}-line-${index}-account-error`}
                          className="mt-1 text-sm text-error"
                        >
                          {lineError.accountId}
                        </p>
                      )}
                    </div>
                    <div>
                      <Label htmlFor={`${formId}-line-${index}-description`}>
                        <span className="sr-only">Line {index + 1} </span>
                        Description
                      </Label>
                      <Input
                        id={`${formId}-line-${index}-description`}
                        value={line.description}
                        onChange={(event) =>
                          updateLine(index, 'description', event.target.value)
                        }
                        maxLength={500}
                        className="mt-1"
                        variant={lineError?.description ? 'failure' : 'default'}
                        aria-invalid={Boolean(lineError?.description)}
                        aria-describedby={
                          lineError?.description
                            ? `${formId}-line-${index}-description-error`
                            : undefined
                        }
                      />
                      {lineError?.description && (
                        <p
                          id={`${formId}-line-${index}-description-error`}
                          className="mt-1 text-sm text-error"
                        >
                          {lineError.description}
                        </p>
                      )}
                    </div>
                    <div>
                      <Label htmlFor={`${formId}-line-${index}-debit`}>
                        <span className="sr-only">Line {index + 1} </span>
                        Debit
                      </Label>
                      <Input
                        id={`${formId}-line-${index}-debit`}
                        inputMode="decimal"
                        value={line.debitAmount}
                        onChange={(event) =>
                          updateLine(index, 'debitAmount', event.target.value)
                        }
                        className="mt-1"
                        placeholder="0.0000"
                        variant={lineError?.debitAmount ? 'failure' : 'default'}
                        aria-invalid={Boolean(lineError?.debitAmount)}
                        aria-describedby={
                          lineError?.debitAmount
                            ? `${formId}-line-${index}-debit-error`
                            : undefined
                        }
                      />
                      {lineError?.debitAmount && (
                        <p
                          id={`${formId}-line-${index}-debit-error`}
                          className="mt-1 text-sm text-error"
                        >
                          {lineError.debitAmount}
                        </p>
                      )}
                    </div>
                    <div>
                      <Label htmlFor={`${formId}-line-${index}-credit`}>
                        <span className="sr-only">Line {index + 1} </span>
                        Credit
                      </Label>
                      <Input
                        id={`${formId}-line-${index}-credit`}
                        inputMode="decimal"
                        value={line.creditAmount}
                        onChange={(event) =>
                          updateLine(index, 'creditAmount', event.target.value)
                        }
                        className="mt-1"
                        placeholder="0.0000"
                        variant={lineError?.creditAmount ? 'failure' : 'default'}
                        aria-invalid={Boolean(lineError?.creditAmount)}
                        aria-describedby={
                          lineError?.creditAmount
                            ? `${formId}-line-${index}-credit-error`
                            : undefined
                        }
                      />
                      {lineError?.creditAmount && (
                        <p
                          id={`${formId}-line-${index}-credit-error`}
                          className="mt-1 text-sm text-error"
                        >
                          {lineError.creditAmount}
                        </p>
                      )}
                    </div>
                    {lineError?.general && (
                      <p id={generalErrorId} className="text-sm text-error sm:col-span-5">
                        {lineError.general}
                      </p>
                    )}
                    <div className="sm:col-span-5 flex justify-end">
                      <Button
                        type="button"
                        variant="ghosterror"
                        size="sm"
                        onClick={() => removeLine(index)}
                        disabled={values.lines.length <= 2}
                      >
                        Remove
                      </Button>
                    </div>
                  </div>
                );
              })}
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
            <Button type="submit" disabled={saveDisabled}>
              {isSaving ? 'Saving...' : submitLabel}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
