# Frontend Integration Plan

Status: planning only. No accounting pages have been implemented yet.
Scope: integrate the existing TailwindAdmin React frontend with the existing Spring Boot accounting backend.
Target frontend: `/Users/nikhilsolanki/Downloads/AccountingAiFrontend`
Backend reference: `/Users/nikhilsolanki/accounting-backend`

## 1. Executive Summary

The frontend is a working TailwindAdmin demo, not an accounting application. It has a modern dashboard, authentication screens, a generic table, form elements, notes, tickets, blog demo pages, and a user-profile page. It has no API client, authentication provider, route guard, environment configuration, or accounting domain code.

The backend exposes all required business domains under `/api/v1`, but two contract limitations materially affect the UI:

1. There is no organization list or organization-switching contract. Authentication returns one "primary" organization, reads aggregate across all of the user's organizations, and writes go to the first membership. The UI must initially be single-organization and must not invent an organization header or selector.
2. Several UI concepts cannot be backed by the current API: monthly dashboard trends, invoice payment recording, and automatic creation of an invoice or expense from an approved document review.

Recommended approach:

- Preserve the existing visual system, layouts, CardBox, UI primitives, charts, and Tailwind styling.
- Add an accounting application shell and a typed API/auth layer.
- Reuse the dashboard, table, form, modal, badge, and ticket/status patterns rather than redesigning.
- Keep demo routes available but hidden from the accounting navigation.
- Use only endpoints that exist. Show truthful empty/limited states where the API lacks data.
- Use a single active organization from the login/register response until the backend provides organization selection.

## 2. Current Frontend Baseline

### 2.1 Stack and tooling

- React 19.2, TypeScript 5.5, Vite 7.
- React Router 7 imported from `react-router`.
- Tailwind CSS 4 with shadcn-style components in `src/components/ui`.
- Radix UI primitives, `@tanstack/react-table`, ApexCharts via `react-apexcharts`, lucide, Tabler, Iconify.
- `date-fns`, `moment`, `lodash`, `uuid`, `i18next`, `react-i18next`.
- `msw` is installed but not configured or used.
- Node 24.20.0, npm 11.19.0.
- No git repository in the frontend directory.

Commands:

```bash
npm run dev
npm run build        # tsc && vite build
npm run lint         # currently fails for configuration reasons
npm run preview
```

### 2.2 Current routes

Real routes in `src/routes/Router.tsx`:

| Path | Current page |
| --- | --- |
| `/` | Modern dashboard |
| `/apps/notes` | Notes demo |
| `/utilities/form` | Form element showcase |
| `/utilities/table` | Table demos |
| `/apps/tickets` | Ticket list demo |
| `/apps/tickets/create` | Create ticket demo |
| `/apps/blog/post` | Blog demo |
| `/apps/blog/detail/:id` | Blog detail demo |
| `/user-profile` | User profile demo |
| `/icons/iconify` | Icon showcase |
| `/auth/auth2/login` | Login |
| `/auth/auth2/register` | Register |
| `/auth/maintenance` | Maintenance |
| `/auth/404` | Error page |

Many sidebar entries are Pro/demo placeholders using `#!` and have no route. The router has no authentication guard.

### 2.3 Layout and navigation

- `src/layouts/full/FullLayout.tsx`: sidebar, sticky header, content container.
- `src/layouts/blank/BlankLayout.tsx`: auth/error pages.
- `src/layouts/full/vertical/sidebar/sidebaritems.ts`: 1,297 lines of mixed demo/Pro navigation.
- `src/layouts/full/vertical/sidebar/Sidebar.tsx`: renders sections with `tailwind-sidebar`.
- Header includes static search, notifications, theme toggle, and profile dropdown.
- Header profile links to `/user-profile`, `/apps/Notes`, and `/apps/blog/post`; logout is only a link to the login page.
- Theme is stored in `localStorage` under `vite-ui-theme`; this is the only current storage usage.

### 2.4 Reusable UI inventory

