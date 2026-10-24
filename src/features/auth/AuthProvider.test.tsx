// @vitest-environment jsdom
import { useState } from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createMemoryTokenStorage, type TokenStorage } from 'src/lib/auth/token-storage';
import { clearSession, getAccessToken, setTokenStorage } from 'src/lib/api/session';
import type { RegisterRequest } from 'src/lib/api/types';
import {
  createFetchMock,
  jsonResponse,
  makeAuthResponse,
  makeMembership,
  testOrganization,
  testUser,
} from 'src/test/api-fixtures';
import { AuthProvider } from './AuthProvider';
import { useAuth } from './useAuth';
import { useRole } from './useRole';

const registerPayload: RegisterRequest = {
  firstName: 'Ada',
  lastName: 'Lovelace',
  email: 'ada@example.com',
  password: 'new-password',
  organizationName: 'Analytical Engines',
  legalName: 'Analytical Engines LLC',
  businessType: 'Services',
  country: 'US',
  currency: 'USD',
  timezone: 'America/New_York',
};

let storage: TokenStorage;

function AuthProbe() {
  const auth = useAuth();
  const { hasRole } = useRole();
  const [error, setError] = useState('');

  const run = async (action: () => Promise<void>) => {
    try {
      await action();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unknown error');
    }
  };

  return (
    <div>
      <span data-testid="status">{auth.status}</span>
      <span data-testid="email">{auth.user?.email ?? ''}</span>
      <span data-testid="organization">{auth.organization?.id ?? ''}</span>
      <span data-testid="role">{auth.role ?? ''}</span>
      <span data-testid="membership-error">{auth.membershipError ?? ''}</span>
      <span data-testid="is-viewer">{hasRole('VIEWER') ? 'yes' : 'no'}</span>
      <span data-testid="error">{error}</span>
      <button
        type="button"
        onClick={() => void run(() => auth.login({ email: 'ada@example.com', password: 'secret' }))}
      >
        login
      </button>
      <button
        type="button"
        onClick={() => void run(() => auth.login({ email: 'ada@example.com', password: 'wrong' }))}
      >
        login-fail
      </button>
      <button type="button" onClick={() => void run(() => auth.register(registerPayload))}>
        register
      </button>
      <button type="button" onClick={auth.logout}>
        logout
      </button>
    </div>
  );
}

function renderProvider() {
  return render(
    <AuthProvider>
      <AuthProbe />
    </AuthProvider>,
  );
}

async function waitForStatus(status: string) {
  await waitFor(() => expect(screen.getByTestId('status').textContent).toBe(status));
}

