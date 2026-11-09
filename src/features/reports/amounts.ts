import type { BalanceSheetResponse, ReportAmount } from './types';

// Journal amounts are DECIMAL(19,4). BigInt also preserves larger aggregate sums.
export function reportAmountUnits(value: ReportAmount): bigint | null {
  const match = /^([+-]?)(\d+)(?:\.(\d+))?(?:[eE]([+-]?\d+))?$/.exec(String(value));
  if (!match) return null;
  const fraction = match[3] ?? '';
  const shift = 4 + Number(match[4] ?? 0) - fraction.length;
  if (!Number.isSafeInteger(shift) || Math.abs(shift) > 100) return null;
  let units = BigInt(match[2] + fraction);
  if (shift < 0) {
    const divisor = 10n ** BigInt(-shift);
    if (units % divisor !== 0n) return null;
    units /= divisor;
  } else {
    units *= 10n ** BigInt(shift);
  }
  return match[1] === '-' ? -units : units;
}

export function reportTotalsBalance(debits: ReportAmount, credits: ReportAmount, difference: ReportAmount) {
  const debitUnits = reportAmountUnits(debits);
  const creditUnits = reportAmountUnits(credits);
  return debitUnits !== null && creditUnits !== null &&
    debitUnits === creditUnits && reportAmountUnits(difference) === 0n;
}

function amountFromUnits(units: bigint): string {
  const absolute = units < 0n ? -units : units;
  return `${units < 0n ? '-' : ''}${absolute / 10000n}.${String(absolute % 10000n).padStart(4, '0')}`;
}

// Derived only from the complete server totals, never from displayed account rows.
export function reconcileBalanceSheet(
  totals: Pick<BalanceSheetResponse, 'totalAssets' | 'totalLiabilities' | 'totalEquity'>,
) {
  const assets = reportAmountUnits(totals.totalAssets);
  const liabilities = reportAmountUnits(totals.totalLiabilities);
  const equity = reportAmountUnits(totals.totalEquity);
  if (assets === null || liabilities === null || equity === null) return null;
  const rightSide = liabilities + equity;
  return {
    liabilitiesAndEquity: amountFromUnits(rightSide),
    difference: amountFromUnits(assets - rightSide),
    balanced: assets === rightSide,
  };
}
