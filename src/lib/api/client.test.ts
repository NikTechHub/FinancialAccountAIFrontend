import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError, api } from './client';
import { getApiBaseUrl } from './config';

const fetchMock = vi.fn<typeof fetch>();

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

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
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  fetchMock.mockReset();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe('API client', () => {
  it('resolves endpoint paths and returns JSON', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ id: 'vendor-1' }));

    const result = await api.get<{ id: string }>('/vendors?page=0&size=10');
    const [url, init] = fetchMock.mock.calls[0];

    expect(result).toEqual({ id: 'vendor-1' });
    expect(url).toBe('/api/v1/vendors?page=0&size=10');
    expect(init?.method).toBe('GET');
  });

  it('supports an absolute API base URL without duplicate slashes', async () => {
    vi.stubEnv('VITE_API_BASE_URL', 'http://localhost:8080/api/v1/');
    fetchMock.mockResolvedValue(jsonResponse({ status: 'UP' }));

    await api.get('/health');

    expect(fetchMock.mock.calls[0][0]).toBe('http://localhost:8080/api/v1/health');
  });

  it('defaults to /api/v1 and rejects invalid base URLs', () => {
    vi.stubEnv('VITE_API_BASE_URL', '');
    expect(getApiBaseUrl()).toBe('/api/v1');

    vi.stubEnv('VITE_API_BASE_URL', 'localhost:8080/api/v1');
    expect(() => getApiBaseUrl()).toThrow(/VITE_API_BASE_URL/);
  });

  it('serializes JSON request bodies and headers', async () => {
    const payload = { email: 'user@example.com', password: 'demo-password' };
    fetchMock.mockResolvedValue(jsonResponse({ id: 'user-1' }, 201));

    await api.post('/auth/login', payload);

    const init = fetchMock.mock.calls[0][1];
    expect(init?.method).toBe('POST');
    expect(init?.body).toBe(JSON.stringify(payload));
    expect(new Headers(init?.headers).get('Content-Type')).toBe('application/json');
  });

  it('returns undefined for empty 204 responses', async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 204 }));

    await expect(api.delete('/vendors/vendor-1')).resolves.toBeUndefined();
  });

  it('returns undefined for empty 200 responses', async () => {
    fetchMock.mockResolvedValue(
      new Response('', {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    await expect(api.get('/reports/dashboard')).resolves.toBeUndefined();
  });

  it('exposes parsed HTTP errors and field errors', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(
        {
          status: 400,
          error: 'Bad Request',
          message: 'Validation failed',
          fieldErrors: { email: 'must be valid' },
        },
        400,
      ),
    );

    const error = await captureApiError(api.post('/auth/register', {}));

    expect(error).toBeInstanceOf(ApiError);
    expect(error.kind).toBe('http');
    expect(error.status).toBe(400);
    expect(error.message).toBe('Validation failed');
    expect(error.fieldErrors).toEqual({ email: 'must be valid' });
  });

  it('handles plain-text error responses defensively', async () => {
    fetchMock.mockResolvedValue(
      new Response('Bad gateway', {
        status: 502,
        statusText: 'Bad Gateway',
        headers: { 'Content-Type': 'text/plain' },
      }),
    );

    const error = await captureApiError(api.get('/reports'));

    expect(error.kind).toBe('http');
    expect(error.status).toBe(502);
    expect(error.message).toBe('Bad gateway');
    expect(error.data).toBe('Bad gateway');
  });

  it('falls back to the HTTP status for malformed JSON errors', async () => {
    fetchMock.mockResolvedValue(
      new Response('{"message":', {
        status: 500,
        statusText: 'Internal Server Error',
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    const error = await captureApiError(api.get('/reports'));

    expect(error.kind).toBe('http');
    expect(error.status).toBe(500);
    expect(error.message).toBe('Internal Server Error');
  });

  it('wraps network failures without retrying', async () => {
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'));

    const error = await captureApiError(api.get('/health'));

    expect(error.kind).toBe('network');
    expect(error.status).toBeNull();
    expect(error.message).toBe('Unable to reach the server.');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('sends FormData without forcing a multipart Content-Type', async () => {
    const form = new FormData();
    form.append('documentType', 'INVOICE');
    form.append('file', new Blob(['invoice'], { type: 'text/plain' }), 'invoice.txt');
    fetchMock.mockResolvedValue(jsonResponse({ id: 'document-1' }, 201));

    await api.post('/documents', form);

    const init = fetchMock.mock.calls[0][1];
    expect(init?.body).toBe(form);
    expect(new Headers(init?.headers).has('Content-Type')).toBe(false);
  });

  it('propagates AbortSignal cancellation', async () => {
    const controller = new AbortController();
    fetchMock.mockImplementation(
      (_input, init) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => {
            reject(new DOMException('Aborted', 'AbortError'));
          });
        }),
    );

    const request = api.get('/documents', { signal: controller.signal });
    controller.abort();

    await expect(request).rejects.toMatchObject({ name: 'AbortError' });
  });
});