| Concern | Existing files |
| --- | --- |
| Page shell/cards | `src/components/shared/CardBox.tsx`, `src/layouts/full/shared/breadcrumb/BreadcrumbComp.tsx` |
| Dashboard | `src/views/dashboards/Modern.tsx`, `src/components/dashboards/modern/*` |
| Auth pages | `src/views/authentication/auth2/Login.tsx`, `Register.tsx`, `src/views/authentication/authforms/AuthLogin.tsx`, `AuthRegister.tsx`, `SocialButtons.tsx` |
| Generic table | `src/components/utilities/table/DataTable.tsx` |
| List/filter/status pattern | `src/components/apps/tickets/TicketListing.tsx`, `TicketFilter.tsx` |
| Create/upload modal pattern | `src/components/apps/tickets/CreateTicketForm.tsx`, `src/components/apps/notes/AddNotes.tsx` |
| Form controls | `src/views/utilities/form/Form.tsx`, `src/components/ui/input.tsx`, `select.tsx`, `textarea.tsx`, `checkbox.tsx`, `switch.tsx`, `calendar.tsx`, `dialog.tsx`, `sheet.tsx` |
| Charts | ApexCharts wrappers in `src/components/dashboards/modern/*` |
| Profile/edit dialog | `src/views/pages/user-profile/UserProfile.tsx` |
| Notes editor | `src/components/apps/notes/*` |
| Client-side demo contexts | `src/context/ticket-context`, `notes-context`, `blog-context` |

### 2.5 Current API/auth state

- No `fetch`, `axios`, XMLHttpRequest, bearer token, or environment-variable usage in `src`.
- No `AuthContext`, protected route, or API error handling.
- Login/register forms are static. "Sign in" and social links only navigate.
- `SocialButtons` offers Google/Facebook links that do not perform OAuth.
- Demo data lives in `src/api/blog`, `src/api/notes`, and `src/api/ticket`; contexts mutate in-memory arrays.
- `msw` is unused.

## 3. Backend Contract Snapshot

### 3.1 Runtime

- Base path: `/api/v1`.
- Local backend port: `8080`.
- JWT access token and rotating refresh token.
- Access token lifetime defaults to 15 minutes; refresh token defaults to 7 days.
- `AuthResponse.expiresIn` is expressed in milliseconds by the backend; the frontend must not treat it as seconds.
- Stateless API, `Authorization: Bearer <token>`.
- CORS is disabled unless `APP_CORS_ALLOWED_ORIGINS` lists exact origins. Wildcards are rejected.
- Allowed CORS headers currently are `Authorization`, `Content-Type`, `Accept`, `X-Requested-With`.
- Upload limit defaults to 10 MB. Allowed files: PDF, JPEG, PNG, WebP.
- Errors use `ApiErrorResponse`: `timestamp`, `status`, `error`, `message`, `path`, optional `fieldErrors`.
- Paged endpoints return Spring `Page` JSON: `content`, `totalElements`, `totalPages`, `number` (zero-based), `size`, `first`, `last`, `numberOfElements`, `empty`, `sort`.
- Dates use ISO `LocalDate` (`yyyy-MM-dd`). IDs are UUID strings. Monetary values are JSON numbers backed by `BigDecimal`.

### 3.2 Authentication and organization limitation

Available calls:

| Method | Path | Notes |
| --- | --- | --- |
| POST | `/auth/register` | Requires first name, last name, email, password, organization name, legal name, business type, country, 3-letter currency, timezone. Creates user + organization + OWNER membership. |
| POST | `/auth/login` | Email/password. Returns user and the first organization membership, if any. |
| POST | `/auth/refresh` | Rotates refresh token. Returns user and first organization again. |

Missing or restricted:

- No logout or token-revocation endpoint.
- No `/users/me`, organization list, current-role endpoint, organization update, or organization switch.
- JWT contains only user ID, email, and token type. It contains no organization ID or role.
- Read/list services are scoped to all organizations the user belongs to.
- Create services use the first membership as the effective organization.
- The UI cannot reliably support multiple organizations or an organization switcher against this contract.

Initial decision: single-organization UI. Display the organization returned by login/register. Derive the current role by fetching that organization's member list and matching the logged-in user ID. Do not send an organization ID header.

### 3.3 Domain endpoints

#### Vendors

| Method | Path | Notes |
| --- | --- | --- |
| GET | `/vendors?search=&page=&size=&sort=` | Paged, all accessible organizations. |
| GET | `/vendors/{id}` | Tenant-scoped. |
| POST | `/vendors` | Creates in first organization. VIEWER denied. |
| PUT | `/vendors/{id}` | VIEWER denied. |
| DELETE | `/vendors/{id}` | Deactivates; OWNER/ADMIN only. |

