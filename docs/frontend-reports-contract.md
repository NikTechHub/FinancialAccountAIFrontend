# Financial report API contracts

Verified against `/Users/nikhilsolanki/accounting-backend` source on 2026-11-08.
Frontend routes: `/reports/general-ledger` and `/reports/trial-balance`.
Also integrated: `/reports/profit-and-loss` and `/reports/balance-sheet` (Prompt 11).

## Source of truth

- `report/ReportController.java`: required parameters and ledger page default.
- `report/ReportService.java`: date validation, membership scope, account authorization,
  complete trial totals, normal-balance calculations.
- `report/ReportRepository.java`: POSTED-only queries, inclusive dates, ordering,
  activity-only accounts, no active-account predicate on reports.
- `report/dto/GeneralLedgerLine.java`, `TrialBalanceLine.java`, `TrialBalanceResponse.java`:
  response fields below.
- `controller/AccountController.java`, `service/AccountService.java`,
  `repository/AccountRepository.java`, `dto/AccountResponse.java`: account choices.
- `entity/JournalEntryLine.java`: persisted amounts have precision 19, scale 4.
- `config/SecurityConfig.java`: authentication required; report reads have no role restriction.

Paths above are relative to `src/main/java/com/example/accounting/` in the backend.
No backend files were changed.

## Requests

| Endpoint | Required query parameters | Optional parameters and defaults |
| --- | --- | --- |
| `GET /api/v1/reports/general-ledger` | `accountId` (UUID), `fromDate`, `toDate` | `page=0` (zero-based), `size=20` |
| `GET /api/v1/reports/trial-balance` | `fromDate`, `toDate` | None; no pagination or as-of parameter |
| `GET /api/v1/accounts` | None | `search`, `type`, `parentAccountId`, `page=0`, `size=20`, Spring entity `sort` |

Dates are ISO `YYYY-MM-DD` LocalDate values, inclusive at both ends, without timezone
conversion. The backend has **no default dates**. Missing/malformed dates or reversed
ranges fail validation. The UI chooses year-to-date using the existing organization
timezone convention; this is a frontend default. Edited dates are drafts until
**Apply dates**; invalid dates never trigger report requests. Retry keeps the applied
account, dates and page. **Year to date** applies immediately.

Spring's Pageable resolver accepts `sort`, but the ledger repository ignores it:
actual order is `entryDate ASC, entryNumber ASC, journal line id ASC`. The UI sends
no ledger sort and exposes no misleading sort control. Trial rows are ordered by
account code ascending. The installed Spring Data 3.4.4 resolver defaults to zero-based
pages and a maximum page size of 2000; no repository configuration overrides these.
The frontend offers ledger sizes 10, 20 and 50.

## Responses and accounting meaning

General Ledger returns Spring `Page<GeneralLedgerLine>`:

- Metadata: `number`, `size`, `totalElements`, `totalPages`, `numberOfElements`,
  `first`, `last`, `empty`, optional `sort`/`pageable` serialization metadata, and `content`.
- Each line: `journalEntryId`, `entryNumber`, `entryDate`, `description`, `reference`,
  `accountId`, `accountCode`, `accountName`, `lineDescription`, `debitAmount`, `creditAmount`.
- Descriptions/reference can be null; the UI displays an em dash for absence.
- No running balance, opening balance, line identifier, or overall ledger totals are
  supplied. The frontend invents none and never labels page sums as report totals.
- Entry numbers link to the existing Journal Entries detail route using `entryId`.
  Account code/name in the selection come from the real accounts response.

Trial Balance returns one complete, unpaginated object:

- `fromDate`, `toDate`, `lines`, `totalDebits`, `totalCredits`, `totalDifference`.
- Each line: `accountId`, `accountCode`, `accountName`, `accountType`, `debitTotal`,
  `creditTotal`, `netBalance`.
- Debit and credit columns are **gross POSTED activity in the range**, not net balances
  split into debit/credit columns. Draft and void journals are excluded.
