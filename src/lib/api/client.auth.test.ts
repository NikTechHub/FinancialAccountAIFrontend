import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createMemoryTokenStorage, type TokenStorage } from '../auth/token-storage';
import { ApiError, api } from './client';
import {
  applyAuthResponse,
  clearSession,
  getAccessToken,
  setTokenStorage,
} from './session';
import { createFetchMock, jsonResponse, makeAuthResponse } from 'src/test/api-fixtures';

let storage: TokenStorage;

async function captureApiError(promise: Promise<unknown>): Promise<ApiError> {
  try {
    await promise;
  } catch (error) {
    if (error instanceof ApiError) return error;
    throw error;
  }

  throw new Error('Expected the request to reject');
}

beforeEach(() => {
  vi.stubEnv('VITE_API_BASE_URL', '/api/v1');
  storage = createMemoryTokenStorage();
  setTokenStorage(storage);
  clearSession();
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe('API client authentication', () => {
  it('refreshes once and replays a 401 with the new access token', async () => {
    applyAuthResponse(
      makeAuthResponse({ accessToken: 'old-access', refreshToken: 'old-refresh' }),
    );
    const refreshed = makeAuthResponse({
      accessToken: 'new-access',
      refreshToken: 'new-refresh',
    });
    let vendorCalls = 0;
    const fetchMock = createFetchMock([
      {
        method: 'GET',
        path: '/api/v1/vendors',
        handler: ({ headers }) => {
          vendorCalls += 1;
          if (vendorCalls === 1) {
            expect(headers.get('Authorization')).toBe('Bearer old-access');
            return jsonResponse({ message: 'Access token expired' }, 401);
          }

          expect(headers.get('Authorization')).toBe('Bearer new-access');
          return jsonResponse({ content: [] });
        },
      },
      {
        method: 'POST',
        path: '/api/v1/auth/refresh',
        handler: () => jsonResponse(refreshed),
      },
    ]);
    vi.stubGlobal('fetch', fetchMock);

    await expect(api.get('/vendors')).resolves.toEqual({ content: [] });

    expect(vendorCalls).toBe(2);
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(storage.getRefreshToken()).toBe('new-refresh');
  });

  it('shares one refresh between concurrent 401 responses', async () => {
    applyAuthResponse(
      makeAuthResponse({ accessToken: 'old-access', refreshToken: 'old-refresh' }),
    );
    const refreshed = makeAuthResponse({
      accessToken: 'new-access',
      refreshToken: 'new-refresh',
    });
    let refreshCalls = 0;
    let resolveRefresh: (response: Response) => void = () => undefined;
    const pendingRefresh = new Promise<Response>((resolve) => {
      resolveRefresh = resolve;
    });
    const fetchMock = createFetchMock([
      {
        method: 'GET',
        path: '/api/v1/vendors',
        handler: ({ headers }) =>
          headers.get('Authorization') === 'Bearer new-access'
            ? jsonResponse({ ok: true })
            : jsonResponse({ message: 'Access token expired' }, 401),
      },
      {
        method: 'POST',
        path: '/api/v1/auth/refresh',
        handler: () => {
          refreshCalls += 1;
          return pendingRefresh;
        },
      },
    ]);
    vi.stubGlobal('fetch', fetchMock);

    const first = api.get('/vendors');
    const second = api.get('/vendors');

    await vi.waitFor(() => expect(refreshCalls).toBe(1));
    resolveRefresh(jsonResponse(refreshed));

    await expect(Promise.all([first, second])).resolves.toEqual([
      { ok: true },
      { ok: true },
    ]);
    expect(refreshCalls).toBe(1);
    expect(fetchMock).toHaveBeenCalledTimes(5);
  });

  it('retries an eligible request at most once', async () => {
    applyAuthResponse(
      makeAuthResponse({ accessToken: 'old-access', refreshToken: 'old-refresh' }),
    );
    const refreshed = makeAuthResponse({
      accessToken: 'new-access',
      refreshToken: 'new-refresh',
    });
    let vendorCalls = 0;
    let refreshCalls = 0;
    const fetchMock = createFetchMock([
      {
        method: 'GET',
        path: '/api/v1/vendors',
        handler: () => {
          vendorCalls += 1;
          return jsonResponse({ message: 'Access token expired' }, 401);
        },
      },
      {
        method: 'POST',
        path: '/api/v1/auth/refresh',
        handler: () => {
          refreshCalls += 1;
          return jsonResponse(refreshed);
        },
      },
    ]);
    vi.stubGlobal('fetch', fetchMock);

    const error = await captureApiError(api.get('/vendors'));

    expect(error.status).toBe(401);
    expect(vendorCalls).toBe(2);
    expect(refreshCalls).toBe(1);
    expect(getAccessToken()).toBeNull();
    expect(storage.getRefreshToken()).toBeNull();
  });

  it('does not refresh a 403 response', async () => {
    applyAuthResponse(
      makeAuthResponse({ accessToken: 'access-token', refreshToken: 'refresh-token' }),
    );
    let refreshCalls = 0;
    const fetchMock = createFetchMock([
      {
        method: 'GET',
        path: '/api/v1/reports/trial-balance',
        handler: () => jsonResponse({ message: 'Forbidden' }, 403),
      },
      {
        method: 'POST',
        path: '/api/v1/auth/refresh',
        handler: () => {
          refreshCalls += 1;
          return jsonResponse(makeAuthResponse());
        },
      },
    ]);
    vi.stubGlobal('fetch', fetchMock);

    const error = await captureApiError(api.get('/reports/trial-balance'));

    expect(error.status).toBe(403);
    expect(refreshCalls).toBe(0);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('clears the session and surfaces the original 401 when refresh fails', async () => {
    applyAuthResponse(
      makeAuthResponse({ accessToken: 'old-access', refreshToken: 'stale-refresh' }),
    );
    let vendorCalls = 0;
    let refreshCalls = 0;
    const fetchMock = createFetchMock([
      {
        method: 'GET',
        path: '/api/v1/vendors',
        handler: () => {
          vendorCalls += 1;
          return jsonResponse({ message: 'Access token expired' }, 401);
        },
      },
      {
        method: 'POST',
        path: '/api/v1/auth/refresh',
        handler: () => {
          refreshCalls += 1;
          return jsonResponse({ message: 'Refresh token invalid' }, 401);
        },
      },
    ]);
    vi.stubGlobal('fetch', fetchMock);

    const error = await captureApiError(api.get('/vendors'));

    expect(error.status).toBe(401);
    expect(error.message).toBe('Access token expired');
    expect(vendorCalls).toBe(1);
    expect(refreshCalls).toBe(1);
    expect(getAccessToken()).toBeNull();
    expect(storage.getRefreshToken()).toBeNull();
  });

  it('does not attach a token or refresh for auth endpoints', async () => {
    applyAuthResponse(makeAuthResponse());
    let loginCalls = 0;
    let refreshCalls = 0;
    const fetchMock = createFetchMock([
      {
        method: 'POST',
        path: '/api/v1/auth/login',
        handler: ({ headers }) => {
          loginCalls += 1;
          expect(headers.has('Authorization')).toBe(false);
          return jsonResponse({ message: 'Invalid credentials' }, 401);
        },
      },
      {
        method: 'POST',
        path: '/api/v1/auth/refresh',
        handler: () => {
          refreshCalls += 1;
          return jsonResponse(makeAuthResponse());
        },
      },
    ]);
    vi.stubGlobal('fetch', fetchMock);

    const error = await captureApiError(
      api.post(
        '/auth/login',
        { email: 'ada@example.com', password: 'wrong' },
        { skipAuth: true, retryOnUnauthorized: false },
      ),
    );

    expect(error.status).toBe(401);
    expect(loginCalls).toBe(1);
    expect(refreshCalls).toBe(0);
  });
});