Fields: `name`, `email`, `phone`, `address`, `taxIdentifier`, `paymentTerms`, `active`.

#### Customers

Same shape and lifecycle as vendors: `GET /customers`, `GET /customers/{id}`, `POST`, `PUT`, `DELETE` (deactivate). Fields: `name`, `email`, `phone`, `address`, `taxIdentifier`, `paymentTerms`, `active`.

#### Chart of accounts

| Method | Path | Notes |
| --- | --- | --- |
| GET | `/accounts?search=&type=&parentAccountId=&page=&size=&sort=` | Paged flat list. |
| GET | `/accounts/tree` | Full tree, no pagination. |
| GET | `/accounts/{id}` | Single account. |
| POST | `/accounts` | `code`, `name`, `type`, optional `parentAccountId`, `description`. |
| PUT | `/accounts/{id}` | Includes `active`. |
| DELETE | `/accounts/{id}` | Deactivates. |

`AccountType`: `ASSET`, `LIABILITY`, `EQUITY`, `REVENUE`, `EXPENSE`.

#### Journal entries

| Method | Path | Notes |
| --- | --- | --- |
| GET | `/journal-entries?status=&entryDate=&entryNumber=&reference=&page=&size=&sort=` | Paged. |
| GET | `/journal-entries/{id}` | Includes lines and totals. |
| POST | `/journal-entries` | Creates a draft. At least 2 lines. |
| PUT | `/journal-entries/{id}` | Updates a draft. |
| POST | `/journal-entries/{id}/post` | Posts a draft. |
| DELETE | `/journal-entries/{id}` | Voids the entry. |

`JournalEntryStatus`: `DRAFT`, `POSTED`, `VOID`.
Line fields: `accountId`, `description`, `debitAmount`, `creditAmount`.

#### Expenses

| Method | Path | Notes |
| --- | --- | --- |
| GET | `/expenses?status=&vendorId=&expenseAccountId=&expenseDate=&reference=&page=&size=&sort=` | Paged. |
| GET | `/expenses/{id}` | Includes names/codes and journal link. |
| POST | `/expenses` | Draft. Requires expense account, payment account, amount, date. |
| PUT | `/expenses/{id}` | Updates a draft. |
| POST | `/expenses/{id}/record` | Creates and posts the journal entry. |
| DELETE | `/expenses/{id}` | Voids a draft. |

`ExpenseStatus`: `DRAFT`, `RECORDED`, `VOID`.

#### Invoices

| Method | Path | Notes |
| --- | --- | --- |
| GET | `/invoices?status=&customerId=&invoiceNumber=&invoiceDate=&dueDate=&page=&size=&sort=` | Paged. |
| GET | `/invoices/{id}` | Includes lines and totals. |
| POST | `/invoices` | Draft invoice with at least one line. |
| PUT | `/invoices/{id}` | Updates the invoice. |
| POST | `/invoices/{id}/issue` | Issues the invoice and creates the accounting entry. |
| DELETE | `/invoices/{id}` | Voids the invoice. |

`InvoiceStatus`: `DRAFT`, `ISSUED`, `PARTIALLY_PAID`, `PAID`, `OVERDUE`, `VOID`.
Line fields: `description`, `quantity`, `unitPrice`, `taxRate` (0-100 percent), `discountAmount`, `revenueAccountId`.
Line validation: discount cannot exceed quantity x unit price.
There is no payment-recording endpoint. `amountPaid` and `balanceDue` cannot be updated through the current API.

#### Documents and processing

| Method | Path | Notes |
| --- | --- | --- |
| POST | `/documents` | Multipart: `file`, `documentType`, optional `invoiceId` XOR `expenseId`. |
| GET | `/documents?documentType=&status=&invoiceId=&expenseId=&originalFileName=&page=&size=&sort=` | Paged. |
| GET | `/documents/{id}` | Metadata. |
| GET | `/documents/{id}/download` | Authenticated binary download. Use a bearer-authenticated blob request. |
| DELETE | `/documents/{id}` | Deletes document and stored file. |
| POST | `/documents/{id}/ocr` | Returns 202 with operation info; processing is asynchronous. |
| GET | `/documents/{id}/ocr` | OCR status, text, page count, error. |
| POST | `/documents/{id}/extraction` | 202; requires completed OCR. |
| GET | `/documents/{id}/extraction` | Status, structured data, confidence, model, error. |
| POST | `/documents/{id}/review` | Creates review after extraction is `COMPLETED`. Idempotent. |
| GET | `/documents/{id}/review` | Review with original AI data and reviewed data. |
| PUT | `/documents/{id}/review` | Replaces reviewed `StructuredInvoiceExtraction`. |
| POST | `/documents/{id}/review/approve` | PENDING only; optional `reviewComment`. |
| POST | `/documents/{id}/review/reject` | PENDING only; optional `reviewComment`. |
| POST | `/documents/{id}/review/reopen` | REJECTED only. |

