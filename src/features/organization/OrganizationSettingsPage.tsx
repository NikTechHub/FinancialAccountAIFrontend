import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { ApiError } from 'src/lib/api/client';
import type { MembershipResponse, MembershipRole, OrganizationResponse } from 'src/lib/api/types';
import { Alert, AlertDescription, AlertTitle } from 'src/components/ui/alert';
import { Button } from 'src/components/ui/button';
import CardBox from 'src/components/shared/CardBox';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from 'src/components/ui/dialog';
import { Input } from 'src/components/ui/input';
import { Label } from 'src/components/ui/label';
import BreadcrumbComp from 'src/layouts/full/shared/breadcrumb/BreadcrumbComp';
import { useAuth } from 'src/features/auth/useAuth';
import { useRole } from 'src/features/auth/useRole';
import { organizationApi } from './api';

type LoadState = 'loading' | 'success' | 'error';
const roles: MembershipRole[] = ['OWNER', 'ADMIN', 'ACCOUNTANT', 'EMPLOYEE', 'VIEWER'];
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function loadError(error: unknown): string {
  if (error instanceof ApiError && error.status === 401) return 'Your session has expired. Sign in again to continue.';
  if (error instanceof ApiError && error.status === 403) return 'You do not have permission to view this organization.';
  if (error instanceof ApiError && error.kind === 'network') return 'Unable to reach the server. Check your connection and retry.';
  return 'Organization settings could not be loaded. Please retry.';
}

function mutationError(error: unknown): string {
  if (error instanceof ApiError && error.status === 401) return 'Your session has expired. Sign in again to continue.';
  if (error instanceof ApiError && error.status === 403) return 'Only an OWNER or ADMIN can add members.';
  if (error instanceof ApiError && error.status === 409) return 'This user is already a member of the organization.';
  if (error instanceof ApiError && error.status === 404) return 'No user was found with that user ID.';
  if (error instanceof ApiError && error.kind === 'network') return 'Unable to reach the server. Check your connection and retry.';
  if (error instanceof ApiError && error.status === 400) return 'The user ID or role was not accepted. Check the values and retry.';
  return 'The member could not be added. Please retry.';
}

function Field({ label, value }: { label: string; value: string }) {
  return <div className="min-w-0"><dt className="text-xs text-muted-foreground">{label}</dt><dd className="break-words text-sm font-medium">{value || '—'}</dd></div>;
}