- `netBalance` is supplied by the server: debits minus credits for ASSET/EXPENSE;
  credits minus debits for LIABILITY/EQUITY/REVENUE.
- Only accounts with posted activity appear. Inactive accounts with activity are included;
  zero-activity accounts are absent. No opening balances are included.
- Totals and difference (debits minus credits) are calculated with backend BigDecimal
  over the complete returned dataset. The frontend displays these unchanged, without
  summing rows. A Balanced badge requires activity, equal complete debit/credit totals,
  and a zero difference, compared exactly. Empty reports say No activity.

## Organization and currency limitations

Both reports scope queries to **all organizations in the authenticated user's memberships**.
There is no organization query parameter or tenant header. General Ledger additionally
validates the selected account belongs to that membership set; unknown/foreign accounts
return 404. Its account selector follows the existing app's current organization, filtering
the real `organizationId` client-side, so its displayed currency is that organization's currency.

Trial Balance cannot be filtered to the current organization. Its lines do not include
organization or currency fields, and its totals have no currency conversion. The screen
discloses this scope and omits an inferred currency label. For memberships spanning
different currencies, backend totals are not a single-currency consolidated balance.
The frontend cannot repair this backend limitation.

`GET /accounts` lists active accounts across accessible memberships. The selector loads
all pages in batches of 200 with `sort=code,asc`, filters to the current organization and
deduplicates IDs. Inactive historical accounts cannot be discovered through this list,
although the ledger endpoint itself accepts an authorized inactive account ID. This
selector limitation is disclosed. A 100-page safety cap or premature empty page fails
the lookup instead of silently returning a partial account list.

## Frontend safeguards

Existing shared API client supplies authentication, refresh/replay, abort signals and
HTTP errors. No credentials or tenant headers are added. Report reads request raw text
through that client so monetary JSON tokens can be preserved as decimal strings before
JavaScript number coercion loses precision. Pagination remains numeric. Report-scoped
schema checks reject missing/malformed data instead of displaying invented zero amounts.
BigInt units at scale four provide exact amount formatting and total comparison, with
no dependency additions or shared API parser changes.

Loading clears old rows/totals. Effect cleanup aborts obsolete requests and ignores late
responses even when transport cancellation is ineffective. Errors have retry actions;
401 explains session expiry and 403 explains the permission failure. Failed requests
never fall back to mock transactions or balances. Existing tables, selectors, date form,
breadcrumbs, sidebar and navbar are retained; wide tables scroll within their cards.

## Prompt 10 verification

Report tests cover API mapping, exact decimal JSON tokens, metadata, required dates,
account pagination, fixed sorting, applied versus draft filters, page navigation/size,
loading/empty/error/retry, 401/403, malformed data, nullable descriptions, complete
server totals, membership scope, and stale responses after account/date changes.
Dates are fixed in screen tests, and deferred responses use deterministic promises.

Commands: `npx vitest run src/features/reports --maxWorkers=1`,
`npx vitest run --maxWorkers=1`, `npm run lint`, `npx tsc --noEmit`, `npm run build`.
Results: focused reports **45/45 passed** (5 files); full suite **291/291 passed**
(41 files, one worker). Lint, TypeScript and production build passed. Build warnings
were limited to stale baseline-browser-mapping data and large application chunks.
The full suite includes Chart of Accounts and Journal Entries management/API tests.

Live verification was unavailable: no backend listener was present, and a read-only
request to `localhost:8080` failed to connect. No authenticated browser session was
available through the provided tools. Populated values, live empty/error states,
browser console/network and rendered responsive layout therefore remain unverified.
No transactions, credentials, database records or backend changes were created.

## Prompt 10 files changed

Existing report integration files updated (all under `src/features/reports/`):

- `api.ts`, `types.ts`, `display.ts`
- `GeneralLedgerPage.tsx`, `GeneralLedgerTable.tsx`
- `TrialBalancePage.tsx`, `TrialBalanceTable.tsx`
- `api.test.ts`, `display.test.ts`
- `GeneralLedgerPage.test.tsx`, `TrialBalancePage.test.tsx`