Document types: `INVOICE`, `RECEIPT`, `EXPENSE_RECEIPT`, `OTHER`.
Document statuses: `UPLOADED`, `PROCESSING`, `PROCESSED`, `FAILED`.
OCR/extraction statuses: `PENDING`, `PROCESSING`, `COMPLETED`, `FAILED`.
Review statuses: `PENDING`, `APPROVED`, `REJECTED`.

Approving a review records the approval only. It does not create an invoice or expense.

#### Reports

| Method | Path | Required parameters |
| --- | --- | --- |
| GET | `/reports/dashboard` | `fromDate`, `toDate` |
| GET | `/reports/trial-balance` | `fromDate`, `toDate` |
| GET | `/reports/general-ledger` | `accountId`, `fromDate`, `toDate`, pageable |
| GET | `/reports/profit-and-loss` | `fromDate`, `toDate` |
| GET | `/reports/balance-sheet` | `asOfDate` |
| GET | `/reports/expenses` | `fromDate`, `toDate`, optional `vendorId` |
| GET | `/reports/invoices` | `fromDate`, `toDate`, optional `customerId` |

`DashboardResponse` contains totals and counts only: revenue, expenses, net profit, invoiced, outstanding, customer/vendor/invoice/expense counts. It has no time series, trend, or top-entity data.

#### Assistant

| Method | Path | Notes |
| --- | --- | --- |
| POST | `/assistant/chat` | Body `{ "message": "..." }`; returns `answer`, `dataUsed`, `period`, `sources`. |

No streaming, conversation ID, or history endpoint.

#### Audit logs

| Method | Path | Notes |
| --- | --- | --- |
| GET | `/audit-logs?action=&resourceType=&resourceId=&actorUserId=&success=&fromDate=&toDate=&page=&size=&sort=` | Defaults to last 90 days. Read-only. |
| GET | `/audit-logs/{id}` | Includes before/after data and metadata. |

Access requires OWNER, ADMIN, or ACCOUNTANT; other roles receive 403.

#### Organizations and memberships

| Method | Path | Notes |
| --- | --- | --- |
| POST | `/organizations` | Any authenticated user; creator becomes OWNER. |
| GET | `/organizations/{id}` | Requires membership. |
| GET | `/organizations/{organizationId}/members` | Requires membership. |
| POST | `/organizations/{organizationId}/members` | OWNER/ADMIN only. Body requires an existing `userId` and role. |

No organization list, organization update, member removal, or user search/invite endpoint.

## 4. Screen-by-Screen Mapping

The target accounting UI contains the following 16 screens/areas.

