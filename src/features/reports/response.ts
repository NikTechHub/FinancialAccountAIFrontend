import { ApiError } from 'src/lib/api/client';
import type { PageResponse } from 'src/lib/api/types';
import { accountTypeMeta } from 'src/features/accounts/display';
import { reportAmountUnits } from './amounts';
import { validateReportAsOfDate, validateReportDateRange } from './dates';
import type { BalanceSheetResponse, GeneralLedgerLine, ProfitAndLossResponse, TrialBalanceResponse } from './types';

const amountFields = new Set([
  'debitAmount', 'creditAmount', 'debitTotal', 'creditTotal', 'netBalance',
  'totalDebits', 'totalCredits', 'totalDifference',
  'amount', 'balance', 'totalRevenue', 'totalExpenses', 'netProfit',
  'totalAssets', 'totalLiabilities', 'totalEquity',
]);

function invalidResponse(): never {
  throw new ApiError('The server returned an unexpected report response.', { kind: 'parse' });
}

function parseReport(text: string): unknown {
  try {
    // Consume whole JSON strings (including escaped quotes) so descriptions are
    // untouched. Quote only monetary number tokens before JSON.parse loses digits.
    const lossless = text.replace(
      /"(?:\\.|[^"\\])*"\s*:\s*(-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)|"(?:\\.|[^"\\])*"/g,
      (token, amount: string | undefined) => {
        if (amount === undefined) return token;
        const colon = token.lastIndexOf(':');
        const key = JSON.parse(token.slice(0, colon));
        return amountFields.has(key)
          ? `${token.slice(0, token.length - amount.length)}"${amount}"`
          : token;
      },
    );
    return JSON.parse(lossless);
  } catch {
    return invalidResponse();
  }
}

function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return invalidResponse();
  return value as Record<string, unknown>;
}

function strings(row: Record<string, unknown>, fields: string[], nullable = false) {
  for (const field of fields) {
    if (nullable && row[field] === null) continue;
    if (typeof row[field] !== 'string') invalidResponse();
  }
}

function amounts(row: Record<string, unknown>, fields: string[]) {
  for (const field of fields) {
    const value = row[field];
    if (typeof value !== 'string' || reportAmountUnits(value) === null) invalidResponse();
  }
}

function account(row: Record<string, unknown>) {
  strings(row, ['accountId', 'accountCode', 'accountName']);
}

export function parseGeneralLedger(text: string): PageResponse<GeneralLedgerLine> {
  const page = record(parseReport(text));
  if (!Array.isArray(page.content)) return invalidResponse();
  for (const field of ['number', 'size', 'totalPages', 'totalElements', 'numberOfElements']) {
    const value = page[field];
    if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0) invalidResponse();
  }
  if (page.size === 0) invalidResponse();
  for (const field of ['first', 'last', 'empty']) {
    if (typeof page[field] !== 'boolean') invalidResponse();
  }
  for (const value of page.content) {
    const line = record(value);
    account(line);
    strings(line, ['journalEntryId', 'entryNumber', 'entryDate']);
    if (validateReportDateRange(String(line.entryDate), String(line.entryDate))) invalidResponse();
    strings(line, ['description', 'reference', 'lineDescription'], true);
    amounts(line, ['debitAmount', 'creditAmount']);
  }
  return page as unknown as PageResponse<GeneralLedgerLine>;
}

export function parseTrialBalance(text: string): TrialBalanceResponse {
  const report = record(parseReport(text));
  strings(report, ['fromDate', 'toDate']);
  if (validateReportDateRange(String(report.fromDate), String(report.toDate))) invalidResponse();
  amounts(report, ['totalDebits', 'totalCredits', 'totalDifference']);
  if (!Array.isArray(report.lines)) return invalidResponse();
  for (const value of report.lines) {
    const line = record(value);
    account(line);
    if (typeof line.accountType !== 'string' || !Object.prototype.hasOwnProperty.call(accountTypeMeta, line.accountType)) {
      invalidResponse();
    }
    amounts(line, ['debitTotal', 'creditTotal', 'netBalance']);
  }
  return report as unknown as TrialBalanceResponse;
}

export function parseProfitAndLoss(text: string): ProfitAndLossResponse {
  const report = record(parseReport(text));
  strings(report, ['fromDate', 'toDate']);
  if (validateReportDateRange(String(report.fromDate), String(report.toDate))) invalidResponse();
  amounts(report, ['totalRevenue', 'totalExpenses', 'netProfit']);
  for (const field of ['revenueLines', 'expenseLines']) {
    const lines = report[field];
    if (!Array.isArray(lines)) return invalidResponse();
    for (const value of lines) {
      const line = record(value);
      account(line);
      amounts(line, ['amount']);
    }
  }
  return report as unknown as ProfitAndLossResponse;
}

export function parseBalanceSheet(text: string): BalanceSheetResponse {
  const report = record(parseReport(text));
  strings(report, ['asOfDate']);
  if (validateReportAsOfDate(String(report.asOfDate))) invalidResponse();
  amounts(report, ['totalAssets', 'totalLiabilities', 'totalEquity']);
  for (const [field, type] of [['assetLines', 'ASSET'], ['liabilityLines', 'LIABILITY'], ['equityLines', 'EQUITY']]) {
    const lines = report[field];
    if (!Array.isArray(lines)) return invalidResponse();
    for (const value of lines) {
      const line = record(value);
      account(line);
      if (line.accountType !== type) invalidResponse();
      amounts(line, ['balance']);
    }
  }
  return report as unknown as BalanceSheetResponse;
}
