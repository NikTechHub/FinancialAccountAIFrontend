// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { makeInvoiceSummary } from 'src/test/dashboard-fixtures';
import { InvoiceSummaryCard } from './InvoiceSummaryCard';

afterEach(cleanup);

describe('InvoiceSummaryCard', () => {
  it('shows invoiced and outstanding amounts', () => {
    render(
      <InvoiceSummaryCard
        currency="USD"
        invoices={makeInvoiceSummary({
          invoiceCount: 4,
          totalInvoiced: 1000,
          totalOutstanding: 250,
        })}
      />,
    );

    expect(screen.getByText('Invoicing')).toBeTruthy();
    expect(screen.getByText('$1,000.00')).toBeTruthy();
    expect(screen.getByText('4 invoices issued')).toBeTruthy();
    expect(screen.getByText('25%')).toBeTruthy();
    expect(screen.getByText('$250 of $1K outstanding')).toBeTruthy();
  });

  it('shows an empty state when no invoices were issued', () => {
    render(<InvoiceSummaryCard currency="USD" invoices={makeInvoiceSummary()} />);

    expect(screen.getByText('No invoices issued in this period.')).toBeTruthy();
  });
});