| # | Screen | Existing UI to reuse | Backend | Required integration work |
| --- | --- | --- | --- | --- |
| 1 | Login and Register | `auth2/Login.tsx`, `Register.tsx`, `AuthLogin.tsx`, `AuthRegister.tsx`, `CardBox` | `POST /auth/login`, `/auth/register`, `/auth/refresh` | Replace static forms with submit/loading/error states. Add registration fields required by the backend. Hide social buttons unless OAuth is added. Add auth provider, token persistence, refresh, route guard, logout. |
| 2 | Dashboard | `views/dashboards/Modern.tsx` and dashboard components | `GET /reports/dashboard`; optionally recent invoices/expenses and audit logs | Map totals/counts to cards. Replace fake charts with real report data or limited metrics. Do not fabricate monthly series. Repurpose or simplify RevenueUpdate, YearlyBreakup, MonthlyEarning, RecentTransaction, and ProductPerformance. |
| 3 | Organization and members | `views/pages/user-profile/UserProfile.tsx`, edit dialog | `GET /organizations/{id}`, `GET/POST /organizations/{id}/members`, `POST /organizations` | Show current organization from auth. Add membership table and add-member dialog using user UUID. Add create-organization flow if desired. No switcher or update/remove actions. |
| 4 | Vendors | `DataTable`, form controls, ticket list patterns | Vendors CRUD | Build server-paged list with search and sort. Add create/edit form/dialog. Relabel delete as deactivate. Add active/inactive badge. |
| 5 | Customers | Same as vendors | Customers CRUD | Same pattern, with invoice/expense filters where useful. Relabel delete as deactivate. |
| 6 | Chart of accounts | `DataTable`, table primitives | Accounts list/tree/CRUD | Provide flat table and optional tree view. Add type/parent filters, create/edit dialog, deactivate action. Use `AccountType` labels. |
| 7 | Journal entries | `Form`, `DataTable`, dialog patterns | Journal entries CRUD/post/void | Build header form plus dynamic debit/credit line editor. Validate at least two lines and balanced totals. Add detail view, post confirmation, and void action. Use server filters. |
| 8 | Expenses | `Form`, `DataTable`, ticket status filters | Expenses CRUD/record/void | Build draft form with vendor and account selects, amount, date, description, reference. Add record and void actions. Show linked journal entry. |
| 9 | Invoices | `Form`, `DataTable` | Invoices CRUD/issue/void | Build invoice header and dynamic line editor with tax rate and discount. Show calculated totals. Add issue/void and detail view. Do not expose payment actions until an API exists. |
| 10 | Documents | `TicketListing`, `CreateTicketForm`, `AddNotes` dialog | Documents upload/list/get/download/delete | Build upload form with file validation, document type, and optional invoice/expense association. Add document list, metadata, authenticated download, and delete. |
| 11 | OCR status | Ticket filter cards, badges, timeline | OCR start/get | Add OCR action and status panel on document detail. Poll while PENDING/PROCESSING. Show text, page count, timestamps, and error. |
| 12 | AI extraction | Ticket detail/status patterns | Extraction start/get | Add extraction action after OCR completes. Poll status. Render structured data, confidence, model, and errors. Handle `Object` JSON defensively. |
| 13 | Human review | Form controls, dialog, ticket status pattern | Review create/get/update/approve/reject/reopen | Build editable reviewed-data form with provenance comparison. Enforce state-specific actions. Collect review comments. No automatic invoice/expense creation. |
| 14 | Reports | Dashboard charts, `DataTable`, form date controls | Report endpoints | Add report tabs or pages with date filters. Render trial balance, P&L, balance sheet, general ledger, expense summary, and invoice summary using real fields. Add empty/error states and optional CSV export. |
| 15 | AI assistant | `CardBox`, Notes layout, message-style markup | `POST /assistant/chat` | Build a single-turn chat panel with local message history, sample prompts, sources, period, and `dataUsed`. No persistence or streaming. |
| 16 | Audit logs | `TicketListing`, `DataTable`, status filters | Audit logs list/detail | Build a read-only server-paged table with action/resource/success/date filters. Add detail dialog with before/after JSON. Handle 403 for non-finance roles. |

## 5. Proposed Frontend Architecture

This is the implementation shape after the plan is approved. No files below are created yet.

### 5.1 API layer

Proposed files:

```text
src/lib/api/client.ts          # fetch wrapper, bearer token, refresh, errors
src/lib/api/query.ts           # query string and pageable helpers
src/lib/api/types.ts           # ApiErrorResponse, PageResponse, enums
src/lib/api/auth.ts
src/lib/api/organizations.ts
src/lib/api/vendors.ts
src/lib/api/customers.ts
src/lib/api/accounts.ts
src/lib/api/journal-entries.ts
src/lib/api/expenses.ts
src/lib/api/invoices.ts
src/lib/api/documents.ts
src/lib/api/reports.ts
src/lib/api/assistant.ts
src/lib/api/audit.ts
```

Rules:

- Use native `fetch`; do not add axios.
- Base URL from `VITE_API_BASE_URL`, default `/api/v1`.
- Attach `Authorization` for all accounting calls.
- Send JSON except document upload/download.
- Parse 204 as no content.
- Parse `ApiErrorResponse` into a typed client error with `status`, `message`, and `fieldErrors`.
- On 401, attempt one refresh with a single-flight promise, then retry the original request once.
- Never refresh the refresh request itself.
- Clear auth and redirect on refresh failure.
- Do not log tokens or full document contents.
- Use abort signals for unmount/polling cancellation.

### 5.2 Authentication

Proposed:

