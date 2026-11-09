// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthContext, type AuthContextValue } from 'src/features/auth/auth-context';
import { clearSession } from 'src/lib/api/session';
import { createFetchMock, jsonResponse, testOrganization, testUser } from 'src/test/api-fixtures';
import { AuditLogsPage } from './AuditLogsPage';

const auditRecord = {
  id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', organizationId: testOrganization.id,
  action: 'JOURNAL_ENTRY_POSTED', resourceType: 'JOURNAL_ENTRY', resourceId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
  actorUserId: testUser.id, actorName: 'Ada Lovelace', description: 'Journal entry posted',
  beforeData: { password: 'do-not-render' }, afterData: { token: 'never-display' },
  metadata: { apiKey: 'secret-metadata' }, ipAddress: '192.0.2.1', userAgent: 'private-agent',
  success: true, createdAt: '2026-05-10T10:30:00Z',
};

function page(content = [auditRecord], number = 0, totalPages = 1) {
  return { content, pageable: { pageNumber: number, pageSize: 20, sort: { sorted: true } },
    totalElements: totalPages * 20, totalPages, number, size: 20, numberOfElements: content.length,
    first: number === 0, last: number >= totalPages - 1, empty: content.length === 0, sort: { sorted: true } };
}

function renderPage(role: AuthContextValue['role'] = 'ACCOUNTANT', membershipError: string | null = null) {
  const auth: AuthContextValue = { status: 'authenticated', user: testUser, organization: testOrganization, role,
    membershipError, login: vi.fn(), register: vi.fn(), logout: vi.fn() };
  return render(<MemoryRouter><AuthContext.Provider value={auth}><AuditLogsPage /></AuthContext.Provider></MemoryRouter>);
}

function setFetch(handler: (url: URL) => Response | Promise<Response>) {
  const fetchMock = createFetchMock([{ path: '/api/v1/audit-logs', handler: ({ url }) => handler(new URL(url, 'http://localhost')) }]);
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

beforeEach(() => clearSession());
afterEach(() => { cleanup(); clearSession(); vi.unstubAllGlobals(); });

describe('Audit Logs', () => {
  it('maps backend events and filters with fixed pagination parameters', async () => {
    const requests: URL[] = [];
    setFetch((url) => { requests.push(url); const number = Number(url.searchParams.get('page') ?? 0); return jsonResponse(page([auditRecord], number, 2)); });
    renderPage();
    expect(await screen.findByText('Journal entry posted')).toBeTruthy();
    expect(screen.getByText('Ada Lovelace')).toBeTruthy();
    expect(within(screen.getByRole('table', { name: 'Audit events' })).getByText('Succeeded')).toBeTruthy();
    expect(requests[0].searchParams.get('page')).toBe('0');
    expect(requests[0].searchParams.get('size')).toBe('20');
    expect(requests[0].searchParams.get('sort')).toBeNull();

    fireEvent.change(screen.getByLabelText('Action'), { target: { value: 'JOURNAL_ENTRY_POSTED' } });
    fireEvent.change(screen.getByLabelText('Result'), { target: { value: 'true' } });
    fireEvent.change(screen.getByLabelText('From date'), { target: { value: '2026-05-01' } });
    fireEvent.change(screen.getByLabelText('To date'), { target: { value: '2026-05-31' } });
    fireEvent.click(screen.getByRole('button', { name: 'Apply filters' }));
    await waitFor(() => expect(requests).toHaveLength(2));
    expect(requests[1].searchParams.get('action')).toBe('JOURNAL_ENTRY_POSTED');
    expect(requests[1].searchParams.get('success')).toBe('true');
    expect(requests[1].searchParams.get('fromDate')).toBe('2026-05-01');
    expect(requests[1].searchParams.get('toDate')).toBe('2026-05-31');

    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    await waitFor(() => expect(requests).toHaveLength(3));
    expect(requests[2].searchParams.get('page')).toBe('1');
    expect(requests[2].searchParams.get('action')).toBe('JOURNAL_ENTRY_POSTED');
  });

  it('validates date range and UUID filters before requesting', async () => {
    const fetchMock = setFetch(() => jsonResponse(page())); renderPage();
    await screen.findByText('Ada Lovelace');
    fireEvent.change(screen.getByLabelText('From date'), { target: { value: '2026-06-01' } });
    fireEvent.change(screen.getByLabelText('To date'), { target: { value: '2026-05-01' } });
    fireEvent.change(screen.getByLabelText('Resource ID'), { target: { value: 'invalid' } });
    fireEvent.click(screen.getByRole('button', { name: 'Apply filters' }));
    expect(screen.getByText('The start date must be on or before the end date.')).toBeTruthy();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('shows safe event details and never renders snapshots or internal metadata', async () => {
    setFetch(() => jsonResponse(page())); renderPage();
    await screen.findByText('Ada Lovelace');
    fireEvent.click(screen.getByRole('button', { name: 'View' }));
    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByText('Journal entry posted')).toBeTruthy();
    expect(within(dialog).getByText('JOURNAL ENTRY')).toBeTruthy();
    expect(within(dialog).getByText(/Sensitive before\/after snapshots/)).toBeTruthy();
    expect(within(dialog).queryByText(/do-not-render|never-display|secret-metadata|192\.0\.2\.1|private-agent/)).toBeNull();
    expect(document.querySelector('script')).toBeNull();
  });

  it('does not request or expose audit logs for non-auditor roles', () => {
    const fetchMock = setFetch(() => jsonResponse(page()));
    for (const role of ['VIEWER', 'EMPLOYEE'] as const) {
      renderPage(role);
      expect(screen.getByText(/Audit history is available to OWNER, ADMIN, and ACCOUNTANT/)).toBeTruthy();
      expect(screen.queryByRole('table', { name: 'Audit events' })).toBeNull();
      cleanup();
    }
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('handles both 401 and 403 with non-sensitive retryable errors', async () => {
    let responseStatus = 401;
    const fetchMock = setFetch(() => jsonResponse({ message: 'sensitive backend detail' }, responseStatus));
    for (const status of [401, 403]) {
      responseStatus = status;
      renderPage();
      expect(await screen.findByText(status === 401 ? 'Your session has expired. Sign in again to view audit logs.' : 'Your role does not have permission to view audit logs.')).toBeTruthy();
      expect(screen.getByRole('button', { name: 'Retry' })).toBeTruthy();
      expect(screen.queryByText('sensitive backend detail')).toBeNull();
      expect(screen.queryByRole('table')).toBeNull();
      cleanup();
    }
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('retries a failed request with the applied filters intact', async () => {
    let shouldFail = true;
    const requests: URL[] = [];
    const fetchMock = setFetch((url) => {
      requests.push(url);
      return shouldFail ? jsonResponse({ message: 'do not expose this' }, 500) : jsonResponse(page());
    });
    renderPage();
    expect(await screen.findByText('Audit logs could not be loaded. Please retry.')).toBeTruthy();
    fireEvent.change(screen.getByLabelText('Action'), { target: { value: 'LOGIN_FAILURE' } });
    fireEvent.click(screen.getByRole('button', { name: 'Apply filters' }));
    await waitFor(() => expect(requests).toHaveLength(2));
    expect(await screen.findByText('Audit logs could not be loaded. Please retry.')).toBeTruthy();
    shouldFail = false;
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(await screen.findByText('Ada Lovelace')).toBeTruthy();
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(requests[2].searchParams.get('action')).toBe('LOGIN_FAILURE');
  });
});
