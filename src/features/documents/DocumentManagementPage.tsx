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
import { documentApi } from './api';
import { ConfirmDocumentDeleteDialog } from './ConfirmDocumentDeleteDialog';
import { DocumentDetailDialog } from './DocumentDetailDialog';
import { DocumentTable } from './DocumentTable';
import { DocumentUploadDialog } from './DocumentUploadDialog';
import { getDocumentErrorMessage } from './errors';
import type { DocumentRecord } from './types';
import { useDocumentList } from './useDocumentList';

const sortOptions = [
  { value: 'createdAt,desc', label: 'Newest upload' },
  { value: 'createdAt,asc', label: 'Oldest upload' },
  { value: 'originalFileName,asc', label: 'File name A–Z' },
  { value: 'originalFileName,desc', label: 'File name Z–A' },
];

export function DocumentManagementPage() {
  const { organization } = useAuth();
  const { role, membershipError } = useRole();

  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState('createdAt,desc');
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(10);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [selected, setSelected] = useState<DocumentRecord | null>(null);
  const [deleting, setDeleting] = useState<DocumentRecord | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [downloadError, setDownloadError] = useState<string | null>(null);

  const canWrite = role === 'OWNER' || role === 'ADMIN' || role === 'ACCOUNTANT';
  const enabled = Boolean(organization?.id);
  const currency = organization?.currency ?? 'USD';

  const { status, data, error, refresh } = useDocumentList({
    enabled,
    page,
    size: pageSize,
    filename: search,
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

  function handleUploaded(document: DocumentRecord) {
    setUploadOpen(false);
    setSelected(document);
    setNotice(`Document uploaded: ${document.originalFileName}`);
    setPage(0);
    refresh();
  }

  async function handleDownload(document: DocumentRecord) {
    if (downloadingId) return;
    setDownloadingId(document.id);
    setDownloadError(null);

    try {
      const blob = await documentApi.download(document.id);
      const url = URL.createObjectURL(blob);
      const anchor = window.document.createElement('a');
      anchor.href = url;
      anchor.download = document.originalFileName;
      window.document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 0);
    } catch (downloadFailure) {
      setDownloadError(getDocumentErrorMessage(downloadFailure, 'download'));
    } finally {
      setDownloadingId(null);
    }
  }

  async function handleDelete(document: DocumentRecord) {
    await documentApi.delete(document.id);
    setDeleting(null);
    setNotice(`Document deleted: ${document.originalFileName}`);
    if ((data?.content.length ?? 0) === 1 && page > 0) {
      setPage(page - 1);
    } else {
      refresh();
    }
  }

  function handleDetailOpenChange(open: boolean) {
    if (!open) {
      setSelected(null);
      refresh();
    }
  }

  const isLoading = status === 'idle' || status === 'loading';
  const isFiltered = search.length > 0;

  return (
    <>
      <BreadcrumbComp
        title="Documents"
        items={[{ title: 'Dashboard', to: '/' }, { title: 'Documents' }]}
      />

      {(membershipError || (role !== null && !canWrite)) && (
        <Alert variant="lightwarning" className="mb-4">
          <AlertTitle>Read-only access</AlertTitle>
          <AlertDescription>
            {membershipError
              ? 'Your organization membership could not be verified. You can view and download documents but cannot modify them.'
              : 'Your role can view and download documents, but cannot upload, process, review, or delete them.'}
          </AlertDescription>
        </Alert>
      )}

      {notice && (
        <Alert variant="lightsuccess" className="mb-4">
          <AlertTitle>{notice}</AlertTitle>
          <AlertDescription className="mt-2 flex items-center justify-between gap-4">
            <span>The document list has been refreshed.</span>
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

      {downloadError && (
        <Alert variant="lighterror" className="mb-4">
          <AlertTitle>Unable to download document</AlertTitle>
          <AlertDescription className="mt-2 flex items-center justify-between gap-4">
            <span>{downloadError}</span>
            <Button
              type="button"
              variant="ghosterror"
              size="sm"
              onClick={() => setDownloadError(null)}
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
            Sign in with an organization account to view documents.
          </AlertDescription>
        </Alert>
      )}

      {organization && (
        <CardBox>
          <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h5 className="text-lg font-semibold">Document workspace</h5>
              <p className="mt-1 text-sm text-muted-foreground">
                Upload, process, and review supporting documents for {organization.name}.
              </p>
            </div>
            {canWrite && (
              <Button type="button" onClick={() => setUploadOpen(true)}>
                <Plus className="size-4" />
                Upload document
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
                  placeholder="Search by file name"
                  aria-label="Search documents by file name"
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
              <Label htmlFor="document-sort" className="text-sm text-muted-foreground">
                Sort
              </Label>
              <Select value={sort} onValueChange={handleSortChange}>
                <SelectTrigger id="document-sort" className="w-[170px]">
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
                <AlertTitle>Unable to load documents</AlertTitle>
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
            <DocumentTable
              records={data?.content ?? []}
              isLoading={isLoading}
              canWrite={canWrite}
              isFiltered={isFiltered}
              downloadingId={downloadingId}
              page={page}
              pageSize={pageSize}
              totalPages={data?.totalPages ?? 0}
              totalElements={data?.totalElements ?? 0}
              onPageChange={setPage}
              onPageSizeChange={handlePageSizeChange}
              onClearSearch={clearSearch}
              onOpen={setSelected}
              onDownload={handleDownload}
              onDelete={setDeleting}
            />
          )}
        </CardBox>
      )}

      <DocumentUploadDialog
        open={uploadOpen}
        currency={currency}
        onOpenChange={setUploadOpen}
        onUploaded={handleUploaded}
      />

      <DocumentDetailDialog
        open={selected !== null}
        record={selected}
        currency={currency}
        canWrite={canWrite}
        isDownloading={downloadingId === selected?.id}
        onOpenChange={handleDetailOpenChange}
        onDownload={handleDownload}
      />

      <ConfirmDocumentDeleteDialog
        open={deleting !== null}
        record={deleting}
        onOpenChange={(open) => {
          if (!open) setDeleting(null);
        }}
        onConfirm={handleDelete}
      />
    </>
  );
}