```text
src/features/auth/AuthProvider.tsx
src/features/auth/ProtectedRoute.tsx
src/features/auth/useAuth.ts
src/features/auth/token-storage.ts
```

State: access token, refresh token, user, primary organization, role.

Boot sequence:

1. Read tokens from storage.
2. If a refresh token exists, call `/auth/refresh` to obtain fresh user/organization and rotating tokens.
3. If refresh fails, clear storage and keep the user on the login screen.
4. Do not trust a stored organization object as authoritative.
5. Resolve the current role from the organization membership list by matching the authenticated user ID.

Storage: `localStorage` is the pragmatic choice for this stateless bearer-token API. Document the XSS tradeoff. A future backend change to httpOnly refresh cookies is preferable.

Logout: clear local tokens/state and navigate to login. No backend revocation endpoint exists.

### 5.3 Organization context

- Use only the organization from the auth response.
- Display its name/currency/timezone in the shell/profile area.
- Use `organization.currency` for `Intl.NumberFormat`.
- Do not add an organization selector or `X-Organization-Id`.
- Treat multi-organization behavior as a documented backend limitation.

### 5.4 Routing

- Keep `/auth/auth2/login` and `/auth/auth2/register` under `BlankLayout`.
- Guard all accounting routes under `FullLayout`.
- Add routes for dashboard, organizations, vendors, customers, accounts, journal entries, expenses, invoices, documents, document detail/processing/review, reports, assistant, and audit logs.
- Add an app-level 404 or redirect authenticated users to the dashboard.
- Keep existing demo routes available but remove demo/Pro entries from the accounting sidebar. Do not delete demo pages.
- Update the profile dropdown to show the current user and a real logout action.

### 5.5 Shared components

Create feature-level wrappers without breaking existing demos:

- `ServerDataTable`: TanStack Table in manual pagination/filtering/sorting mode, using existing table/input/button/select primitives.
- `PageHeader`: reuse BreadcrumbComp styling.
- `Money`: currency-aware formatting from the active organization.
- `StatusBadge`: centralized status-to-color mapping for each enum.
- `ConfirmDialog`: destructive/record/post/void confirmations.
- `AsyncState`: loading, empty, error, and retry states.
- `DateRangeFilter`: ISO date range with existing Popover/Calendar.
- `EntitySelect`: searchable vendor/customer/account selectors backed by paged APIs.
- `JsonBlock`: safe, read-only JSON display for review/audit data, with no `dangerouslySetInnerHTML`.

Do not modify the existing `DataTable` in a way that breaks its current demo usage.

### 5.6 Forms and validation

- Reuse controlled inputs and existing UI primitives; avoid adding a form library in the first integration pass.
- Centralize validation helpers for required fields, UUIDs, decimal amounts, dates, tax rate (0-100), and file constraints.
- Map backend `fieldErrors` to form fields.
- Preserve the template's visual form patterns.
- Use dialogs for small master-data edits and full pages for journal entries, invoices, documents, and review.

### 5.7 Server state and polling

- No global state library is required initially.
- Use feature hooks that own loading/error/data/page state.
- Use AbortController for list fetches.
- Poll OCR/extraction every 2-3 seconds while `PENDING`/`PROCESSING`, with backoff and a stop state on `COMPLETED`/`FAILED`.
- Cancel polling on unmount or document change.
- After mutations, invalidate/refetch the affected list and detail.
- Keep demo contexts isolated from accounting data.

### 5.8 Formatting and files

- Format money with the organization currency; never use floating-point arithmetic for invoice totals.
- Send money values as decimal strings or numbers accepted by the backend; display with two decimals.
- Treat backend dates as calendar dates, not timestamps, to avoid timezone shifts.
- Download documents with `fetch` plus bearer auth, then create an object URL; revoke the URL afterward.
- Validate file size (10 MB) and MIME/extension before upload.
- Upload with `FormData`; do not set `Content-Type` manually.

### 5.9 Environment and deployment

Development:

- Add Vite proxy `/api` -> `http://localhost:8080` to avoid CORS during local development.
- Default API base remains `/api/v1`.

Production:

- Set `VITE_API_BASE_URL` to the deployed API origin plus `/api/v1`, or use a reverse proxy.
- Configure `APP_CORS_ALLOWED_ORIGINS` with the exact frontend origin if the API is cross-origin.
- Keep SPA fallback for Netlify/Docker.
- Use HTTPS.

