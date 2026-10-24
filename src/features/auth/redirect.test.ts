import { describe, expect, it } from 'vitest';
import { getPostLoginPath } from './redirect';

describe('getPostLoginPath', () => {
  it('returns the original in-app destination with search and hash', () => {
    expect(
      getPostLoginPath({
        from: { pathname: '/apps/notes', search: '?page=2', hash: '#top' },
      }),
    ).toBe('/apps/notes?page=2#top');
  });

  it('falls back to the dashboard for missing or unsafe destinations', () => {
    expect(getPostLoginPath(undefined)).toBe('/');
    expect(getPostLoginPath({ from: { pathname: 'https://evil.example' } })).toBe('/');
    expect(getPostLoginPath({ from: { pathname: '//evil.example' } })).toBe('/');
    expect(getPostLoginPath({ from: { pathname: '/apps\\notes' } })).toBe('/');
  });
});
