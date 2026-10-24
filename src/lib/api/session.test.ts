import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createMemoryTokenStorage, type TokenStorage } from '../auth/token-storage';
import {
  applyAuthResponse,
  clearSession,
  getAccessToken,
  refreshSession,
  setTokenStorage,
  subscribeToSession,
} from './session';
import { createFetchMock, jsonResponse, makeAuthResponse } from 'src/test/api-fixtures';

let storage: TokenStorage;

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

describe('session refresh', () => {
  it('rotates both tokens and reports the refreshed session', async () => {
    applyAuthResponse(
      makeAuthResponse({ accessToken: 'old-access', refreshToken: 'old-refresh' }),
    );
    const refreshed = makeAuthResponse({
      accessToken: 'new-access',
      refreshToken: 'new-refresh',
    });
    const fetchMock = createFetchMock([
      {
        method: 'POST',
        path: '/api/v1/auth/refresh',
        handler: ({ body }) => {
          expect(body).toEqual({ refreshToken: 'old-refresh' });
          return jsonResponse(refreshed);
        },
      },
    ]);
    vi.stubGlobal('fetch', fetchMock);
    const listener = vi.fn();
    const unsubscribe = subscribeToSession(listener);

    await expect(refreshSession()).resolves.toEqual(refreshed);

    expect(getAccessToken()).toBe('new-access');
    expect(storage.getRefreshToken()).toBe('new-refresh');
    expect(listener).toHaveBeenLastCalledWith(refreshed);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    unsubscribe();
  });

  it('shares a single refresh request between concurrent callers', async () => {
    applyAuthResponse(
      makeAuthResponse({ accessToken: 'old-access', refreshToken: 'old-refresh' }),
    );
    let resolveRefresh: (response: Response) => void = () => undefined;
    const pendingRefresh = new Promise<Response>((resolve) => {
      resolveRefresh = resolve;
    });
    const fetchMock = createFetchMock([
      {
        method: 'POST',
        path: '/api/v1/auth/refresh',
        handler: () => pendingRefresh,
      },
    ]);
    vi.stubGlobal('fetch', fetchMock);

    const first = refreshSession();
    const second = refreshSession();

    expect(fetchMock).toHaveBeenCalledTimes(1);

    resolveRefresh(
      jsonResponse(
        makeAuthResponse({ accessToken: 'new-access', refreshToken: 'new-refresh' }),
      ),
    );

    const results = await Promise.all([first, second]);
    expect(results).toHaveLength(2);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(storage.getRefreshToken()).toBe('new-refresh');
  });

  it('clears the local session when the refresh token is rejected', async () => {
    applyAuthResponse(
      makeAuthResponse({ accessToken: 'old-access', refreshToken: 'stale-refresh' }),
    );
    const fetchMock = createFetchMock([
      {
        method: 'POST',
        path: '/api/v1/auth/refresh',
        handler: () => jsonResponse({ message: 'Refresh token invalid' }, 401),
      },
    ]);
    vi.stubGlobal('fetch', fetchMock);
    const listener = vi.fn();
    const unsubscribe = subscribeToSession(listener);

    await expect(refreshSession()).rejects.toThrow();

    expect(getAccessToken()).toBeNull();
    expect(storage.getRefreshToken()).toBeNull();
    expect(listener).toHaveBeenLastCalledWith(null);

    unsubscribe();
  });

  it('clears the local session when refresh returns an invalid payload', async () => {
    applyAuthResponse(makeAuthResponse({ refreshToken: 'stale-refresh' }));
    const fetchMock = createFetchMock([
      {
        method: 'POST',
        path: '/api/v1/auth/refresh',
        handler: () => jsonResponse({ accessToken: 'missing-refresh-token' }),
      },
    ]);
    vi.stubGlobal('fetch', fetchMock);

    await expect(refreshSession()).rejects.toThrow();

    expect(getAccessToken()).toBeNull();
    expect(storage.getRefreshToken()).toBeNull();
  });

  it('does not clear a newer session when a stale refresh fails', async () => {
    applyAuthResponse(
      makeAuthResponse({ accessToken: 'old-access', refreshToken: 'old-refresh' }),
    );
    let resolveRefresh: (response: Response) => void = () => undefined;
    const pendingRefresh = new Promise<Response>((resolve) => {
      resolveRefresh = resolve;
    });
    const fetchMock = createFetchMock([
      {
        method: 'POST',
        path: '/api/v1/auth/refresh',
        handler: () => pendingRefresh,
      },
    ]);
    vi.stubGlobal('fetch', fetchMock);

    const refresh = refreshSession();
    const newerSession = makeAuthResponse({
      accessToken: 'newer-access',
      refreshToken: 'newer-refresh',
    });
    applyAuthResponse(newerSession);

    resolveRefresh(jsonResponse({ message: 'Refresh token invalid' }, 401));

    await expect(refresh).rejects.toThrow();
    expect(getAccessToken()).toBe('newer-access');
    expect(storage.getRefreshToken()).toBe('newer-refresh');
  });

  it('rejects without a network call when no refresh token exists', async () => {
    const fetchMock = createFetchMock([]);
    vi.stubGlobal('fetch', fetchMock);

    await expect(refreshSession()).rejects.toThrow(/refresh token/i);

    expect(fetchMock).not.toHaveBeenCalled();
  });
});