### 5.10 Testing and quality gates

Current state: no frontend test runner. `msw` is already installed but unused.

Recommended:

- Fix lint configuration first (ESLint 9 flat config, or pin a compatible ESLint version). This is pre-existing and unrelated to accounting integration.
- Add Vitest + React Testing Library as dev dependencies when implementation starts.
- Use the existing `msw` dependency for API mocks.
- Unit test the auth refresh flow, error parsing, pagination mapping, money/date formatting, and review state transitions.
- Run `tsc`, `npm run build`, lint, and tests for each milestone.
- Perform manual role checks for OWNER/ADMIN/ACCOUNTANT/EMPLOYEE/VIEWER.
- Treat backend integration tests as the contract source of truth; frontend mocks must mirror the real DTOs.

## 6. Implementation Milestones

### Milestone 0: Baseline and integration scaffolding

- Fix lint configuration.
- Add environment typing and `.env.example`.
- Add Vite dev proxy.
- Add API client, typed errors, auth provider, token refresh, protected routing.
- Update header/profile logout and show the current user.
- Exit criteria: login against the real backend works; refresh works; protected routes redirect; build and lint pass.

### Milestone 1: Shell, navigation, and shared components

- Replace demo sidebar entries with accounting navigation while keeping demo routes hidden.
- Add app routes and 404 behavior.
- Add `ServerDataTable`, status badges, money/date formatting, confirmation dialog, async states, entity selects.
- Exit criteria: one real paged list (vendors) renders server data and mutations refresh it.

### Milestone 2: Master data

- Organization profile and members.
- Vendors.
- Customers.
- Chart of accounts (flat table and tree).
- Role-aware actions.
- Exit criteria: CRUD/deactivate flows work with real APIs; 403 states are handled.

### Milestone 3: Accounting transactions

- Journal entries with balanced line editor, post/void.
- Expenses with record/void.
- Invoices with line items, totals, issue/void.
- Exit criteria: drafts can be created and posted/issued against the backend; filters and detail views work.

### Milestone 4: Document pipeline

- Document upload/list/detail/download/delete.
- OCR trigger and polling.
- Extraction trigger and polling.
- Review create/edit/approve/reject/reopen.
- Exit criteria: a PDF/image can move from upload to terminal processing state and review actions enforce backend state rules.

### Milestone 5: Dashboard, reports, assistant, audit

- Dashboard using real totals/counts.
- Report pages with date filters and line tables.
- Assistant chat panel.
- Audit log table and detail dialog.
- Exit criteria: no fabricated data; empty/limited states are explicit; role restrictions are visible.

### Milestone 6: Hardening

- Error boundary and consistent 401/403/404/500 handling.
- Accessibility pass on forms, dialogs, tables, and focus management.
- Responsive pass at mobile/tablet widths.
- Remove unused demo/pro navigation and assets only after confirming no live route depends on them.
- Bundle cleanup for the large chunks (`Modern`, `SolarIcon`, `avatar`, `FullLayout`).
- Tests and documentation.
- Exit criteria: build, lint, tests, and manual smoke checklist pass.

## 7. Backend Contract Questions and Gaps

### Blocking for the original full product scope

1. **Organization selection**: There is no organization list, current organization endpoint, or organization header/parameter. Reads aggregate all memberships; writes use the first membership. Either the backend adds organization context, or the frontend is explicitly single-organization. This plan assumes single-organization.
2. **Current user and role**: There is no `/users/me`. The login response has the user, but the role must be inferred from the membership list. A dedicated current-session endpoint with role and organization would remove guesswork.
3. **Invoice payments**: No endpoint records payments or updates `amountPaid`/`balanceDue`; `PARTIALLY_PAID`, `PAID`, and overdue transitions cannot be produced from the UI.
4. **Dashboard trends**: `/reports/dashboard` returns totals and counts only. The existing monthly earnings/expense chart and yearly breakup cannot be backed with real time-series data without new report fields or endpoints.
5. **Review outcome**: Approving a document review does not create an invoice, expense, or journal entry. Confirm whether the intended workflow stops at approval or a separate conversion flow is required.
6. **Recent activity**: The dashboard has no recent-activity endpoint. Audit logs are role-restricted and not a substitute for a general activity feed.

### Non-blocking but should be confirmed

