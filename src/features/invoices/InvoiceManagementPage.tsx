import { useEffect, useState, type FormEvent } from 'react';
import { Plus, Search } from 'lucide-react';
import BreadcrumbComp from 'src/layouts/full/shared/breadcrumb/BreadcrumbComp';
import CardBox from 'src/components/shared/CardBox';
import { Alert, AlertDescription, AlertTitle } from 'src/components/ui/alert';
import { Button } from 'src/components/ui/button';
import { Input } from 'src/components/ui/input';
import { Label } from 'src/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from 'src/components/ui/select';
import { useAuth } from 'src/features/auth/useAuth';
import { useRole } from 'src/features/auth/useRole';
import { fetchCustomers } from 'src/features/parties/api';
import type { Customer } from 'src/features/parties/types';
import { invoiceApi } from './api';
import { ConfirmInvoiceActionDialog } from './ConfirmInvoiceActionDialog';
import { InvoiceDetailDialog } from './InvoiceDetailDialog';
import { InvoiceFormDialog } from './InvoiceFormDialog';
import { invoiceStatusMeta } from './display';
import { InvoiceTable } from './InvoiceTable';
import type {
  InvoiceAction,
  InvoiceRecord,
  InvoiceStatus,
} from './types';
import { useInvoiceList } from './useInvoiceList';

type InvoiceFilterType =
  | 'invoiceNumber'
  | 'status'
  | 'customer'
  | 'invoiceDate'
  | 'dueDate';

interface AppliedFilter {
  type: InvoiceFilterType;
  value: string;
}

const sortOptions = [
  { value: 'invoiceDate,desc', label: 'Newest invoice date' },
  { value: 'invoiceDate,asc', label: 'Oldest invoice date' },
  { value: 'dueDate,asc', label: 'Earliest due date' },
  { value: 'totalAmount,desc', label: 'Highest total' },
  { value: 'createdAt,desc', label: 'Recently created' },
];

const filterOptions: { value: InvoiceFilterType; label: string }[] = [
  { value: 'invoiceNumber', label: 'Invoice number' },
  { value: 'status', label: 'Status' },
  { value: 'customer', label: 'Customer' },
  { value: 'invoiceDate', label: 'Invoice date' },
  { value: 'dueDate', label: 'Due date' },
];

const statusOptions = Object.entries(invoiceStatusMeta).map(([value, meta]) => ({
  value: value as InvoiceStatus,
  label: meta.label,
}));

type FormState =
  | { mode: 'create'; record: null }
  | { mode: 'edit'; record: InvoiceRecord }
  | null;

type ActionState = { record: InvoiceRecord; action: InvoiceAction } | null;

function filterSummary(
  filter: AppliedFilter,
  customers: Customer[],
): string {
  if (filter.type === 'status') {
    return invoiceStatusMeta[filter.value as InvoiceStatus]?.label ?? filter.value;
  }
  if (filter.type === 'customer') {
    return (
      customers.find((customer) => customer.id === filter.value)?.name ??
      'selected customer'
    );
  }
  if (filter.type === 'invoiceDate') return `dated ${filter.value}`;
  if (filter.type === 'dueDate') return `due ${filter.value}`;
  return `"${filter.value}"`;
}

