import { useEffect, useState, type FormEvent } from 'react';
import { Plus, Search } from 'lucide-react';
import { useSearchParams } from 'react-router';
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
import { journalEntryApi } from './api';
import { ConfirmJournalActionDialog } from './ConfirmJournalActionDialog';
import { JournalDetailDialog } from './JournalDetailDialog';
import { JournalEntryFormDialog } from './JournalEntryFormDialog';
import { JournalTable } from './JournalTable';
import type {
  JournalEntryAction,
  JournalEntryApi,
  JournalEntryRecord,
  JournalEntryStatus,
} from './types';
import { useJournalList } from './useJournalList';
import { journalEntryStatusOptions } from './display';

const sortOptions = [
  { value: 'entryDate,desc', label: 'Newest entry date' },
  { value: 'entryDate,asc', label: 'Oldest entry date' },
  { value: 'entryNumber,asc', label: 'Entry # A–Z' },
  { value: 'entryNumber,desc', label: 'Entry # Z–A' },
  { value: 'createdAt,desc', label: 'Recently created' },
];

type FormState =
  | { mode: 'create'; record: null }
  | { mode: 'edit'; record: JournalEntryRecord }
  | null;

type ActionState = { record: JournalEntryRecord; action: JournalEntryAction } | null;

interface JournalManagementPageProps {
  api?: JournalEntryApi;
}