Added `src/features/reports/amounts.ts`, `src/features/reports/response.ts`, and this
contract document. Existing report hooks, date helpers/form, errors and view wrappers
were inspected and retained. Pre-existing uncommitted journal, invoice, router and
sidebar work was preserved.

## Profit & Loss and Balance Sheet (Prompt 11)

Reverified against the same backend source on 2026-11-08:
`ReportController`, `ReportService.getProfitAndLoss/getBalanceSheet`,
`ReportRepository.accountTotalsInRange/accountTotalsAsOf`, and DTOs
`ProfitAndLossLine`, `ProfitAndLossResponse`, `BalanceSheetLine`, `BalanceSheetResponse`.

### Endpoints and response fields

| Endpoint | Required parameters | Defaults / optional features |
| --- | --- | --- |
| `GET /api/v1/reports/profit-and-loss` | `fromDate`, `toDate` | No default dates; no pagination, sorting, organization, account or currency filters |
| `GET /api/v1/reports/balance-sheet` | `asOfDate` | No default date; no pagination, sorting, organization, account or currency filters |

All dates are ISO `YYYY-MM-DD` LocalDate values. Profit & Loss includes both endpoints
of its range. Balance Sheet includes **all posted journal lines on or before** the
as-of date; it has no start date. There is no timezone conversion in the queries.
The frontend uses organization-local year-to-date / today as its initial filters,
with the same timezone helper as General Ledger and Trial Balance. Draft edits do
not issue requests. Apply validates and commits; Year to date / Today reset and
apply immediately. Applying an unchanged filter refreshes the report. A failed
request retries its applied filter without overwriting pending date edits.

Profit & Loss returns a complete, unpaginated object:

- `fromDate`, `toDate`
- `revenueLines`, `expenseLines`: each has `accountId`, `accountCode`, `accountName`, `amount`
- `totalRevenue`, `totalExpenses`, `netProfit`

Revenue accounts use credits minus debits; expense accounts use debits minus credits.
The service sums each group using BigDecimal and calculates `netProfit = totalRevenue
− totalExpenses`. The UI displays these server totals unchanged. Profit/loss/break-even
labels reflect the sign of the reported net profit when account activity exists.
No prior-period comparisons or trends are available. This report uses **POSTED journal
entries**, including manual journals, not a sum of invoice or expense feature records.
It therefore captures accounting expenses beyond the Expenses screen without counting
both source records and their journals.

Balance Sheet returns a complete, unpaginated object:

- `asOfDate`
- `assetLines`, `liabilityLines`, `equityLines`: each has `accountId`, `accountCode`,
  `accountName`, `accountType` (ASSET, LIABILITY or EQUITY respectively), `balance`
- `totalAssets`, `totalLiabilities`, `totalEquity`

Asset balances are debits minus credits; liability/equity balances are credits minus
debits. Negative balances are retained and displayed with the same minus-sign and
2–4 decimal formatting used in other reports. Group totals are supplied by the server
and displayed unchanged. All account rows are rendered; no page or subset sums are
used as overall totals. Account codes sort ascending within each backend group.

### Reconciliation and accounting limitations

The backend supplies no balance-sheet difference or balanced flag. The frontend derives
only `totalLiabilities + totalEquity` and `totalAssets − totalLiabilities − totalEquity`
using exact BigInt scale-four units from the **complete server totals**. It labels a
nonempty report Balanced only when that exact difference is zero. A nonzero difference
is shown as Discrepancy with its signed amount. Empty reports show No activity instead
of a balanced or profit conclusion. Missing/invalid amounts never become zero.

