// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthContext, type AuthContextValue } from 'src/features/auth/auth-context';
import type { MembershipResponse } from 'src/lib/api/types';
import { clearSession } from 'src/lib/api/session';
import { createFetchMock, jsonResponse, testOrganization, testUser } from 'src/test/api-fixtures';
import { OrganizationSettingsPage } from './OrganizationSettingsPage';

const orgId = testOrganization.id;
const existing = { id: '33333333-3333-4333-8333-333333333333', userId: testUser.id, userEmail: testUser.email,
  userFirstName: testUser.firstName, userLastName: testUser.lastName, organizationId: orgId,
  organizationName: testOrganization.name, role: 'OWNER' as const, createdAt: '2026-01-01T00:00:00Z' };
const newMember = { id: '44444444-4444-4444-8444-444444444444', userId: '55555555-5555-4555-8555-555555555555',
  userEmail: 'new@example.com', userFirstName: 'Grace', userLastName: 'Hopper', organizationId: orgId,
  organizationName: testOrganization.name, role: 'VIEWER' as const, createdAt: '2026-02-01T00:00:00Z' };

function authValue(role: AuthContextValue['role'], membershipError: string | null = null): AuthContextValue {
  return { status: 'authenticated', user: testUser, organization: testOrganization, role,
    membershipError, login: vi.fn(), register: vi.fn(), logout: vi.fn() };
}

function renderPage(role: AuthContextValue['role'] = 'OWNER', membershipError: string | null = null) {
  return render(<MemoryRouter><AuthContext.Provider value={authValue(role, membershipError)}><OrganizationSettingsPage /></AuthContext.Provider></MemoryRouter>);
}

function routes({ addStatus = 201 }: { addStatus?: number } = {}) {
  let members: MembershipResponse[] = [existing];
  let addBody: unknown;
  let memberGets = 0;
  const fetchMock = createFetchMock([
    { path: `/api/v1/organizations/${orgId}`, handler: () => jsonResponse(testOrganization) },
    { path: `/api/v1/organizations/${orgId}/members`, handler: () => { memberGets++; return jsonResponse(members); } },
    { method: 'POST', path: `/api/v1/organizations/${orgId}/members`, handler: ({ body }) => {
      addBody = body;
      if (addStatus !== 201) return jsonResponse({ message: 'request rejected' }, addStatus);
      members = [...members, newMember];
      return jsonResponse(newMember, 201);
    } },
  ]);
  vi.stubGlobal('fetch', fetchMock);
  return { fetchMock, get addBody() { return addBody; }, get memberGets() { return memberGets; } };
}

beforeEach(() => clearSession());
afterEach(() => { cleanup(); clearSession(); vi.unstubAllGlobals(); });

describe('Organization settings and members', () => {
  it('loads actual organization details and membership fields', async () => {
    const { fetchMock } = routes();
    renderPage();
    expect(await screen.findByText(testOrganization.name)).toBeTruthy();
    expect(screen.getByText('USD')).toBeTruthy();
    expect(screen.getByText(testOrganization.timezone)).toBeTruthy();
    expect(screen.getByText(testUser.email)).toBeTruthy();
    expect(within(screen.getByRole('table')).getByText('OWNER')).toBeTruthy();
    expect(screen.getByText(/does not return an account active\/inactive status/)).toBeTruthy();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('keeps member controls read-only for a verified non-admin role', async () => {
    routes(); renderPage('VIEWER');
    await screen.findByText(testOrganization.name);
    expect(screen.queryByRole('button', { name: 'Review member addition' })).toBeNull();
    expect(screen.getByText(/Only verified OWNER or ADMIN members can add members/)).toBeTruthy();
  });

  it('keeps member controls read-only when the current role is unknown', async () => {
    routes(); renderPage(null, 'Membership could not be verified');
    await screen.findByText(testOrganization.name);
    expect(screen.getByText(/Role could not be verified/)).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Review member addition' })).toBeNull();
  });

  it('confirms a supported member addition and refreshes the list', async () => {
    const api = routes(); renderPage('ADMIN');
    await screen.findByText(testOrganization.name);
    fireEvent.change(screen.getByLabelText('Existing user ID'), { target: { value: newMember.userId } });
    fireEvent.change(screen.getByLabelText('Role to assign'), { target: { value: 'VIEWER' } });
    fireEvent.click(screen.getByRole('button', { name: 'Review member addition' }));
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Confirm and add' }));

    expect(await screen.findByText('new@example.com')).toBeTruthy();
    expect(api.addBody).toEqual({ userId: newMember.userId, role: 'VIEWER' });
    expect(api.memberGets).toBe(2);
  });

  it('shows the backend duplicate-member conflict without pretending the add succeeded', async () => {
    const api = routes({ addStatus: 409 }); renderPage('OWNER');
    await screen.findByText(testOrganization.name);
    fireEvent.change(screen.getByLabelText('Existing user ID'), { target: { value: newMember.userId } });
    fireEvent.click(screen.getByRole('button', { name: 'Review member addition' }));
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Confirm and add' }));

    expect(await screen.findByText('This user is already a member of the organization.')).toBeTruthy();
    expect(screen.queryByText('new@example.com')).toBeNull();
    expect(api.memberGets).toBe(1);
  });
});
