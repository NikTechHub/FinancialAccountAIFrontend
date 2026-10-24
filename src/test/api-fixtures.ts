import { vi } from 'vitest';
import type {
  AuthResponse,
  MembershipResponse,
  OrganizationResponse,
  UserResponse,
} from 'src/lib/api/types';

export const testUser: UserResponse = {
  id: '11111111-1111-1111-1111-111111111111',
  firstName: 'Ada',
  lastName: 'Lovelace',
  email: 'ada@example.com',
  active: true,
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
};

export const testOrganization: OrganizationResponse = {
  id: '22222222-2222-2222-2222-222222222222',
  name: 'Analytical Engines',
  legalName: 'Analytical Engines LLC',
  businessType: 'Services',
  country: 'US',
  currency: 'USD',
  timezone: 'America/New_York',
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
};

export function makeAuthResponse(overrides: Partial<AuthResponse> = {}): AuthResponse {
  return {
    accessToken: 'access-token-1',
    refreshToken: 'refresh-token-1',
    tokenType: 'Bearer',
    expiresIn: 900000,
    user: testUser,
    organization: testOrganization,
    ...overrides,
  };
}

export function makeMembership(
  overrides: Partial<MembershipResponse> = {},
): MembershipResponse {
  return {
    id: '33333333-3333-3333-3333-333333333333',
    userId: testUser.id,
    userEmail: testUser.email,
    userFirstName: testUser.firstName,
    userLastName: testUser.lastName,
    organizationId: testOrganization.id,
    organizationName: testOrganization.name,
    role: 'OWNER',
    createdAt: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

export function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

export interface MockRequest {
  method: string;
  path: string;
  url: string;
  headers: Headers;
  body: unknown;
  signal: AbortSignal | null | undefined;
}

export interface MockRoute {
  method?: string;
  path: string;
  handler: (request: MockRequest) => Response | Promise<Response>;
}

export function createFetchMock(routes: MockRoute[]) {
  return vi.fn(async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url =
      typeof input === 'string'
        ? input
        : input instanceof URL
          ? input.toString()
          : input.url;
    const method = (init?.method ?? 'GET').toUpperCase();
    const path = new URL(url, 'http://localhost').pathname;
    const route = routes.find(
      (candidate) =>
        (candidate.method ?? 'GET').toUpperCase() === method && candidate.path === path,
    );

    if (!route) {
      throw new Error(`Unexpected request: ${method} ${path}`);
    }

    let body: unknown = init?.body ?? null;
    if (typeof body === 'string') {
      try {
        body = JSON.parse(body);
      } catch {
        // Keep the raw string for handlers that do not send JSON.
      }
    }

    return route.handler({
      method,
      path,
      url,
      headers: new Headers(init?.headers),
      body,
      signal: init?.signal,
    });
  });
}
