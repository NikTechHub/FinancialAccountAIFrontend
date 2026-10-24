interface DestinationLocation {
  pathname?: unknown;
  search?: unknown;
  hash?: unknown;
}

export function getPostLoginPath(state: unknown): string {
  if (typeof state !== 'object' || state === null) return '/';

  const from = (state as { from?: unknown }).from;
  if (typeof from !== 'object' || from === null) return '/';

  const { pathname, search, hash } = from as DestinationLocation;
  if (
    typeof pathname !== 'string' ||
    !pathname.startsWith('/') ||
    pathname.startsWith('//') ||
    pathname.includes('\\')
  ) {
    return '/';
  }

  const safeSearch = typeof search === 'string' && search.startsWith('?') ? search : '';
  const safeHash = typeof hash === 'string' && hash.startsWith('#') ? hash : '';

  return `${pathname}${safeSearch}${safeHash}`;
}