The backend **does not add retained earnings or current-period profit to equity and
does not apply closing logic**. Equity is the balance of EQUITY-type accounts only.
No synthetic opening balances or current/noncurrent classifications are supplied.
Amounts from persisted closing/opening journal entries, if any, follow the ordinary
posted-journal query; the frontend adds none. Unclosed income can therefore cause
the balance sheet not to reconcile. The screen explains this limitation and displays
the actual figures without adjusting equity or account balances.

Both reports exclude DRAFT/VOID journals, omit accounts with no relevant posted activity,
and include inactive accounts with such activity. Accounts with activity that nets to
zero can still appear. They aggregate across **every organization in the user's validated
memberships**, without accepting a tenant header or organization parameter. Lines have
no organization/currency fields and there is no currency conversion. Both screens
disclose this scope and display unlabeled amounts; cross-currency totals are not a
single-currency consolidation. Authentication is required; authenticated VIEWER members
can read both reports. Backend report-view auditing may occur on GET; no financial
records are created or changed by these requests.

### Implementation and preservation

The existing authenticated client, lossless report JSON parser, decimal formatting,
date validation, UI tables/cards/badges, breadcrumbs and error mapping are reused.
Required date/array/amount fields and balance-sheet account classifications are checked
at the response boundary. No data is fabricated for a partial or malformed response.
Server totals are not replaced with row sums. Obsolete requests are aborted; late
successes or failures cannot replace a newer request, even if cancellation is ignored.
Loading/error states clear report rows and totals. Retries retain applied parameters.
401/403 use the established session-expired and permission messages. Tables scroll
within their cards, while summary values and account names wrap.

Added under `src/features/reports/`:

- `ProfitAndLossPage.tsx`, `BalanceSheetPage.tsx`
- `FinancialReportParts.tsx`, `ReportAsOfDateForm.tsx`, `useReportRequest.ts`
- `financialReports.api.test.ts`, `financialReports.test.tsx`, `financialReports.navigation.test.tsx`

Added `src/views/reports/ProfitAndLoss.tsx`, `src/views/reports/BalanceSheet.tsx` and
`src/test/financial-report-fixtures.ts`. Extended existing `api.ts`, `types.ts`,
`response.ts`, `amounts.ts`, `dates.ts`, `errors.ts`, the protected route tree in
`src/routes/Router.tsx`, and the existing Accounting sidebar in
`src/layouts/full/vertical/sidebar/sidebaritems.ts`. This document was updated.
No backend, dashboard, invoice, expense, account or journal behavior was changed;
earlier uncommitted integrations remain intact. No dependencies were added.

### Prompt 11 verification

Focused tests exercise API queries/mapping/auth, exact numeric JSON decimals, signed
amounts, invalid/missing values, date validation, complete server totals, reconciliation,
loading/empty/error/retry, stale successes/failures, scope/currency disclosures, and
real protected-route/lazy-view navigation. Screens use a fixed clock and deferred
promises rather than timing sleeps.

Verified results:

| Check | Result |
| --- | --- |
| Focused `financialReports.api.test.ts`, `financialReports.test.tsx`, `financialReports.navigation.test.tsx` with `--maxWorkers=1` | **76 passed**, 3 files |
| Full `npx vitest run --maxWorkers=1` | **367 passed**, 44 files |
| `npm run lint` | Passed, no warnings |
| `npx tsc --noEmit` | Passed |
| `npm run build` | Passed |

The build reports warnings for stale baseline-browser-mapping data and application
chunks above 500 kB. No dependency or unrelated bundle changes were made. The full
suite includes dashboard, General Ledger, Trial Balance, Chart of Accounts, Journal
Entries, invoice and expense regression coverage; all passed. Existing financial
screens are verified by automated tests, not by a live browser session.

Live verification is currently unavailable: a read-only request to
`localhost:8080/api/v1/reports/balance-sheet?asOfDate=2026-11-08` failed to connect
(HTTP status 000), and no browser/session tool is exposed. No authenticated live API
values, populated or empty organization data, financial reconciliation, live error
states, browser console/network, or rendered responsive layout have been verified.
No credentials were guessed and no financial records were created to populate reports.
