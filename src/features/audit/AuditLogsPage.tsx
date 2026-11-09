import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { ApiError } from 'src/lib/api/client';
import type { PageResponse } from 'src/lib/api/types';
import { Alert, AlertDescription, AlertTitle } from 'src/components/ui/alert';
import { Button } from 'src/components/ui/button';
import CardBox from 'src/components/shared/CardBox';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from 'src/components/ui/dialog';
import { Input } from 'src/components/ui/input';
import { Label } from 'src/components/ui/label';
import BreadcrumbComp from 'src/layouts/full/shared/breadcrumb/BreadcrumbComp';
import { useRole } from 'src/features/auth/useRole';
import { auditActions, auditApi, auditResourceTypes, type AuditLogRecord, type AuditQuery } from './api';

const pageSize = 20;
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const canReadAuditRoles = ['OWNER', 'ADMIN', 'ACCOUNTANT'] as const;
type Filters = Omit<AuditQuery, 'page' | 'size'>;

const emptyFilters: Filters = { action: '', resourceType: '', resourceId: '', actorUserId: '', success: '', fromDate: '', toDate: '' };

function requestError(error: unknown): string {
  if (error instanceof ApiError && error.status === 401) return 'Your session has expired. Sign in again to view audit logs.';
  if (error instanceof ApiError && error.status === 403) return 'Your role does not have permission to view audit logs.';
  if (error instanceof ApiError && error.kind === 'network') return 'Unable to reach the server. Check your connection and retry.';
  if (error instanceof ApiError && error.kind === 'parse') return 'The server returned an unexpected audit-log response. Please retry.';
  return 'Audit logs could not be loaded. Please retry.';
}

function validateFilters(filters: Filters): string | null {
  if (Boolean(filters.fromDate) !== Boolean(filters.toDate)) return 'Choose both a start date and an end date, or leave both blank.';
  if (filters.fromDate && filters.toDate && filters.fromDate > filters.toDate) return 'The start date must be on or before the end date.';
  for (const [label, value] of [['Resource ID', filters.resourceId], ['Actor user ID', filters.actorUserId]] as const) {
    if (value && !uuidPattern.test(value)) return `Enter a valid UUID for ${label.toLowerCase()}.`;
  }
  return null;
}

function safeResponsePage(value: unknown): value is PageResponse<AuditLogRecord> {
  if (!value || typeof value !== 'object') return false;
  const page = value as Partial<PageResponse<AuditLogRecord>>;
  return Array.isArray(page.content) && Number.isInteger(page.number) && Number.isInteger(page.size) &&
    Number.isInteger(page.totalPages) && Number.isInteger(page.totalElements) &&
    typeof page.first === 'boolean' && typeof page.last === 'boolean';
}

function formatTimestamp(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'Timestamp unavailable' : date.toLocaleString();
}

function formatEnum(value: string): string {
  return value.replace(/_/g, ' ');
}

