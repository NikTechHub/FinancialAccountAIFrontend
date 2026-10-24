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
import { expenseApi } from './api';
import { ConfirmExpenseActionDialog } from './ConfirmExpenseActionDialog';
import { ExpenseFormDialog } from './ExpenseFormDialog';
import { ExpenseTable } from './ExpenseTable';
import type { ExpenseAction, ExpenseRecord } from './types';
import { useExpenseList } from './useExpenseList';

const sortOptions = [
  { value: 'expenseDate,desc', label: 'Newest expense date' },
  { value: 'expenseDate,asc', label: 'Oldest expense date' },
  { value: 'amount,desc', label: 'Highest amount' },
  { value: 'amount,asc', label: 'Lowest amount' },
  { value: 'createdAt,desc', label: 'Recently created' },
];

type FormState =
  | { mode: 'create'; record: null }
  | { mode: 'edit'; record: ExpenseRecord }
  | null;

type ActionState = { record: ExpenseRecord; action: ExpenseAction } | null;

export function ExpenseManagementPage() {
  const { organization } = useAuth();
  const { role, membershipError } = useRole();

  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState('expenseDate,desc');
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(10);
  const [formState, setFormState] = useState<FormState>(null);
  const [actionState, setActionState] = useState<ActionState>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const canWrite =
    role === 'OWNER' || role === 'ADMIN' || role === 'ACCOUNTANT';
  const enabled = Boolean(organization?.id);
  const currency = organization?.currency ?? 'USD';

  const { status, data, error, refresh } = useExpenseList({
    enabled,
    page,
    size: pageSize,
    search,
    status: '',
    sort,
  });

  useEffect(() => {
    const nextSearch = searchInput.trim();
    if (nextSearch === search) return;

    const timer = window.setTimeout(() => {
      setSearch(nextSearch);
      setPage(0);
    }, 350);

    return () => window.clearTimeout(timer);
  }, [searchInput, search]);

  useEffect(() => {
    if (status !== 'success' || !data) return;

    if (data.totalPages === 0 && page > 0) {
      setPage(0);
    } else if (data.totalPages > 0 && page >= data.totalPages) {
      setPage(data.totalPages - 1);
    }
  }, [status, data, page]);

  function handleSearchSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSearch(searchInput.trim());
    setPage(0);
  }

  function clearSearch() {
    setSearchInput('');
    setSearch('');
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

  function openEdit(record: ExpenseRecord) {
    setNotice(null);
    setFormState({ mode: 'edit', record });
  }

  function openAction(record: ExpenseRecord, action: ExpenseAction) {
    setNotice(null);
    setActionState({ record, action });
  }

  function handleSaved(_record: ExpenseRecord, mode: 'create' | 'edit') {
    setFormState(null);
    setNotice(
      mode === 'create'
        ? 'Draft expense created.'
        : 'Draft expense updated.',
    );
    if (mode === 'create') setPage(0);
    refresh();
  }

  async function handleAction(record: ExpenseRecord, action: ExpenseAction) {
    if (action === 'record') {
      await expenseApi.record(record.id);
      setNotice('Expense recorded. The journal entry has been posted.');
    } else {
      await expenseApi.void(record.id);
      setNotice('Draft expense voided.');
    }
    setActionState(null);
    refresh();
  }

  const isLoading = status === 'idle' || status === 'loading';
  const isFiltered = search.length > 0;

  return (
    <>
      <BreadcrumbComp
        title="Expenses"
        items={[{ title: 'Dashboard', to: '/' }, { title: 'Expenses' }]}
      />

      {(membershipError || (role !== null && !canWrite)) && (
        <Alert variant="lightwarning" className="mb-4">
          <AlertTitle>Read-only access</AlertTitle>
          <AlertDescription>
            {membershipError
              ? 'Your organization membership could not be verified. You can view expenses but cannot modify them.'
              : 'Your role can view expenses but cannot create, edit, record, or void them.'}
          </AlertDescription>
        </Alert>
      )}

      {notice && (
        <Alert variant="lightsuccess" className="mb-4">
          <AlertTitle>{notice}</AlertTitle>
          <AlertDescription className="mt-2 flex items-center justify-between gap-4">
            <span>The expense list has been refreshed.</span>
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
            Sign in with an organization account to view expenses.
          </AlertDescription>
        </Alert>
      )}

      {organization && (
        <CardBox>
          <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h5 className="text-lg font-semibold">Expense register</h5>
              <p className="mt-1 text-sm text-muted-foreground">
                Draft, record, and review expenses for {organization.name}.
              </p>
            </div>
            {canWrite && (
              <Button type="button" onClick={openCreate}>
                <Plus className="size-4" />
                Add expense
              </Button>
            )}
          </div>

          <div className="flex flex-col gap-3 border-t border-border p-4 lg:flex-row lg:items-center lg:justify-between dark:border-white/10">
            <form
              role="search"
              onSubmit={handleSearchSubmit}
              className="flex w-full items-center gap-2 lg:max-w-xl"
            >
              <div className="relative flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={searchInput}
                  onChange={(event) => setSearchInput(event.target.value)}
                  placeholder="Search reference or description"
                  aria-label="Search reference or description"
                  className="pl-9"
                />
              </div>
              <Button type="submit" variant="outline">
                Search
              </Button>
              {searchInput && (
                <Button type="button" variant="ghost" onClick={clearSearch}>
                  Clear
                </Button>
              )}
            </form>

            <div className="flex items-center gap-2">
              <Label htmlFor="expense-sort" className="text-sm text-muted-foreground">
                Sort
              </Label>
              <Select value={sort} onValueChange={handleSortChange}>
                <SelectTrigger id="expense-sort" className="w-[190px]">
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
          </div>

          {status === 'error' ? (
            <div className="p-4">
              <Alert variant="lighterror">
                <AlertTitle>Unable to load expenses</AlertTitle>
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
            <ExpenseTable
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
              onClearFilters={clearSearch}
              onEdit={openEdit}
              onAction={openAction}
            />
          )}
        </CardBox>
      )}

      <ExpenseFormDialog
        open={formState !== null}
        mode={formState?.mode ?? 'create'}
        record={formState?.record ?? null}
        currency={currency}
        onOpenChange={(open) => {
          if (!open) setFormState(null);
        }}
        onSaved={handleSaved}
      />

      <ConfirmExpenseActionDialog
        open={actionState !== null}
        record={actionState?.record ?? null}
        action={actionState?.action ?? 'record'}
        currency={currency}
        onOpenChange={(open) => {
          if (!open) setActionState(null);
        }}
        onConfirm={handleAction}
      />
    </>
  );
}