beforeEach(() => {
  vi.stubEnv('VITE_API_BASE_URL', '/api/v1');
  storage = createMemoryTokenStorage();
  setTokenStorage(storage);
  clearSession();
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe('AuthProvider', () => {
  it('logs in and initializes the user, organization, and role', async () => {
    const fetchMock = createFetchMock([
      {
        method: 'POST',
        path: '/api/v1/auth/login',
        handler: ({ body, headers }) => {
          expect(body).toEqual({ email: 'ada@example.com', password: 'secret' });
          expect(headers.has('Authorization')).toBe(false);
          return jsonResponse(makeAuthResponse());
        },
      },
      {
        method: 'GET',
        path: `/api/v1/organizations/${testOrganization.id}/members`,
        handler: ({ headers }) => {
          expect(headers.get('Authorization')).toBe('Bearer access-token-1');
          return jsonResponse([makeMembership({ role: 'ADMIN' })]);
        },
      },
    ]);
    vi.stubGlobal('fetch', fetchMock);
    renderProvider();

    fireEvent.click(screen.getByRole('button', { name: 'login' }));

    await waitForStatus('authenticated');
    expect(screen.getByTestId('email').textContent).toBe(testUser.email);
    expect(screen.getByTestId('organization').textContent).toBe(testOrganization.id);
    expect(screen.getByTestId('role').textContent).toBe('ADMIN');
  });

  it('keeps the user unauthenticated when login fails', async () => {
    const fetchMock = createFetchMock([
      {
        method: 'POST',
        path: '/api/v1/auth/login',
        handler: () => jsonResponse({ message: 'Invalid email or password' }, 401),
      },
    ]);
    vi.stubGlobal('fetch', fetchMock);
    renderProvider();

    fireEvent.click(screen.getByRole('button', { name: 'login-fail' }));

    await waitFor(() =>
      expect(screen.getByTestId('error').textContent).toBe('Invalid email or password'),
    );
    expect(screen.getByTestId('status').textContent).toBe('unauthenticated');
    expect(screen.getByTestId('role').textContent).toBe('');
  });

  it('registers and initializes the returned OWNER session', async () => {
    let registerBody: unknown;
    const fetchMock = createFetchMock([
      {
        method: 'POST',
        path: '/api/v1/auth/register',
        handler: ({ body }) => {
          registerBody = body;
          return jsonResponse(makeAuthResponse(), 201);
        },
      },
      {
        method: 'GET',
        path: `/api/v1/organizations/${testOrganization.id}/members`,
        handler: () =>
          jsonResponse([
            makeMembership({
              role: 'OWNER',
              userEmail: registerPayload.email,
              userFirstName: registerPayload.firstName,
              userLastName: registerPayload.lastName,
            }),
          ]),
      },
    ]);
    vi.stubGlobal('fetch', fetchMock);
    renderProvider();

    fireEvent.click(screen.getByRole('button', { name: 'register' }));

    await waitForStatus('authenticated');
    expect(registerBody).toEqual(registerPayload);
    expect(screen.getByTestId('role').textContent).toBe('OWNER');
  });

  it('matches membership by user id instead of using the first member', async () => {
    const fetchMock = createFetchMock([
      {
        method: 'POST',
        path: '/api/v1/auth/login',
        handler: () => jsonResponse(makeAuthResponse()),
      },
      {
        method: 'GET',
        path: `/api/v1/organizations/${testOrganization.id}/members`,
        handler: () =>
          jsonResponse([
            makeMembership({ userId: 'another-user', role: 'OWNER' }),
            makeMembership({ role: 'VIEWER' }),
          ]),
      },
    ]);
    vi.stubGlobal('fetch', fetchMock);
    renderProvider();

    fireEvent.click(screen.getByRole('button', { name: 'login' }));

    await waitForStatus('authenticated');
    expect(screen.getByTestId('role').textContent).toBe('VIEWER');
    expect(screen.getByTestId('is-viewer').textContent).toBe('yes');
  });

  it('authenticates without an organization but grants no role', async () => {
    const fetchMock = createFetchMock([
      {
        method: 'POST',
        path: '/api/v1/auth/login',
        handler: () => jsonResponse(makeAuthResponse({ organization: null })),
      },
    ]);
    vi.stubGlobal('fetch', fetchMock);
    renderProvider();

    fireEvent.click(screen.getByRole('button', { name: 'login' }));

    await waitForStatus('authenticated');
    expect(screen.getByTestId('organization').textContent).toBe('');
    expect(screen.getByTestId('role').textContent).toBe('');
    expect(screen.getByTestId('membership-error').textContent).toBe('');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('does not grant a role when membership lookup fails', async () => {
    const fetchMock = createFetchMock([
      {
        method: 'POST',
        path: '/api/v1/auth/login',
        handler: () => jsonResponse(makeAuthResponse()),
      },
      {
        method: 'GET',
        path: `/api/v1/organizations/${testOrganization.id}/members`,
        handler: () => jsonResponse({ message: 'Server error' }, 500),
      },
    ]);
    vi.stubGlobal('fetch', fetchMock);
    renderProvider();

    fireEvent.click(screen.getByRole('button', { name: 'login' }));

    await waitForStatus('authenticated');
    expect(screen.getByTestId('role').textContent).toBe('');
    expect(screen.getByTestId('membership-error').textContent).toContain('unavailable');
  });

  it('restores a session from the stored refresh token on startup', async () => {
    storage.setRefreshToken('stored-refresh');
    const fetchMock = createFetchMock([
      {
        method: 'POST',
        path: '/api/v1/auth/refresh',
        handler: ({ body }) => {
          expect(body).toEqual({ refreshToken: 'stored-refresh' });
          return jsonResponse(
            makeAuthResponse({ accessToken: 'boot-access', refreshToken: 'boot-refresh' }),
          );
        },
      },
      {
        method: 'GET',
        path: `/api/v1/organizations/${testOrganization.id}/members`,
        handler: () => jsonResponse([makeMembership({ role: 'ACCOUNTANT' })]),
      },
    ]);
    vi.stubGlobal('fetch', fetchMock);
    renderProvider();

    await waitForStatus('authenticated');

    expect(screen.getByTestId('role').textContent).toBe('ACCOUNTANT');
    expect(getAccessToken()).toBe('boot-access');
    expect(storage.getRefreshToken()).toBe('boot-refresh');
  });

  it('clears the session when startup refresh fails', async () => {
    storage.setRefreshToken('stale-refresh');
    const fetchMock = createFetchMock([
      {
        method: 'POST',
        path: '/api/v1/auth/refresh',
        handler: () => jsonResponse({ message: 'Refresh token invalid' }, 401),
      },
    ]);
    vi.stubGlobal('fetch', fetchMock);
    renderProvider();

    await waitForStatus('unauthenticated');
    expect(getAccessToken()).toBeNull();
    expect(storage.getRefreshToken()).toBeNull();
  });

  it('logout clears the client session state', async () => {
    const fetchMock = createFetchMock([
      {
        method: 'POST',
        path: '/api/v1/auth/login',
        handler: () => jsonResponse(makeAuthResponse()),
      },
      {
        method: 'GET',
        path: `/api/v1/organizations/${testOrganization.id}/members`,
        handler: () => jsonResponse([makeMembership()]),
      },
    ]);
    vi.stubGlobal('fetch', fetchMock);
    renderProvider();

    fireEvent.click(screen.getByRole('button', { name: 'login' }));
    await waitForStatus('authenticated');

    fireEvent.click(screen.getByRole('button', { name: 'logout' }));

    await waitForStatus('unauthenticated');
    expect(screen.getByTestId('email').textContent).toBe('');
    expect(screen.getByTestId('organization').textContent).toBe('');
    expect(screen.getByTestId('role').textContent).toBe('');
    expect(getAccessToken()).toBeNull();
    expect(storage.getRefreshToken()).toBeNull();
  });
});
