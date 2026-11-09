// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router';
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
  period: { fromDate: '2026-01-01', toDate: '2026-01-31' }, sources: ['Profit and loss report'], responseMode: 'AI',
};

function renderPage() {
  return render(<MemoryRouter><AuthContext.Provider value={auth}><AccountingAssistantPage /></AuthContext.Provider></MemoryRouter>);
}

function LocationView({ label }: { label: string }) {
  const location = useLocation();
  return <p>{label}: {location.pathname}</p>;
}

function renderNavigationPage() {
  return render(<MemoryRouter initialEntries={['/ai-assistant']}><AuthContext.Provider value={auth}><Routes>
    <Route path="/ai-assistant" element={<AccountingAssistantPage />} />
    <Route path="/invoices" element={<LocationView label="Invoices destination" />} />
  </Routes></AuthContext.Provider></MemoryRouter>);
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

    expect(screen.getByText(/General answers require the server AI provider/)).toBeTruthy();
    fireEvent.change(screen.getByLabelText('Your question'), { target: { value: 'Revenue this month?' } });
    fireEvent.click(screen.getByRole('button', { name: 'Send' }));

    expect(await screen.findByText(/Revenue was \$1,200/)).toBeTruthy();
    expect(postedBody).toEqual({ message: 'Revenue this month?', history: [], language: 'AUTO' });
    expect(screen.getByText(/Sources: Profit and loss report/)).toBeTruthy();
    expect(screen.getByText(/Period: 2026-01-01 to 2026-01-31/)).toBeTruthy();
    expect(within(screen.getByLabelText('Assistant conversation')).queryByRole('img')).toBeNull();
    expect(document.querySelector('script')).toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('sends bounded multi-turn context and the chosen Hindi response language', async () => {
    const bodies: unknown[] = [];
    const fetchMock = createFetchMock([{
      method: 'POST', path: '/api/v1/assistant/chat', handler: ({ body }) => {
        bodies.push(body);
        return jsonResponse({ ...answer, answer: 'पहला उत्तर' });
      },
    }]);
    vi.stubGlobal('fetch', fetchMock);
    renderPage();
    fireEvent.change(screen.getByLabelText('Reply language'), { target: { value: 'HINDI' } });
    fireEvent.change(screen.getByLabelText('Your question'), { target: { value: 'इस महीने का कुल खर्च कितना है?' } });
    fireEvent.click(screen.getByRole('button', { name: 'Send' }));
    await screen.findByText('पहला उत्तर');
    fireEvent.change(screen.getByLabelText('Your question'), { target: { value: 'और पिछले महीने?' } });
    fireEvent.click(screen.getByRole('button', { name: 'Send' }));
    await waitFor(() => expect(bodies).toHaveLength(2));
    expect(bodies[1]).toMatchObject({ language: 'HINDI', history: [
      { role: 'user', content: 'इस महीने का कुल खर्च कितना है?' }, { role: 'assistant', content: 'पहला उत्तर' },
    ] });
  });

  it('explains when browser speech recognition is unavailable', () => {
    renderPage();
    fireEvent.click(screen.getByRole('button', { name: 'Use microphone' }));
    expect(screen.getByText(/Speech recognition is not supported by this browser/)).toBeTruthy();
  });

  it('answers hello locally without making an API request', async () => {
    const fetchMock = createFetchMock([]);
    vi.stubGlobal('fetch', fetchMock);
    renderPage();
    fireEvent.change(screen.getByLabelText('Your question'), { target: { value: 'hello' } });
    fireEvent.click(screen.getByRole('button', { name: 'Send' }));
    expect(await screen.findByText(/Hello! I’m the Fintrix AI Assistant/)).toBeTruthy();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('opens invoices through React Router for typed and transcribed commands', async () => {
    const fetchMock = createFetchMock([]);
    vi.stubGlobal('fetch', fetchMock);
    class MockRecognition {
      lang = '';
      continuous = false;
      interimResults = false;
      onresult: ((event: { resultIndex: number; results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null = null;
      onerror: ((event: { error: string }) => void) | null = null;
      onend: (() => void) | null = null;
      start() { this.onresult?.({ resultIndex: 0, results: [[{ transcript: 'open invoices' }]] }); }
      stop() { this.onend?.(); }
      abort() { this.onend?.(); }
    }
    vi.stubGlobal('SpeechRecognition', MockRecognition);
    renderNavigationPage();
    fireEvent.click(screen.getByRole('button', { name: 'Use microphone' }));
    await waitFor(() => expect((screen.getByLabelText('Your question') as HTMLTextAreaElement).value).toBe('open invoices'));
    fireEvent.click(screen.getByRole('button', { name: 'Send' }));
    expect(await screen.findByText('Invoices destination: /invoices')).toBeTruthy();
    expect(fetchMock).not.toHaveBeenCalled();
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
    fireEvent.click(screen.getByRole('button', { name: 'Send' }));

    expect(screen.getByRole('status').textContent).toContain('Thinking');
    expect(screen.getByRole('button', { name: 'Sending…' }).hasAttribute('disabled')).toBe(true);
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
    fireEvent.click(screen.getByRole('button', { name: 'Send' }));

    expect(await screen.findByText(status === 401 ? 'Your session has expired. Please sign in again.' : 'You do not have permission to use the assistant.')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Retry' })).toBeTruthy();
    expect(screen.queryByText('internal detail')).toBeNull();
    expect(screen.queryByText(/Assistant ·/)).toBeNull();
    expect((screen.getByLabelText('Your question') as HTMLTextAreaElement).value).toBe('Show my balance');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