7. Confirm `expiresIn` remains milliseconds; frontend will store/refresh based on the refresh token rather than relying on this field.
8. Confirm expected currency precision and rounding for report displays.
9. Confirm whether invoice `taxRate` is always percent (current validation is 0-100).
10. Confirm supported `sort` property names for each paged endpoint; frontend should send only fields exposed by the response DTO.
11. Confirm role permissions for each mutation, especially accounts, journal entries, expenses, invoices, and documents.
12. Confirm whether failed OCR/extraction can be retried through the same POST endpoints and what the UI should show.
13. Confirm whether document review is limited to invoice documents or applies to receipts/other types.
14. Confirm backend behavior for deleting an approved or processed document.
15. Confirm CORS and proxy strategy for each deployment environment.
16. Confirm whether any auth/logout revocation endpoint is planned.
17. Confirm how membership addition should find a user without a user-search/invite API.
18. Confirm whether multiple organizations are a supported near-term product requirement.

## 8. Build and Test Status

### Frontend

- `npm run build`: PASS. `tsc` and Vite production build complete successfully.
- Build warning: several chunks exceed 500 kB (`Modern` ~692 kB, `SolarIcon` ~915 kB), plus a stale `baseline-browser-mapping` data warning. These are pre-existing optimization issues, not integration failures.
- `npm run lint`: FAIL before any source changes. ESLint 9.39.1 cannot find `eslint.config.js`; the project still uses `.eslintrc.cjs`. Must be fixed before lint can be a quality gate.
- `npm test`: not available; no test script, no test files, no Vitest/Jest configuration.
- `node_modules` is installed. No dependency installation failure observed.
- No source files were modified during inspection. `dist/` was regenerated by the build.
- Directory is not a git repository, so change tracking must be handled separately.

### Backend

- Previous backend milestone: 565 tests passing on Java 21.
- Docker is unavailable on the machine, so the backend image and Compose stack have not been runtime-verified.
- Frontend integration should target a locally running backend on port 8080 with CORS or the Vite proxy enabled.

## 9. Risks and Mitigations

| Risk | Impact | Mitigation |
| --- | --- | --- |
| Organization model does not support switching | Wrong-organization writes in multi-org accounts; confusing data aggregation | Ship single-organization UI; document limitation; require backend contract change before adding a switcher. |
| Dashboard API lacks trends | Fake or misleading charts | Show real totals and limited states; remove or relabel unsupported charts. |
| Invoice payment API missing | Paid/overdue screens cannot be completed | Hide payment actions; display backend status/amounts as read-only; plan backend work separately. |
| Generic DataTable is client-side only | Cannot handle server pages/search/sort or row actions | Add a separate server-driven table wrapper; keep the demo table intact. |
| No frontend tests and broken lint | Regressions and style drift | Fix lint first; add Vitest/RTL + MSW; gate each milestone on build/lint/tests. |
| Token storage in localStorage | XSS could expose tokens | Avoid untrusted HTML, sanitize content, document risk, prefer httpOnly cookies later. |
| Role enforcement is spread across services | UI may show actions that return 403 | Centralize role checks in UI; handle 403 gracefully; verify each endpoint with each role. |
| CORS disabled by default | Browser calls fail during development/deployment | Vite proxy locally; exact `APP_CORS_ALLOWED_ORIGINS` in deployed environments. |
| Existing demo routes/sidebar are large and mixed | Navigation clutter and accidental breakage | Keep demo routes but hide them; replace only sidebar data and shell links. |
| Review approval does not create accounting records | Users may expect conversion to invoice/expense | Make the approval outcome explicit in UI; document the manual follow-up flow. |
| Large JS chunks | Slow initial dashboard load | Lazy routes already exist; optimize Iconify/Apex imports and manual chunks after functionality. |
| Date/timezone mismatches | Off-by-one invoice/expense dates | Treat `LocalDate` as calendar dates; do not convert through local time. |
| File upload constraints | User frustration and failed uploads | Validate 10 MB and PDF/JPEG/PNG/WebP client-side; show backend errors. |

## 10. Out of Scope

- Backend, database, Kafka, Redis, OCR, AI, or Docker changes.
- Organization switching until the backend supports it.
- Invoice payment recording until an API exists.
- Automatic invoice/expense creation from approved reviews.
- Social OAuth login.
- Redesigning the visual language or replacing the component library.
- Deleting demo pages or assets without separate approval.
- Production deployment execution.
- Data migration or seed-data generation.
