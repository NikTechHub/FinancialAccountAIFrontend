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
import { ConfirmDeactivateDialog } from './ConfirmDeactivateDialog';
import { PartyFormDialog } from './PartyFormDialog';
import { PartyTable } from './PartyTable';
import type { PartyPageConfig, PartyRecord } from './types';
import { usePartyList } from './usePartyList';

const sortOptions = [
  { value: 'createdAt,desc', label: 'Newest first' },
  { value: 'createdAt,asc', label: 'Oldest first' },
  { value: 'name,asc', label: 'Name A–Z' },
  { value: 'name,desc', label: 'Name Z–A' },
];

type FormState =
  | { mode: 'create'; record: null }
  | { mode: 'edit'; record: PartyRecord }
  | null;

interface PartyManagementPageProps {
  config: PartyPageConfig;
}

export function PartyManagementPage({ config }: PartyManagementPageProps) {
  const { organization } = useAuth();
  const { role, membershipError } = useRole();
  const { labels } = config;

  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState('createdAt,desc');
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(10);
  const [formState, setFormState] = useState<FormState>(null);
  const [deactivating, setDeactivating] = useState<PartyRecord | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const canEdit = role !== null && role !== 'VIEWER';
  const canDeactivate = role === 'OWNER' || role === 'ADMIN';
  const enabled = Boolean(organization?.id);

  const { status, data, error, refresh } = usePartyList({
    api: config.api,
    labels,
    enabled,
    page,
    size: pageSize,
    search,
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

  function openEdit(record: PartyRecord) {
    setNotice(null);
    setFormState({ mode: 'edit', record });
  }

  function openDeactivate(record: PartyRecord) {
    setNotice(null);
    setDeactivating(record);
  }

  function handleSaved(_record: PartyRecord, mode: 'create' | 'edit') {
    setFormState(null);
    setNotice(`${labels.singular} ${mode === 'create' ? 'created' : 'updated'}.`);
    refresh();
  }

  async function handleDeactivate(record: PartyRecord) {
    await config.api.deactivate(record.id);
    setDeactivating(null);
    setNotice(`${labels.singular} deactivated.`);

    if ((data?.content.length ?? 0) === 1 && page > 0) {
      setPage(page - 1);
    } else {
      refresh();
    }
  }

  const isLoading = status === 'idle' || status === 'loading';
  const isFiltered = search.length > 0;

  return (
    <>
      <BreadcrumbComp
        title={labels.plural}
        items={[{ title: 'Dashboard', to: '/' }, { title: labels.plural }]}
      />

      {membershipError && (
        <Alert variant="lightwarning" className="mb-4">
          <AlertTitle>Read-only access</AlertTitle>
          <AlertDescription>{config.readOnlyMessage}</AlertDescription>
        </Alert>
      )}

      {notice && (
        <Alert variant="lightsuccess" className="mb-4">
          <AlertTitle>{notice}</AlertTitle>
          <AlertDescription className="mt-2 flex items-center justify-between gap-4">
            <span>The {labels.lowerSingular} list has been updated.</span>
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
            Sign in with an organization account to manage {labels.lowerPlural}.
          </AlertDescription>
        </Alert>
      )}

      {organization && (
        <CardBox>
          <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h5 className="text-lg font-semibold">{labels.singular} directory</h5>
              <p className="mt-1 text-sm text-muted-foreground">
                View and manage {labels.lowerPlural} in {organization.name}.
              </p>
            </div>
            {canEdit && (
              <Button type="button" onClick={openCreate}>
                <Plus className="size-4" />
                Add {labels.lowerSingular}
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
                  placeholder={config.searchPlaceholder}
                  aria-label={config.searchPlaceholder}
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
              <Label htmlFor="party-sort" className="text-sm text-muted-foreground">
                Sort
              </Label>
              <Select value={sort} onValueChange={handleSortChange}>
                <SelectTrigger id="party-sort" className="w-[160px]">
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
                <AlertTitle>Unable to load {labels.lowerPlural}</AlertTitle>
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
            <PartyTable
              records={data?.content ?? []}
              labels={labels}
              isLoading={isLoading}
              canEdit={canEdit}
              canDeactivate={canDeactivate}
              isFiltered={isFiltered}
              emptyDescription={config.emptyDescription}
              page={page}
              pageSize={pageSize}
              totalPages={data?.totalPages ?? 0}
              totalElements={data?.totalElements ?? 0}
              onPageChange={setPage}
              onPageSizeChange={handlePageSizeChange}
              onClearSearch={clearSearch}
              onEdit={openEdit}
              onDeactivate={openDeactivate}
            />
          )}
        </CardBox>
      )}

      <PartyFormDialog
        open={formState !== null}
        mode={formState?.mode ?? 'create'}
        record={formState?.record ?? null}
        api={config.api}
        labels={labels}
        onOpenChange={(open) => {
          if (!open) setFormState(null);
        }}
        onSaved={handleSaved}
      />

      <ConfirmDeactivateDialog
        open={deactivating !== null}
        record={deactivating}
        labels={labels}
        onOpenChange={(open) => {
          if (!open) setDeactivating(null);
        }}
        onConfirm={handleDeactivate}
      />
    </>
  );
}