export function JournalManagementPage({
  api = journalEntryApi,
}: JournalManagementPageProps) {
  const { organization } = useAuth();
  const { role, membershipError } = useRole();
  const [searchParams, setSearchParams] = useSearchParams();

  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<JournalEntryStatus | ''>('');
  const [entryDateFilter, setEntryDateFilter] = useState('');
  const [sort, setSort] = useState('entryDate,desc');
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(10);
  const [formState, setFormState] = useState<FormState>(null);
  const [detailId, setDetailId] = useState<string | null>(
    searchParams.get('entryId'),
  );
  const [actionState, setActionState] = useState<ActionState>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const canWrite =
    role === 'OWNER' || role === 'ADMIN' || role === 'ACCOUNTANT';
  const enabled = Boolean(organization?.id);
  const currency = organization?.currency ?? 'USD';
  const linkedEntryId = searchParams.get('entryId');
  const searchDisabled = Boolean(statusFilter || entryDateFilter);
  const facetsDisabled = search.length > 0 || searchInput.trim().length > 0;

  const { status, data, error, refresh } = useJournalList({
    api,
    enabled,
    page,
    size: pageSize,
    status: statusFilter,
    entryDate: entryDateFilter,
    entryNumber: search,
    reference: search,
    sort,
  });

  useEffect(() => {
    if (!linkedEntryId) return;
    setDetailId(linkedEntryId);
    setNotice(null);
  }, [linkedEntryId]);

  useEffect(() => {
    if (searchDisabled) return;
    const nextSearch = searchInput.trim();
    if (nextSearch === search) return;
    const timer = window.setTimeout(() => {
      setSearch(nextSearch);
      setPage(0);
    }, 350);
    return () => window.clearTimeout(timer);
  }, [searchDisabled, searchInput, search]);

  useEffect(() => {
    if (status !== 'success' || !data) return;
    if (data.totalPages === 0 && page > 0) {
      setPage(0);
    } else if (data.totalPages > 0 && page >= data.totalPages) {
      setPage(data.totalPages - 1);
    }
  }, [status, data, page]);

  function clearDetailParam() {
    setDetailId(null);
    if (!searchParams.has('entryId')) return;
    const next = new URLSearchParams(searchParams);
    next.delete('entryId');
    setSearchParams(next, { replace: true });
  }

  function handleSearchSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (searchDisabled) return;
    setSearch(searchInput.trim());
    setPage(0);
  }

  function clearFilters() {
    setSearchInput('');
    setSearch('');
    setStatusFilter('');
    setEntryDateFilter('');
    setPage(0);
  }

  function handleStatusChange(value: string) {
    setStatusFilter(value === 'all' ? '' : (value as JournalEntryStatus));
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

  function openDetail(record: JournalEntryRecord) {
    setNotice(null);
    setDetailId(record.id);
    const next = new URLSearchParams(searchParams);
    next.set('entryId', record.id);
    setSearchParams(next, { replace: true });
  }

  function openEdit(record: JournalEntryRecord) {
    clearDetailParam();
    setNotice(null);
    setFormState({ mode: 'edit', record });
  }

  function openAction(record: JournalEntryRecord, action: JournalEntryAction) {
    clearDetailParam();
    setNotice(null);
    setActionState({ record, action });
  }

  function handleSaved(_record: JournalEntryRecord, mode: 'create' | 'edit') {
    setFormState(null);
    setNotice(mode === 'create' ? 'Draft journal entry created.' : 'Draft journal entry updated.');
    if (mode === 'create') setPage(0);
    refresh();
  }

  async function handleAction(record: JournalEntryRecord, action: JournalEntryAction) {
    if (action === 'post') {
      await api.post(record.id);
      setNotice('Journal entry posted.');
    } else {
      await api.void(record.id);
      setNotice('Journal entry voided.');
    }
    setActionState(null);
    refresh();
  }

  const isLoading = status === 'idle' || status === 'loading';
  const isFiltered =
    search.length > 0 || statusFilter !== '' || entryDateFilter !== '';
  const showClear = isFiltered || searchInput.trim().length > 0;

  return (
    <>
      <BreadcrumbComp
        title="Journal Entries"
        items={[{ title: 'Dashboard', to: '/' }, { title: 'Journal Entries' }]}
      />

      {(membershipError || role === null || (role !== null && !canWrite)) && (
        <Alert variant="lightwarning" className="mb-4">
          <AlertTitle>Read-only access</AlertTitle>
          <AlertDescription>
            {membershipError || role === null
              ? 'Your organization membership or role could not be verified. You can view journal entries but cannot modify them.'
              : 'Your role can view journal entries but cannot create, edit, post, or void them.'}
          </AlertDescription>
        </Alert>
      )}

      {notice && (
        <Alert variant="lightsuccess" className="mb-4">
          <AlertTitle>{notice}</AlertTitle>
          <AlertDescription className="mt-2 flex items-center justify-between gap-4">
            <span>The journal entry list has been refreshed.</span>
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
            Sign in with an organization account to view journal entries.
          </AlertDescription>
        </Alert>
      )}

      {organization && (
        <CardBox>
          <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h5 className="text-lg font-semibold">Journal entries</h5>
              <p className="mt-1 text-sm text-muted-foreground">
                Draft, post, and review journal entries for {organization.name}.
              </p>
            </div>
            {canWrite && (
              <Button type="button" onClick={openCreate}>
                <Plus className="size-4" />
                Add entry
              </Button>
            )}
          </div>

          <div className="border-t border-border p-4 dark:border-white/10">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
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
                    placeholder={
                      searchDisabled
                        ? 'Clear status/date filters to search'
                        : 'Search entry # or reference'
                    }
                    aria-label="Search entry number or reference"
                    disabled={searchDisabled}
                    className="pl-9"
                  />
                </div>
                <Button type="submit" variant="outline" disabled={searchDisabled}>
                  Search
                </Button>
                {showClear && (
                  <Button type="button" variant="ghost" onClick={clearFilters}>
                    Clear
                  </Button>
                )}
              </form>

              <div className="flex flex-wrap items-center gap-3">
                <div className="flex items-center gap-2">
                  <Label htmlFor="journal-status" className="text-sm text-muted-foreground">
                    Status
                  </Label>
                  <Select
                    value={statusFilter || 'all'}
                    onValueChange={handleStatusChange}
                    disabled={facetsDisabled}
                  >
                    <SelectTrigger id="journal-status" className="w-[130px]">
                      <SelectValue placeholder="All statuses" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All statuses</SelectItem>
                      {journalEntryStatusOptions.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex items-center gap-2">
                  <Label htmlFor="journal-date" className="text-sm text-muted-foreground">
                    Date
                  </Label>
                  <Input
                    id="journal-date"
                    type="date"
                    value={entryDateFilter}
                    onChange={(event) => {
                      setEntryDateFilter(event.target.value);
                      setPage(0);
                    }}
                    className="w-[160px]"
                    disabled={facetsDisabled}
                  />
                </div>

                <div className="flex items-center gap-2">
                  <Label htmlFor="journal-sort" className="text-sm text-muted-foreground">
                    Sort
                  </Label>
                  <Select value={sort} onValueChange={handleSortChange}>
                    <SelectTrigger id="journal-sort" className="w-[170px]">
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
            </div>

            {(searchDisabled || facetsDisabled) && (
              <p className="mt-3 text-xs text-muted-foreground">
                {searchDisabled
                  ? 'Status and date filters are applied. Clear them to search by entry number or reference.'
                  : 'Search is applied. Clear the search to use status or date filters.'}
              </p>
            )}
          </div>

          {status === 'error' ? (
            <div className="p-4">
              <Alert variant="lighterror">
                <AlertTitle>Unable to load journal entries</AlertTitle>
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
            <JournalTable
              records={data?.content ?? []}
              isLoading={isLoading}
              canWrite={canWrite}
              isFiltered={isFiltered}
              page={page}
              pageSize={pageSize}
              totalPages={data?.totalPages ?? 0}
              totalElements={data?.totalElements ?? 0}
              onPageChange={setPage}
              onPageSizeChange={handlePageSizeChange}
              onClearFilters={clearFilters}
              onView={openDetail}
              onEdit={openEdit}
              onAction={openAction}
            />
          )}
        </CardBox>
      )}

      <JournalEntryFormDialog
        open={formState !== null}
        mode={formState?.mode ?? 'create'}
        record={formState?.record ?? null}
        organizationId={organization?.id ?? ''}
        api={api}
        onOpenChange={(open) => {
          if (!open) setFormState(null);
        }}
        onSaved={handleSaved}
      />

      <JournalDetailDialog
        open={detailId !== null}
        entryId={detailId}
        currency={currency}
        canWrite={canWrite}
        api={api}
        onOpenChange={(open) => {
          if (!open) clearDetailParam();
        }}
        onEdit={openEdit}
        onAction={openAction}
      />

      <ConfirmJournalActionDialog
        open={actionState !== null}
        record={actionState?.record ?? null}
        action={actionState?.action ?? 'post'}
        onOpenChange={(open) => {
          if (!open) setActionState(null);
        }}
        onConfirm={handleAction}
      />
    </>
  );
}
