export const DEFAULT_API_BASE_URL = '/api/v1';

function normalizeBaseUrl(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return DEFAULT_API_BASE_URL;

  if (!/^(?:https?:\/\/|\/)/i.test(trimmed)) {
    throw new Error(
      'VITE_API_BASE_URL must be an absolute URL or a path starting with "/".',
    );
  }

  if (trimmed === '/') return '';
  return trimmed.replace(/\/+$/, '');
}

export function getApiBaseUrl(): string {
  return normalizeBaseUrl(import.meta.env.VITE_API_BASE_URL ?? '');
}

export function resolveApiUrl(path: string, baseUrl = getApiBaseUrl()): string {
  if (/^https?:\/\//i.test(path)) return path;

  const normalizedBase = baseUrl === '/' ? '' : baseUrl.replace(/\/+$/, '');
  const normalizedPath = path.replace(/^\/+/, '');
  if (!normalizedPath) return normalizedBase;

  return normalizedBase ? `${normalizedBase}/${normalizedPath}` : `/${normalizedPath}`;
}
