# Frontend Authentication Contract

Verified from the Spring Boot backend source on 2026-10-19. This document records the
contract used by the implemented frontend authentication milestone.

Backend base path: `/api/v1`. Local backend: `http://localhost:8080`.

## Login

`POST /api/v1/auth/login`

Request:

```json
{
  "email": "user@example.com",
  "password": "password"
}
```

Response: `200 OK` with `AuthResponse`.

Errors: `400` validation failure, `401` invalid credentials or disabled user. Error body is
`ApiErrorResponse`.

## Registration

`POST /api/v1/auth/register`

Request:

```json
{
  "firstName": "Ada",
  "lastName": "Lovelace",
  "email": "ada@example.com",
  "password": "password",
  "organizationName": "Acme",
  "legalName": "Acme LLC",
  "businessType": "Services",
  "country": "US",
  "currency": "USD",
  "timezone": "America/New_York"
}
```

Constraints: password 8-100 characters; currency exactly 3 characters; other text fields
are non-blank. Registration creates the user, the organization, and an `OWNER` membership.

Response: `201 Created` with `AuthResponse`.

Errors: `400` validation failure, `409` duplicate user email or organization name.

## Refresh

`POST /api/v1/auth/refresh`

Request:

```json
{
  "refreshToken": "<refresh token>"
}
```

Response: `200 OK` with a new `AuthResponse`.

The backend rotates the refresh token: the submitted token is revoked and a new refresh
token is returned. The old token cannot be reused. Errors are `401` for invalid, expired,
revoked, or disabled-user tokens.

There is no logout or token-revocation endpoint. Logout must clear local state only.

## AuthResponse

```ts
interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  tokenType: string; // "Bearer"
  expiresIn: number; // access-token lifetime in milliseconds (default 900000)
  user: {
    id: string; // UUID
    firstName: string;
    lastName: string;
    email: string;
    active: boolean;
    createdAt: string; // ISO instant
    updatedAt: string; // ISO instant
  };
  organization: {
    id: string; // UUID
    name: string;
    legalName: string;
    businessType: string;
    country: string;
    currency: string; // ISO 4217, e.g. USD
    timezone: string;
    createdAt: string;
    updatedAt: string;
  } | null;
}
```

`organization` is the user's first membership. It can be `null` for a user with no
membership.

## Token contents

Access token claims: subject = user UUID, `email`, `type = "access"`, `jti`, issued-at,
expiration. No organization ID or role is embedded.

Refresh token claims: subject = user UUID, `type = "refresh"`, `jti`, issued-at,
expiration. The backend stores only a hash of the refresh token.

## Error response

```ts
interface ApiErrorResponse {
  timestamp: string;
  status: number;
  error: string;
  message: string;
  path: string;
  fieldErrors?: Record<string, string>;
}
```

## Authorization gaps relevant to the next milestone

- There is no `/users/me` endpoint. Use the `user` and `organization` returned by
  login/register/refresh.
- There is no current-role endpoint. To derive the current role, call
  `GET /organizations/{organizationId}/members`, find the entry whose `userId` matches the
  authenticated user, and read its `role` (`OWNER`, `ADMIN`, `ACCOUNTANT`, `EMPLOYEE`,
  `VIEWER`). The endpoint requires membership.
- There is no organization list or switcher. This frontend remains single-organization
  and must not send an invented organization header or ID.
- Reads are scoped across the user's organizations, while writes use the first membership.
  The UI should present the organization from the auth response as the active organization.

## Frontend implementation notes

- Access token: memory only, held by `src/lib/api/session.ts`.
- Refresh token: tab-scoped `sessionStorage` behind the `TokenStorage` interface in
  `src/lib/auth/token-storage.ts`. This avoids the cross-tab rotation race that shared
  `localStorage` would create, and limits persistence to the current tab. JavaScript can
  still read the token, so XSS remains a risk while the tab is open. The interface allows
  a future move to an HttpOnly refresh cookie.
- Startup: when a refresh token exists, the provider performs one refresh, then loads the
  organization membership. A failed refresh clears the local session and shows the login
  screen.
- Refresh: single-flight; concurrent 401 responses share one refresh. Eligible requests
  replay once with the new access token. A replayed 401 does not start another refresh,
  and 403 responses never trigger refresh.
- Role: fetched from `GET /organizations/{organizationId}/members` and matched by user ID.
  A missing membership or failed lookup leaves the role unset instead of granting access.
- Logout: clears memory and `sessionStorage`; no backend revocation call exists.
- `expiresIn` is currently informational. Refresh is triggered by a 401 rather than an
  expiry timer.
- A null `organization` renders a dedicated “Organization unavailable” state.

## Remaining limitations

1. Refresh tokens are visible to JavaScript while the tab is open (XSS exposure).
2. Sessions are not shared across tabs because the refresh token is tab-scoped.
3. There is no server-side logout or token revocation.
4. There is no organization list or switcher; the authenticated response's first
   organization remains the single active organization.
5. Production deployment still needs same-origin reverse-proxy routing or explicit CORS
   configuration.

## Backend verification note (2026-10-20)

Initial live smoke tests returned `500` for registration/login because the backend audit
insert failed on MySQL:

`Incorrect string value ... for column 'resource_id'` in `audit_logs`.

The cause was `audit/AuditLog.java` mapping its `UUID id` and `resourceId` to `CHAR(36)`
columns without `@JdbcTypeCode(SqlTypes.CHAR)`, unlike every other entity in the project.
The backend now applies that mapping to both fields and was recompiled and restarted.

Verified end to end through the Vite proxy:

- `POST /api/v1/auth/register` → `201`, user + organization + OWNER membership, audits written.
- `POST /api/v1/auth/login` → `200` with user/organization/tokens.
- `POST /api/v1/auth/refresh` → `200`, refresh token rotated; reusing the old token → `401`.
- `GET /api/v1/organizations/{id}/members` with the refreshed access token → `200`, OWNER
  matched to the authenticated user.
- Invalid login → `401 Invalid credentials`, with `LOGIN_FAILURE` audited.
- Invalid login fields → `400` plus `fieldErrors`.

The frontend still shows a generic server-error message for 5xx responses.
