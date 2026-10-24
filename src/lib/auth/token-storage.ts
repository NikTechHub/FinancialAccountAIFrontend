export interface TokenStorage {
  getRefreshToken(): string | null;
  setRefreshToken(token: string): void;
  clear(): void;
}

const REFRESH_TOKEN_KEY = 'accounting.refreshToken';

export function createStorageTokenStorage(storage: Storage): TokenStorage {
  return {
    getRefreshToken() {
      try {
        return storage.getItem(REFRESH_TOKEN_KEY);
      } catch {
        return null;
      }
    },
    setRefreshToken(token: string) {
      try {
        storage.setItem(REFRESH_TOKEN_KEY, token);
      } catch {
        // Authentication still works for this tab; it just will not survive a reload.
      }
    },
    clear() {
      try {
        storage.removeItem(REFRESH_TOKEN_KEY);
      } catch {
        // Nothing else can be done if browser storage is unavailable.
      }
    },
  };
}

export function createMemoryTokenStorage(): TokenStorage {
  let refreshToken: string | null = null;

  return {
    getRefreshToken: () => refreshToken,
    setRefreshToken: (token: string) => {
      refreshToken = token;
    },
    clear: () => {
      refreshToken = null;
    },
  };
}

const memoryTokenStorage = createMemoryTokenStorage();

/**
 * The refresh token is kept in sessionStorage rather than localStorage.
 *
 * The backend returns refresh tokens in JSON, so JavaScript must be able to read
 * them; HttpOnly cookies are not available. sessionStorage limits the exposure
 * window to the current tab and avoids two tabs racing to rotate the same refresh
 * token. It does not protect against XSS while the tab is open. A future backend
 * can replace this interface with an HttpOnly-cookie implementation.
 */
export function getDefaultTokenStorage(): TokenStorage {
  if (typeof window !== 'undefined') {
    try {
      return createStorageTokenStorage(window.sessionStorage);
    } catch {
      return memoryTokenStorage;
    }
  }

  return memoryTokenStorage;
}