export function InvoiceManagementPage() {
  const { organization } = useAuth();
  const { role, membershipError } = useRole();

  const [filterType, setFilterType] =
    useState<InvoiceFilterType>('invoiceNumber');
  const [filterValue, setFilterValue] = useState('');
  const [appliedFilter, setAppliedFilter] = useState<AppliedFilter | null>(null);
  const [sort, setSort] = useState('invoiceDate,desc');
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(10);
  const [formState, setFormState] = useState<FormState>(null);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [actionState, setActionState] = useState<ActionState>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [filterCustomers, setFilterCustomers] = useState<Customer[]>([]);
  const [filterCustomersLoading, setFilterCustomersLoading] = useState(false);
  const [filterCustomersError, setFilterCustomersError] = useState<string | null>(
    null,
  );
  const [reloadCustomersKey, setReloadCustomersKey] = useState(0);

  const canWrite =
    role === 'OWNER' || role === 'ADMIN' || role === 'ACCOUNTANT';
  const enabled = Boolean(organization?.id);
  const currency = organization?.currency ?? 'USD';

  const statusFilter =
    appliedFilter?.type === 'status'
      ? (appliedFilter.value as InvoiceStatus)
      : '';
  const customerFilter =
    appliedFilter?.type === 'customer' ? appliedFilter.value : '';
  const invoiceNumberFilter =
    appliedFilter?.type === 'invoiceNumber' ? appliedFilter.value : '';
  const invoiceDateFilter =
    appliedFilter?.type === 'invoiceDate' ? appliedFilter.value : '';
  const dueDateFilter =
    appliedFilter?.type === 'dueDate' ? appliedFilter.value : '';

  const { status, data, error, refresh } = useInvoiceList({
    enabled,
    page,
    size: pageSize,
    status: statusFilter,
    customerId: customerFilter,
    invoiceNumber: invoiceNumberFilter,
    invoiceDate: invoiceDateFilter,
    dueDate: dueDateFilter,
    sort,
  });

  useEffect(() => {
    if (!enabled) {
      setFilterCustomers([]);
      return;
    }

    const controller = new AbortController();
    let active = true;
    setFilterCustomersLoading(true);
    setFilterCustomersError(null);

    void (async () => {
      try {
        const result = await fetchCustomers(
          { page: 0, size: 200, search: '', sort: 'name,asc' },
          controller.signal,
        );
        if (!active) return;
        setFilterCustomers(result.content);
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
        setFilterCustomers([]);
        setFilterCustomersError(
          'Unable to load customer choices. Try again before filtering by customer.',
        );
      } finally {
        if (active) setFilterCustomersLoading(false);
      }
    })();

    return () => {
      active = false;
      controller.abort();
    };
  }, [enabled, reloadCustomersKey]);

  useEffect(() => {
    if (status !== 'success' || !data) return;

    if (data.totalPages === 0 && page > 0) {
      setPage(0);
    } else if (data.totalPages > 0 && page >= data.totalPages) {
      setPage(data.totalPages - 1);
    }
  }, [status, data, page]);

  function handleFilterTypeChange(value: string) {
    setFilterType(value as InvoiceFilterType);
    setFilterValue('');
    setAppliedFilter(null);
    setPage(0);
  }

  function handleApplyFilter(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const value = filterValue.trim();
    if (!value) {
      setAppliedFilter(null);
    } else {
      setAppliedFilter({ type: filterType, value });
    }
    setPage(0);
  }

  function clearFilter() {
    setFilterType('invoiceNumber');
    setFilterValue('');
    setAppliedFilter(null);
    setPage(0);
  }

  function handleSortChange(value: string) {
    setSort(value);
    setPage(0);
  }

  function handlePageSizeChange(value: number) {
    setPageSize(value);
    setPage(0);
  }

  function openCreate() {
    setNotice(null);
    setFormState({ mode: 'create', record: null });
  }

  function openEdit(record: InvoiceRecord) {
    setDetailId(null);
    setNotice(null);
    setFormState({ mode: 'edit', record });
  }

  function openAction(record: InvoiceRecord, action: InvoiceAction) {
    setDetailId(null);
    setNotice(null);
    setActionState({ record, action });
  }

  function handleSaved(_record: InvoiceRecord, mode: 'create' | 'edit') {
    setFormState(null);
    setNotice(mode === 'create' ? 'Draft invoice created.' : 'Draft invoice updated.');
    if (mode === 'create') setPage(0);
    refresh();
  }

  async function handleAction(record: InvoiceRecord, action: InvoiceAction) {
    const saved =
      action === 'issue'
        ? await invoiceApi.issue(record.id)
        : await invoiceApi.void(record.id);

    setActionState(null);
    setNotice(
      action === 'issue'
        ? `Invoice ${saved.invoiceNumber} issued and posted.`
        : `Invoice ${saved.invoiceNumber} voided.`,
    );
    refresh();
  }

  const isLoading = status === 'idle' || status === 'loading';
  const isFiltered = appliedFilter !== null;
  const hasFilterValue = filterValue.trim().length > 0;

  return (
    <>
      <BreadcrumbComp
        title="Invoices"
        items={[{ title: 'Dashboard', to: '/' }, { title: 'Invoices' }]}
      />

      {(membershipError || (role !== null && !canWrite)) && (
        <Alert variant="lightwarning" className="mb-4">
          <AlertTitle>Read-only access</AlertTitle>
          <AlertDescription>
            {membershipError
              ? 'Your organization membership could not be verified. You can view invoices but cannot modify them.'
              : 'Your role can view invoices but cannot create, edit, issue, or void them.'}
          </AlertDescription>
        </Alert>
      )}

      {notice && (
        <Alert variant="lightsuccess" className="mb-4">
          <AlertTitle>{notice}</AlertTitle>
          <AlertDescription className="mt-2 flex items-center justify-between gap-4">
            <span>The invoice list has been refreshed.</span>
            <Button
              type="button"
              variant="ghostsuccess"
              size="sm"
              onClick={() => setNotice(null)}
            >
              Dismiss
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {!organization && (
        <Alert variant="lighterror">
          <AlertTitle>No organization available</AlertTitle>
          <AlertDescription>
            Sign in with an organization account to view invoices.
          </AlertDescription>
        </Alert>
      )}

      {organization && (
        <CardBox>
          <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h5 className="text-lg font-semibold">Invoice register</h5>
              <p className="mt-1 text-sm text-muted-foreground">
                Create draft invoices and review their accounting status for{' '}
                {organization.name}.
              </p>
            </div>
            {canWrite && (
              <Button type="button" onClick={openCreate}>
                <Plus className="size-4" />
                Create invoice
              </Button>
            )}
          </div>

          <div className="border-t border-border p-4 dark:border-white/10">
            <form
              onSubmit={handleApplyFilter}
              className="flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between"
            >
              <div className="flex flex-1 flex-col gap-2 sm:flex-row sm:items-end">
                <div className="w-full sm:w-[170px]">
                  <Label
                    htmlFor="invoice-filter-type"
                    className="text-sm text-muted-foreground"
                  >
                    Filter by
                  </Label>
                  <Select
                    value={filterType}
                    onValueChange={handleFilterTypeChange}
                  >
                    <SelectTrigger id="invoice-filter-type" className="mt-1 w-full">
                      <SelectValue placeholder="Filter field" />
                    </SelectTrigger>
                    <SelectContent>
                      {filterOptions.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="w-full sm:min-w-[190px] sm:max-w-sm">
                  {filterType === 'invoiceNumber' && (
                    <>
                      <Label
                        htmlFor="invoice-filter-invoiceNumber"
                        className="text-sm text-muted-foreground"
                      >
                        Invoice number
                      </Label>
                      <div className="relative mt-1">
                        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                        <Input
                          id="invoice-filter-invoiceNumber"
                          value={filterValue}
                          onChange={(event) =>
                            setFilterValue(event.target.value)
                          }
                          placeholder="Search invoice number"
                          aria-label="Invoice number filter"
                          className="pl-9"
                        />
                      </div>
                    </>
                  )}

                  {filterType === 'status' && (
                    <>
                      <Label
                        htmlFor="invoice-filter-status"
                        className="text-sm text-muted-foreground"
                      >
                        Status
                      </Label>
                      <Select
                        value={filterValue}
                        onValueChange={setFilterValue}
                      >
                        <SelectTrigger
                          id="invoice-filter-status"
                          className="mt-1 w-full"
                          aria-label="Status filter"
                        >
                          <SelectValue placeholder="Choose a status" />
                        </SelectTrigger>
                        <SelectContent>
                          {statusOptions.map((option) => (
                            <SelectItem key={option.value} value={option.value}>
                              {option.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </>
                  )}

                  {filterType === 'customer' && (
                    <>
                      <Label
                        htmlFor="invoice-filter-customer"
                        className="text-sm text-muted-foreground"
                      >
                        Customer
                      </Label>
                      <Select
                        value={filterValue}
                        onValueChange={setFilterValue}
                        disabled={
                          filterCustomersLoading || filterCustomers.length === 0
                        }
                      >
                        <SelectTrigger
                          id="invoice-filter-customer"
                          className="mt-1 w-full"
                          aria-label="Customer filter"
                        >
                          <SelectValue
                            placeholder={
                              filterCustomersLoading
                                ? 'Loading customers...'
                                : 'Choose a customer'
                            }
                          />
                        </SelectTrigger>
                        <SelectContent>
                          {filterCustomers.map((customer) => (
                            <SelectItem key={customer.id} value={customer.id}>
                              {customer.name}
                              {customer.active ? '' : ' (inactive)'}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {filterCustomersError && (
                        <p className="mt-1 text-xs text-error">
                          {filterCustomersError}{' '}
                          <button
                            type="button"
                            className="font-medium underline"
                            onClick={() =>
                              setReloadCustomersKey((key) => key + 1)
                            }
                          >
                            Retry
                          </button>
                        </p>
                      )}
                    </>
                  )}

                  {filterType === 'invoiceDate' && (
                    <>
                      <Label
                        htmlFor="invoice-filter-invoiceDate"
                        className="text-sm text-muted-foreground"
                      >
                        Invoice date
                      </Label>
                      <Input
                        id="invoice-filter-invoiceDate"
                        type="date"
                        value={filterValue}
                        onChange={(event) => setFilterValue(event.target.value)}
                        aria-label="Invoice date filter"
                        className="mt-1"
                      />
                    </>
                  )}

                  {filterType === 'dueDate' && (
                    <>
                      <Label
                        htmlFor="invoice-filter-dueDate"
                        className="text-sm text-muted-foreground"
                      >
                        Due date
                      </Label>
                      <Input
                        id="invoice-filter-dueDate"
                        type="date"
                        value={filterValue}
                        onChange={(event) => setFilterValue(event.target.value)}
                        aria-label="Due date filter"
                        className="mt-1"
                      />
                    </>
                  )}
                </div>

                <div className="flex gap-2">
                  <Button
                    type="submit"
                    variant="outline"
                    disabled={!hasFilterValue && !isFiltered}
                  >
                    Apply filter
                  </Button>
                  {(isFiltered || hasFilterValue) && (
                    <Button type="button" variant="ghost" onClick={clearFilter}>
                      Clear
                    </Button>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Label
                  htmlFor="invoice-sort"
                  className="text-sm text-muted-foreground"
                >
                  Sort
                </Label>
                <Select value={sort} onValueChange={handleSortChange}>
                  <SelectTrigger id="invoice-sort" className="w-[190px]">
                    <SelectValue placeholder="Sort order" />
                  </SelectTrigger>
                  <SelectContent>
                    {sortOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </form>

            {isFiltered && (
              <p className="mt-3 text-xs text-muted-foreground">
                Showing invoices with{' '}
                {filterOptions.find((option) => option.value === appliedFilter.type)
                  ?.label.toLowerCase() ?? 'filter'}{' '}
                {filterSummary(appliedFilter, filterCustomers)}.
              </p>
            )}
          </div>

          {status === 'error' ? (
            <div className="p-4">
              <Alert variant="lighterror">
                <AlertTitle>Unable to load invoices</AlertTitle>
                <AlertDescription>
                  <p>{error}</p>
                  <Button
                    type="button"
                    variant="outlineerror"
                    size="sm"
                    className="mt-3"
                    onClick={refresh}
                  >
                    Try again
                  </Button>
                </AlertDescription>
              </Alert>
            </div>
          ) : (
            <InvoiceTable
              records={data?.content ?? []}
              currency={currency}
              isLoading={isLoading}
              canWrite={canWrite}
              isFiltered={isFiltered}
              page={page}
              pageSize={pageSize}
              totalPages={data?.totalPages ?? 0}
              totalElements={data?.totalElements ?? 0}
              onPageChange={setPage}
              onPageSizeChange={handlePageSizeChange}
              onClearFilters={clearFilter}
              onView={(record) => setDetailId(record.id)}
              onEdit={openEdit}
              onAction={openAction}
            />
          )}
        </CardBox>
      )}

      <InvoiceFormDialog
        open={formState !== null}
        mode={formState?.mode ?? 'create'}
        record={formState?.record ?? null}
        currency={currency}
        onOpenChange={(open) => {
          if (!open) setFormState(null);
        }}
        onSaved={handleSaved}
      />

      <InvoiceDetailDialog
        open={detailId !== null}
        invoiceId={detailId}
        currency={currency}
        canWrite={canWrite}
        onOpenChange={(open) => {
          if (!open) setDetailId(null);
        }}
        onEdit={openEdit}
        onAction={openAction}
      />

      <ConfirmInvoiceActionDialog
        open={actionState !== null}
        record={actionState?.record ?? null}
        action={actionState?.action ?? 'issue'}
        currency={currency}
        onOpenChange={(open) => {
          if (!open) setActionState(null);
        }}
        onConfirm={handleAction}
      />
    </>
  );
}
