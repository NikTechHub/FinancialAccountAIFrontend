import { getDefaultTokenStorage, type TokenStorage } from '../auth/token-storage';
import { resolveApiUrl } from './config';
import type { AuthResponse } from './types';

type SessionListener = (session: AuthResponse | null) => void;

let accessToken: string | null = null;
let tokenStorage: TokenStorage = getDefaultTokenStorage();
let refreshPromise: Promise<AuthResponse> | null = null;
let sessionEpoch = 0;

const listeners = new Set<SessionListener>();

function notify(session: AuthResponse | null) {
  for (const listener of [...listeners]) {
    try {
      listener(session);
    } catch {
      // A broken subscriber must not break authentication state changes.
    }
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isAuthResponse(value: unknown): value is AuthResponse {
  if (!isRecord(value)) return false;
  if (typeof value.accessToken !== 'string' || !value.accessToken) return false;
  if (typeof value.refreshToken !== 'string' || !value.refreshToken) return false;
  if (typeof value.tokenType !== 'string') return false;
  if (typeof value.expiresIn !== 'number') return false;
  if (!isRecord(value.user) || typeof value.user.id !== 'string') return false;

  return value.organization === null || (isRecord(value.organization) && typeof value.organization.id === 'string');
}

async function readJson(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text) return null;

  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

export function getAccessToken(): string | null {
  return accessToken;
}

export function hasRefreshToken(): boolean {
  return Boolean(tokenStorage.getRefreshToken());
}

export function setTokenStorage(storage: TokenStorage): void {
  tokenStorage = storage;
}

export function subscribeToSession(listener: SessionListener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function applyAuthResponse(response: AuthResponse): void {
  sessionEpoch += 1;
  accessToken = response.accessToken;
  tokenStorage.setRefreshToken(response.refreshToken);
  notify(response);
}

export function clearSession(): void {
  sessionEpoch += 1;
  accessToken = null;
  tokenStorage.clear();
  notify(null);
}

async function performRefresh(refreshToken: string, epoch: number): Promise<AuthResponse> {
  const url = resolveApiUrl('/auth/refresh');

  let response: Response;
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ refreshToken }),
    });
  } catch {
    if (epoch === sessionEpoch) clearSession();
    throw new Error('The session could not be refreshed.');
  }

  if (!response.ok) {
    if (epoch === sessionEpoch) clearSession();
    throw new Error('The session has expired.');
  }

  const payload = await readJson(response);
  if (!isAuthResponse(payload)) {
    if (epoch === sessionEpoch) clearSession();
    throw new Error('The session response was invalid.');
  }

  if (epoch !== sessionEpoch) {
    throw new Error('The session changed while it was refreshing.');
  }

  applyAuthResponse(payload);
  return payload;
}

/**
 * Refreshes the session at most once at a time. Concurrent callers share the same
 * promise so refresh-token rotation cannot invalidate a sibling request.
 */
export function refreshSession(): Promise<AuthResponse> {
  if (refreshPromise) return refreshPromise;

  const refreshToken = tokenStorage.getRefreshToken();
  if (!refreshToken) {
    return Promise.reject(new Error('No refresh token is available.'));
  }

  const epoch = sessionEpoch;
  refreshPromise = performRefresh(refreshToken, epoch).finally(() => {
    refreshPromise = null;
  });

  return refreshPromise;
}