export function AuditLogsPage() {
  const { role, membershipError, hasRole } = useRole();
  const authorized = hasRole(...canReadAuditRoles);
  const [draft, setDraft] = useState<Filters>(emptyFilters);
  const [filters, setFilters] = useState<Filters>(emptyFilters);
  const [pageNumber, setPageNumber] = useState(0);
  const [data, setData] = useState<PageResponse<AuditLogRecord> | null>(null);
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [filterError, setFilterError] = useState<string | null>(null);
  const [reload, setReload] = useState(0);
  const [selected, setSelected] = useState<AuditLogRecord | null>(null);

  const load = useCallback(async (signal: AbortSignal) => {
    if (!authorized) {
      setData(null);
      setStatus('idle');
      return;
    }
    setStatus('loading');
    setErrorMessage(null);
    try {
      const response = await auditApi.list({ ...filters, page: pageNumber, size: pageSize }, signal);
      if (signal.aborted) return;
      if (!safeResponsePage(response) || !response.content.every((row) => row && typeof row.id === 'string' && typeof row.action === 'string' && typeof row.resourceType === 'string' && typeof row.createdAt === 'string')) {
        throw new ApiError('Invalid audit page', { kind: 'parse' });
      }
      setData(response);
      setStatus('success');
    } catch (error) {
      if (signal.aborted) return;
      setData(null);
      setErrorMessage(requestError(error));
      setStatus('error');
    }
  }, [authorized, filters, pageNumber]);

  useEffect(() => {
    const controller = new AbortController();
    void load(controller.signal);
    return () => controller.abort();
  }, [load, reload]);

  function applyFilters(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalized = Object.fromEntries(Object.entries(draft).map(([key, value]) => [key, value.trim()])) as Filters;
    const validation = validateFilters(normalized);
    setFilterError(validation);
    if (validation) return;
    setFilters(normalized);
    setPageNumber(0);
  }

  const updateDraft = (field: keyof Filters, value: string) => setDraft((current) => ({ ...current, [field]: value }));

  return <>
    <BreadcrumbComp title="Audit Logs" items={[{ title: 'Dashboard', to: '/' }, { title: 'Audit Logs' }]} />
    {membershipError && <Alert variant="lightwarning" className="mb-4"><AlertTitle>Membership role unavailable</AlertTitle><AlertDescription>Audit access requires a verified OWNER, ADMIN, or ACCOUNTANT role. Contact an organization administrator if you believe this is incorrect.</AlertDescription></Alert>}
    {role !== null && !authorized && <Alert variant="lightwarning" className="mb-4"><AlertTitle>Audit access restricted</AlertTitle><AlertDescription>Audit history is available to OWNER, ADMIN, and ACCOUNTANT members only.</AlertDescription></Alert>}
    {authorized && <CardBox className="min-w-0 space-y-5 p-5">
      <div><h2 className="text-lg font-semibold">Audit Logs</h2><p className="text-sm text-muted-foreground">Read-only activity history across organizations where your role permits audit access.</p></div>
      <p className="text-xs text-muted-foreground">With no date filter, the backend returns its default window: the last 90 days. Explicit date filters include whole UTC days. Results use fixed newest-first ordering.</p>
      <form onSubmit={applyFilters} className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
        <div className="space-y-2"><Label htmlFor="audit-action">Action</Label><select id="audit-action" className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={draft.action} onChange={(event) => updateDraft('action', event.target.value)}><option value="">All actions</option>{auditActions.map((action) => <option key={action} value={action}>{formatEnum(action)}</option>)}</select></div>
        <div className="space-y-2"><Label htmlFor="audit-resource">Resource type</Label><select id="audit-resource" className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={draft.resourceType} onChange={(event) => updateDraft('resourceType', event.target.value)}><option value="">All resource types</option>{auditResourceTypes.map((type) => <option key={type} value={type}>{formatEnum(type)}</option>)}</select></div>
        <div className="space-y-2"><Label htmlFor="audit-success">Result</Label><select id="audit-success" className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={draft.success} onChange={(event) => updateDraft('success', event.target.value)}><option value="">All results</option><option value="true">Succeeded</option><option value="false">Failed</option></select></div>
        <div className="space-y-2"><Label htmlFor="audit-resource-id">Resource ID</Label><Input id="audit-resource-id" value={draft.resourceId} onChange={(event) => updateDraft('resourceId', event.target.value)} placeholder="Optional UUID" /></div>
        <div className="space-y-2"><Label htmlFor="audit-actor-id">Actor user ID</Label><Input id="audit-actor-id" value={draft.actorUserId} onChange={(event) => updateDraft('actorUserId', event.target.value)} placeholder="Optional UUID" /></div>
        <div className="space-y-2"><Label htmlFor="audit-from-date">From date</Label><Input id="audit-from-date" type="date" value={draft.fromDate} onChange={(event) => updateDraft('fromDate', event.target.value)} /></div>
        <div className="space-y-2"><Label htmlFor="audit-to-date">To date</Label><Input id="audit-to-date" type="date" value={draft.toDate} onChange={(event) => updateDraft('toDate', event.target.value)} /></div>
        <div className="flex items-end"><Button type="submit" disabled={status === 'loading'}>Apply filters</Button></div>
        {filterError && <p className="text-sm text-destructive md:col-span-2 xl:col-span-4">{filterError}</p>}
      </form>
      {status === 'loading' && <p role="status" className="text-sm text-muted-foreground">Loading audit logs...</p>}
      {status === 'error' && <Alert variant="lighterror"><AlertTitle>Unable to load audit logs</AlertTitle><AlertDescription className="flex flex-wrap items-center justify-between gap-3"><span>{errorMessage}</span><Button variant="outlineerror" onClick={() => setReload((value) => value + 1)}>Retry</Button></AlertDescription></Alert>}
      {status === 'success' && data && data.content.length === 0 && <p className="py-8 text-center text-sm text-muted-foreground">No audit events match these filters.</p>}
      {status === 'success' && data && data.content.length > 0 && <>
        <div className="overflow-x-auto"><table aria-label="Audit events" className="w-full min-w-[850px] text-left text-sm">
          <thead><tr className="border-b border-border text-xs text-muted-foreground dark:border-white/10"><th className="px-3 py-3 font-medium">Timestamp</th><th className="px-3 py-3 font-medium">Action</th><th className="px-3 py-3 font-medium">Actor</th><th className="px-3 py-3 font-medium">Resource</th><th className="px-3 py-3 font-medium">Result</th><th className="px-3 py-3 font-medium">Description</th><th className="px-3 py-3 font-medium">Details</th></tr></thead>
          <tbody>{data.content.map((record) => <tr key={record.id} className="border-b border-border align-top last:border-0 dark:border-white/10">
            <td className="whitespace-nowrap px-3 py-3">{formatTimestamp(record.createdAt)}</td><td className="px-3 py-3">{formatEnum(record.action)}</td>
            <td className="px-3 py-3">{record.actorName || 'System / unavailable'}</td><td className="px-3 py-3">{formatEnum(record.resourceType)}</td>
            <td className="px-3 py-3">{record.success === true ? 'Succeeded' : record.success === false ? 'Failed' : 'Unknown'}</td>
            <td className="max-w-xs whitespace-pre-wrap break-words px-3 py-3">{record.description || '—'}</td>
            <td className="px-3 py-3"><Button type="button" size="sm" variant="outline" onClick={() => setSelected(record)}>View</Button></td>
          </tr>)}</tbody>
        </table></div>
        <div className="flex flex-wrap items-center justify-between gap-3 text-sm"><span>Page {data.number + 1} of {Math.max(data.totalPages, 1)} · {data.totalElements} event{data.totalElements === 1 ? '' : 's'}</span><div className="flex gap-2"><Button variant="outline" disabled={data.first} onClick={() => setPageNumber((value) => Math.max(0, value - 1))}>Previous</Button><Button variant="outline" disabled={data.last} onClick={() => setPageNumber((value) => value + 1)}>Next</Button></div></div>
      </>}
    </CardBox>}
    <Dialog open={selected !== null} onOpenChange={(open) => { if (!open) setSelected(null); }}>
      <DialogContent className="max-w-xl"><DialogHeader><DialogTitle>Audit event details</DialogTitle></DialogHeader>
        {selected && <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Detail label="Timestamp" value={formatTimestamp(selected.createdAt)} /><Detail label="Action" value={formatEnum(selected.action)} />
          <Detail label="Actor" value={selected.actorName || 'System / unavailable'} /><Detail label="Resource type" value={formatEnum(selected.resourceType)} />
          <Detail label="Outcome" value={selected.success === true ? 'Succeeded' : selected.success === false ? 'Failed' : 'Unknown'} />
          {selected.description && <div className="sm:col-span-2"><Detail label="Description" value={selected.description} /></div>}
          <p className="text-xs text-muted-foreground sm:col-span-2">Sensitive before/after snapshots, raw metadata, network addresses, and user-agent details are intentionally not displayed.</p>
        </dl>}
      </DialogContent>
    </Dialog>
  </>;
}

function Detail({ label, value }: { label: string; value: string }) {
  return <div className="min-w-0"><dt className="text-xs text-muted-foreground">{label}</dt><dd className="break-words whitespace-pre-wrap text-sm">{value}</dd></div>;
}
