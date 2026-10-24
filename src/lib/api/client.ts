import { resolveApiUrl } from './config';
import {
  clearSession,
  getAccessToken,
  hasRefreshToken,
  refreshSession,
} from './session';

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'HEAD';
export type ApiResponseType = 'json' | 'text' | 'blob';
export type ApiErrorKind = 'http' | 'network' | 'parse';

export interface ApiRequestOptions extends Omit<RequestInit, 'method' | 'body' | 'headers'> {
  body?: unknown;
  headers?: HeadersInit;
  responseType?: ApiResponseType;
  /** Do not attach the access token or attempt a refresh. Used by auth endpoints. */
  skipAuth?: boolean;
  /** Set false to surface a 401 directly instead of attempting refresh and replay. */
  retryOnUnauthorized?: boolean;
}

interface ApiErrorOptions {
  kind: ApiErrorKind;
  status?: number | null;
  statusText?: string;
  fieldErrors?: Record<string, string>;
  data?: unknown;
  url?: string;
}

export class ApiError extends Error {
  readonly kind: ApiErrorKind;
  readonly status: number | null;
  readonly statusText: string;
  readonly fieldErrors?: Record<string, string>;
  readonly data: unknown;
  readonly url: string;

  constructor(message: string, options: ApiErrorOptions) {
    super(message);
    this.name = 'ApiError';
    this.kind = options.kind;
    this.status = options.status ?? null;
    this.statusText = options.statusText ?? '';
    this.fieldErrors = options.fieldErrors;
    this.data = options.data;
    this.url = options.url ?? '';
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isAbortError(error: unknown): boolean {
  return isRecord(error) && error.name === 'AbortError';
}

function isRawBody(value: unknown): value is BodyInit {
  return (
    typeof value === 'string' ||
    value instanceof Blob ||
    value instanceof ArrayBuffer ||
    value instanceof URLSearchParams
  );
}

function toFieldErrors(value: unknown): Record<string, string> | undefined {
  if (!isRecord(value)) return undefined;

  const entries = Object.entries(value).filter(
    (entry): entry is [string, string] => typeof entry[1] === 'string',
  );

  return entries.length ? Object.fromEntries(entries) : undefined;
}

function errorMessage(payload: unknown, statusText: string, status: number): string {
  if (isRecord(payload) && typeof payload.message === 'string' && payload.message.trim()) {
    return payload.message;
  }

  if (typeof payload === 'string') {
    const text = payload.trim();
    const looksLikeMarkup = text.startsWith('<') || text.startsWith('{') || text.startsWith('[');
    if (text && !looksLikeMarkup && text.length <= 500) return text;
  }

  return statusText || `Request failed with status ${status}`;
}

async function parseErrorPayload(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text) return null;

  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

async function parseSuccess<T>(
  response: Response,
  responseType: ApiResponseType,
  method: HttpMethod,
  url: string,
): Promise<T> {
  if (method === 'HEAD' || response.status === 204 || response.status === 205) {
    return undefined as T;
  }

  if (responseType === 'blob') {
    return (await response.blob()) as T;
  }

  const text = await response.text();
  if (!text) return undefined as T;
  if (responseType === 'text') return text as T;

  try {
    return JSON.parse(text) as T;
  } catch {
    throw new ApiError('The server returned an invalid JSON response.', {
      kind: 'parse',
      status: response.status,
      statusText: response.statusText,
      url,
    });
  }
}

export async function apiRequest<T = unknown>(
  method: HttpMethod,
  path: string,
  options: ApiRequestOptions = {},
): Promise<T> {
  const {
    body,
    headers: headersInit,
    responseType = 'json',
    skipAuth = false,
    retryOnUnauthorized = true,
    ...requestInit
  } = options;
  const url = resolveApiUrl(path);
  const baseHeaders = new Headers(headersInit);

  if (!baseHeaders.has('Accept')) baseHeaders.set('Accept', 'application/json');

  let requestBody: BodyInit | undefined;
  if (body instanceof FormData) {
    baseHeaders.delete('Content-Type');
    requestBody = body;
  } else if (body !== undefined) {
    if (isRawBody(body)) {
      requestBody = body;
    } else {
      if (!baseHeaders.has('Content-Type')) baseHeaders.set('Content-Type', 'application/json');
      requestBody = JSON.stringify(body);
    }
  }

  const send = async (token: string | null): Promise<Response> => {
    const headers = new Headers(baseHeaders);
    if (!skipAuth && token) headers.set('Authorization', `Bearer ${token}`);

    try {
      return await fetch(url, {
        ...requestInit,
        method,
        headers,
        body: requestBody,
      });
    } catch (error) {
      if (isAbortError(error)) throw error;

      throw new ApiError('Unable to reach the server.', {
        kind: 'network',
        url,
      });
    }
  };

  let response = await send(getAccessToken());
  let replayedAfterRefresh = false;

  if (response.status === 401 && retryOnUnauthorized && !skipAuth && hasRefreshToken()) {
    try {
      const refreshedSession = await refreshSession();
      response = await send(refreshedSession.accessToken);
      replayedAfterRefresh = true;
    } catch {
      // The session was cleared; surface the original 401 to the caller.
    }
  }

  if (response.status === 401 && replayedAfterRefresh) {
    clearSession();
  }

  if (!response.ok) {
    const payload = await parseErrorPayload(response);
    const fieldErrors = isRecord(payload) ? toFieldErrors(payload.fieldErrors) : undefined;

    throw new ApiError(errorMessage(payload, response.statusText, response.status), {
      kind: 'http',
      status: response.status,
      statusText: response.statusText,
      fieldErrors,
      data: payload,
      url,
    });
  }

  return parseSuccess<T>(response, responseType, method, url);
}

export const api = {
  request: apiRequest,
  get: <T = unknown>(path: string, options?: ApiRequestOptions) =>
    apiRequest<T>('GET', path, options),
  post: <T = unknown>(path: string, body?: unknown, options?: ApiRequestOptions) =>
    apiRequest<T>('POST', path, { ...options, body }),
  put: <T = unknown>(path: string, body?: unknown, options?: ApiRequestOptions) =>
    apiRequest<T>('PUT', path, { ...options, body }),
  patch: <T = unknown>(path: string, body?: unknown, options?: ApiRequestOptions) =>
    apiRequest<T>('PATCH', path, { ...options, body }),
  delete: <T = unknown>(path: string, options?: ApiRequestOptions) =>
    apiRequest<T>('DELETE', path, options),
};
