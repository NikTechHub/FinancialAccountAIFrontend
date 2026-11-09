// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthContext, type AuthContextValue } from 'src/features/auth/auth-context';
import { clearSession } from 'src/lib/api/session';
import { createFetchMock, jsonResponse, testOrganization, testUser } from 'src/test/api-fixtures';
import { AccountingAssistantPage } from './AccountingAssistantPage';

const auth: AuthContextValue = {
  status: 'authenticated', user: testUser, organization: testOrganization, role: 'VIEWER',
  membershipError: null, login: vi.fn(), register: vi.fn(), logout: vi.fn(),
};

const answer = {
  answer: 'Revenue was $1,200.\n<script>alert(1)</script>', dataUsed: true,
  period: { fromDate: '2026-01-01', toDate: '2026-01-31' }, sources: ['Profit and loss report'],
};

function renderPage() {
  return render(<MemoryRouter><AuthContext.Provider value={auth}><AccountingAssistantPage /></AuthContext.Provider></MemoryRouter>);
}

beforeEach(() => clearSession());
afterEach(() => { cleanup(); clearSession(); vi.unstubAllGlobals(); });

describe('AI Accounting Assistant', () => {
  it('submits the current question and safely displays backend answer, sources, and fallback disclosure', async () => {
    let postedBody: unknown;
    const fetchMock = createFetchMock([{
      method: 'POST', path: '/api/v1/assistant/chat', handler: ({ body }) => {
        postedBody = body;
        return jsonResponse(answer);
      },
    }]);
    vi.stubGlobal('fetch', fetchMock);
    renderPage();

    expect(screen.getByText(/deterministic fallback text/)).toBeTruthy();
    fireEvent.change(screen.getByLabelText('Your question'), { target: { value: 'Revenue this month?' } });
    fireEvent.click(screen.getByRole('button', { name: 'Ask assistant' }));

    expect(await screen.findByText(/Revenue was \$1,200/)).toBeTruthy();
    expect(postedBody).toEqual({ message: 'Revenue this month?' });
    expect(screen.getByText(/Sources: Profit and loss report/)).toBeTruthy();
    expect(screen.getByText(/Period: 2026-01-01 to 2026-01-31/)).toBeTruthy();
    expect(within(screen.getByLabelText('Assistant conversation')).queryByRole('img')).toBeNull();
    expect(document.querySelector('script')).toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('shows loading and prevents duplicate submissions while a request is pending', async () => {
    let resolveResponse!: (response: Response) => void;
    const pending = new Promise<Response>((resolve) => { resolveResponse = resolve; });
    const fetchMock = createFetchMock([{
      method: 'POST', path: '/api/v1/assistant/chat', handler: () => pending,
    }]);
    vi.stubGlobal('fetch', fetchMock);
    renderPage();
    fireEvent.change(screen.getByLabelText('Your question'), { target: { value: 'Profit last month?' } });
    fireEvent.click(screen.getByRole('button', { name: 'Ask assistant' }));

    expect(screen.getByRole('status').textContent).toContain('Getting an answer');
    expect(screen.getByRole('button', { name: 'Sending...' }).hasAttribute('disabled')).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    await act(async () => resolveResponse(jsonResponse(answer)));
    await waitFor(() => expect(screen.getByText(/Revenue was \$1,200/)).toBeTruthy());
  });

  it.each([401, 403])('shows a safe retryable message for HTTP %s without fabricated answers', async (status) => {
    const fetchMock = createFetchMock([{
      method: 'POST', path: '/api/v1/assistant/chat', handler: () => jsonResponse({ message: 'internal detail' }, status),
    }]);
    vi.stubGlobal('fetch', fetchMock);
    renderPage();
    fireEvent.change(screen.getByLabelText('Your question'), { target: { value: 'Show my balance' } });
    fireEvent.click(screen.getByRole('button', { name: 'Ask assistant' }));

    expect(await screen.findByText(status === 401 ? 'Your session has expired. Please sign in again.' : 'You do not have permission to use the assistant.')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Retry' })).toBeTruthy();
    expect(screen.queryByText('internal detail')).toBeNull();
    expect(screen.queryByText(/Assistant ·/)).toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