export function OrganizationSettingsPage() {
  const { organization: sessionOrganization } = useAuth();
  const { role, membershipError } = useRole();
  const organizationId = sessionOrganization?.id;
  const canAddMembers = role === 'OWNER' || role === 'ADMIN';
  const [organization, setOrganization] = useState<OrganizationResponse | null>(null);
  const [members, setMembers] = useState<MembershipResponse[]>([]);
  const [loadState, setLoadState] = useState<LoadState>(organizationId ? 'loading' : 'success');
  const [loadMessage, setLoadMessage] = useState<string | null>(null);
  const [reload, setReload] = useState(0);
  const [userId, setUserId] = useState('');
  const [memberRole, setMemberRole] = useState<MembershipRole>('VIEWER');
  const [formError, setFormError] = useState<string | null>(null);
  const [mutationErrorText, setMutationErrorText] = useState<string | null>(null);
  const [mutationBusy, setMutationBusy] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async (signal: AbortSignal) => {
    if (!organizationId) {
      setLoadState('success');
      return;
    }
    setLoadState('loading');
    setLoadMessage(null);
    try {
      const [nextOrganization, nextMembers] = await Promise.all([
        organizationApi.get(organizationId, signal), organizationApi.members(organizationId, signal),
      ]);
      if (signal.aborted) return;
      if (!Array.isArray(nextMembers)) throw new ApiError('Invalid member response', { kind: 'parse' });
      setOrganization(nextOrganization);
      setMembers(nextMembers);
      setLoadState('success');
    } catch (error) {
      if (signal.aborted) return;
      setLoadMessage(loadError(error));
      setLoadState('error');
    }
  }, [organizationId]);

  useEffect(() => {
    const controller = new AbortController();
    void load(controller.signal);
    return () => controller.abort();
  }, [load, reload]);

  function reviewAdd(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);
    setMutationErrorText(null);
    if (!canAddMembers) return;
    const trimmedId = userId.trim();
    if (!uuidPattern.test(trimmedId)) {
      setFormError('Enter a valid user ID (UUID).');
      return;
    }
    setUserId(trimmedId);
    setConfirmOpen(true);
  }

  async function confirmAdd() {
    if (!organizationId || !canAddMembers || mutationBusy || !uuidPattern.test(userId)) return;
    setMutationBusy(true);
    setMutationErrorText(null);
    try {
      await organizationApi.addMember(organizationId, { userId, role: memberRole });
      setConfirmOpen(false);
      setUserId('');
      setNotice('Member added. The member list has been refreshed.');
      setReload((current) => current + 1);
    } catch (error) {
      setMutationErrorText(mutationError(error));
      setConfirmOpen(false);
    } finally {
      setMutationBusy(false);
    }
  }

  return <>
    <BreadcrumbComp title="Organization Settings" items={[{ title: 'Dashboard', to: '/' }, { title: 'Organization Settings' }]} />
    {!organizationId ? <Alert variant="lighterror"><AlertTitle>No organization available</AlertTitle><AlertDescription>Sign in with an organization account to view settings.</AlertDescription></Alert> : <div className="space-y-6">
      {membershipError && <Alert variant="lightwarning"><AlertTitle>Role could not be verified</AlertTitle><AlertDescription>Your organization data is read-only until membership permissions can be verified.</AlertDescription></Alert>}
      {loadState === 'loading' && <p role="status" className="text-sm text-muted-foreground">Loading organization settings and members...</p>}
      {loadState === 'error' && <Alert variant="lighterror"><AlertTitle>Unable to load organization</AlertTitle><AlertDescription className="flex flex-wrap items-center justify-between gap-3"><span>{loadMessage}</span><Button variant="outlineerror" onClick={() => setReload((value) => value + 1)}>Retry</Button></AlertDescription></Alert>}
      {notice && <Alert variant="lightprimary"><AlertDescription>{notice}</AlertDescription></Alert>}
      {mutationErrorText && <Alert variant="lighterror"><AlertTitle>Member could not be added</AlertTitle><AlertDescription>{mutationErrorText}</AlertDescription></Alert>}
      {loadState === 'success' && organization && <>
        <CardBox className="space-y-5 p-5">
          <div><h2 className="text-lg font-semibold">Organization details</h2><p className="text-sm text-muted-foreground">Read-only details for your current organization.</p></div>
          <dl className="grid min-w-0 grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Field label="Organization name" value={organization.name} />
            <Field label="Legal name" value={organization.legalName} />
            <Field label="Business type" value={organization.businessType} />
            <Field label="Country" value={organization.country} />
            <Field label="Currency" value={organization.currency} />
            <Field label="Time zone" value={organization.timezone} />
          </dl>
          <p className="text-xs text-muted-foreground">Organization details are immutable through the available API. Currency is shown as returned by the server.</p>
        </CardBox>

        <CardBox className="space-y-5 p-5">
          <div><h2 className="text-lg font-semibold">Organization members</h2><p className="text-sm text-muted-foreground">Names, email addresses, roles, and membership creation dates returned by the membership API.</p></div>
          {members.length === 0 ? <p className="py-5 text-sm text-muted-foreground">No members were returned for this organization.</p> : <div className="overflow-x-auto"><table className="w-full min-w-[640px] text-left text-sm">
            <thead><tr className="border-b border-border text-xs text-muted-foreground dark:border-white/10"><th className="px-3 py-3 font-medium">Member</th><th className="px-3 py-3 font-medium">Email</th><th className="px-3 py-3 font-medium">Role</th><th className="px-3 py-3 font-medium">Member since</th></tr></thead>
            <tbody>{members.map((member) => <tr key={member.id} className="border-b border-border last:border-0 dark:border-white/10"><td className="px-3 py-3">{[member.userFirstName, member.userLastName].filter(Boolean).join(' ') || 'Name unavailable'}</td><td className="break-all px-3 py-3">{member.userEmail}</td><td className="px-3 py-3">{member.role}</td><td className="px-3 py-3">{new Date(member.createdAt).toLocaleDateString()}</td></tr>)}</tbody>
          </table></div>}
          <p className="text-xs text-muted-foreground">The API does not return an account active/inactive status or support member removal or role changes.</p>
          {canAddMembers ? <form onSubmit={reviewAdd} className="grid grid-cols-1 items-end gap-3 border-t border-border pt-5 dark:border-white/10 sm:grid-cols-[minmax(0,1fr)_200px_auto]">
            <div className="space-y-2"><Label htmlFor="member-user-id">Existing user ID</Label><Input id="member-user-id" value={userId} onChange={(event) => setUserId(event.target.value)} placeholder="User UUID" autoComplete="off" disabled={mutationBusy} /><p className="text-xs text-muted-foreground">The backend accepts an existing user’s UUID; it does not provide email search or invitations.</p></div>
            <div className="space-y-2"><Label htmlFor="member-role">Role to assign</Label><select id="member-role" className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={memberRole} disabled={mutationBusy} onChange={(event) => setMemberRole(event.target.value as MembershipRole)}>{roles.map((item) => <option key={item} value={item}>{item}</option>)}</select></div>
            <Button type="submit" disabled={mutationBusy}>Review member addition</Button>
            {formError && <p className="text-sm text-destructive sm:col-span-3">{formError}</p>}
          </form> : <p className="border-t border-border pt-4 text-sm text-muted-foreground dark:border-white/10">Only verified OWNER or ADMIN members can add members. Role changes and member removal are not available.</p>}
        </CardBox>
      </>}
    </div>}
    <Dialog open={confirmOpen} onOpenChange={(open) => { if (!mutationBusy) setConfirmOpen(open); }}>
      <DialogContent><DialogHeader><DialogTitle>Confirm member addition</DialogTitle></DialogHeader>
        <p className="text-sm">Add user <span className="font-medium">{userId}</span> to {organization?.name ?? 'this organization'} with the <span className="font-medium">{memberRole}</span> role?</p>
        <DialogFooter><Button type="button" variant="outline" disabled={mutationBusy} onClick={() => setConfirmOpen(false)}>Cancel</Button><Button type="button" disabled={mutationBusy} onClick={() => void confirmAdd()}>{mutationBusy ? 'Adding...' : 'Confirm and add'}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  </>;
}
