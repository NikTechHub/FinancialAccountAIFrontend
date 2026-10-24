import { useEffect, useState, type FormEvent } from 'react';
import { Plus, Search } from 'lucide-react';
import CardBox from 'src/components/shared/CardBox';
import BreadcrumbComp from 'src/layouts/full/shared/breadcrumb/BreadcrumbComp';
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
import { AccountFormDialog } from './AccountFormDialog';
import { AccountTable } from './AccountTable';
import { ConfirmAccountDeactivateDialog } from './ConfirmAccountDeactivateDialog';
import { accountApi } from './api';
import { accountTypeOptions } from './display';
import type { AccountRecord, AccountType } from './types';
import { useAccountList } from './useAccountList';

const sortOptions = [
  { value: 'code,asc', label: 'Code A–Z' },
  { value: 'code,desc', label: 'Code Z–A' },
  { value: 'name,asc', label: 'Name A–Z' },
  { value: 'name,desc', label: 'Name Z–A' },
  { value: 'updatedAt,desc', label: 'Recently updated' },
];

type FormState =
  | { mode: 'create'; record: null }
  | { mode: 'edit'; record: AccountRecord }
  | null;

export function AccountManagementPage() {
  const { organization } = useAuth();
  const { role, membershipError } = useRole();

  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [type, setType] = useState<AccountType | ''>('');
  const [sort, setSort] = useState('code,asc');
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(10);
  const [formState, setFormState] = useState<FormState>(null);
  const [deactivating, setDeactivating] = useState<AccountRecord | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const canWrite =
    role === 'OWNER' || role === 'ADMIN' || role === 'ACCOUNTANT';
  const enabled = Boolean(organization?.id);

  const { status, data, error, refresh } = useAccountList({
    api: accountApi,
    enabled,
    params: {
      page,
      size: pageSize,
      search,
      type,
      sort,
    },
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

  function handleTypeChange(value: string) {
    setType(value === 'all' ? '' : (value as AccountType));
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

  function clearFilters() {
    setSearchInput('');
    setSearch('');
    setType('');
    setPage(0);
  }

  function openCreate() {
    setNotice(null);
    setFormState({ mode: 'create', record: null });
  }

  function openEdit(record: AccountRecord) {
    setNotice(null);
    setFormState({ mode: 'edit', record });
  }

  function openDeactivate(record: AccountRecord) {
    setNotice(null);
    setDeactivating(record);
  }

  function handleSaved(_record: AccountRecord, mode: 'create' | 'edit') {
    setFormState(null);
    setNotice(mode === 'create' ? 'Account created.' : 'Account updated.');
    if (mode === 'create') setPage(0);
    refresh();
  }

  async function handleDeactivate(record: AccountRecord) {
    await accountApi.deactivate(record.id);
    setDeactivating(null);
    setNotice('Account deactivated.');

    if ((data?.content.length ?? 0) === 1 && page > 0) {
      setPage(page - 1);
    } else {
      refresh();
    }
  }

  const isLoading = status === 'idle' || status === 'loading';
  const isFiltered = search.length > 0 || type !== '';

  return (
    <>
      <BreadcrumbComp
        title="Chart of Accounts"
        items={[{ title: 'Dashboard', to: '/' }, { title: 'Chart of Accounts' }]}
      />

      {(membershipError || !canWrite) && (
        <Alert variant="lightwarning" className="mb-4">
          <AlertTitle>Read-only access</AlertTitle>
          <AlertDescription>
            {membershipError
              ? 'Your organization membership could not be verified. You can view accounts but cannot create, edit, or deactivate them.'
              : role === null
                ? 'Your role could not be verified. You can view accounts but cannot create, edit, or deactivate them.'
                : 'Your role can view accounts but cannot create, edit, or deactivate them.'}
          </AlertDescription>
        </Alert>
      )}

      {notice && (
        <Alert variant="lightsuccess" className="mb-4">
          <AlertTitle>{notice}</AlertTitle>
          <AlertDescription className="mt-2 flex items-center justify-between gap-4">
            <span>The account list has been refreshed.</span>
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
            Sign in with an organization account to view the chart of accounts.
          </AlertDescription>
        </Alert>
      )}

      {organization && (
        <CardBox>
          <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h5 className="text-lg font-semibold">Chart of accounts</h5>
              <p className="mt-1 text-sm text-muted-foreground">
                Active accounts for {organization.name}. Deactivated accounts
                are not returned by the list API.
              </p>
            </div>
            {canWrite && (
              <Button type="button" onClick={openCreate}>
                <Plus className="size-4" />
                Add account
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
                  placeholder="Search accounts by code or name"
                  aria-label="Search accounts by code or name"
                  className="pl-9"
                />
              </div>
              <Button type="submit" variant="outline">
                Search
              </Button>
              {isFiltered && (
                <Button type="button" variant="ghost" onClick={clearFilters}>
                  Clear
                </Button>
              )}
            </form>

            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2">
                <Label htmlFor="account-type" className="text-sm text-muted-foreground">
                  Type
                </Label>
                <Select value={type || 'all'} onValueChange={handleTypeChange}>
                  <SelectTrigger id="account-type" className="w-[150px]">
                    <SelectValue placeholder="All types" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All types</SelectItem>
                    {accountTypeOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center gap-2">
                <Label htmlFor="account-sort" className="text-sm text-muted-foreground">
                  Sort
                </Label>
                <Select value={sort} onValueChange={handleSortChange}>
                  <SelectTrigger id="account-sort" className="w-[170px]">
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

          {status === 'error' ? (
            <div className="p-4">
              <Alert variant="lighterror">
                <AlertTitle>Unable to load accounts</AlertTitle>
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
            <AccountTable
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
              onEdit={openEdit}
              onDeactivate={openDeactivate}
            />
          )}
        </CardBox>
      )}

      <AccountFormDialog
        open={formState !== null}
        mode={formState?.mode ?? 'create'}
        record={formState?.record ?? null}
        api={accountApi}
        onOpenChange={(open) => {
          if (!open) setFormState(null);
        }}
        onSaved={handleSaved}
      />

      <ConfirmAccountDeactivateDialog
        open={deactivating !== null}
        record={deactivating}
        onOpenChange={(open) => {
          if (!open) setDeactivating(null);
        }}
        onConfirm={handleDeactivate}
      />
    </>
  );
}
