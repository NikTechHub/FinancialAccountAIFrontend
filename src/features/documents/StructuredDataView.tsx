import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from 'src/components/ui/table';
import type { StructuredExtractionData, StructuredLineItem } from './types';
import { parseStructuredData } from './validation';

function formatMoney(value: number | null, currency: string | null) {
  if (value === null) return '—';
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency || 'USD',
    }).format(value);
  } catch {
    return `${currency ?? ''} ${value.toFixed(2)}`.trim();
  }
}

function formatNumber(value: number | null) {
  if (value === null) return '—';
  return new Intl.NumberFormat('en-US', { maximumFractionDigits: 4 }).format(value);
}

function value(value: string | number | null, fallback = '—') {
  if (value === null || value === '') return fallback;
  return String(value);
}

function DataField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </dt>
      <dd className="mt-1 break-words text-sm">{children}</dd>
    </div>
  );
}

function LineItemsTable({ items }: { items: StructuredLineItem[] }) {
  if (items.length === 0) {
    return <p className="text-sm text-muted-foreground">No line items extracted.</p>;
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-border dark:border-white/10">
      <Table aria-label="Extracted line items">
        <TableHeader>
          <TableRow>
            <TableHead className="min-w-[180px]">Description</TableHead>
            <TableHead className="text-right">Qty</TableHead>
            <TableHead className="text-right">Unit price</TableHead>
            <TableHead className="text-right">Tax rate</TableHead>
            <TableHead className="text-right">Tax</TableHead>
            <TableHead className="text-right">Discount</TableHead>
            <TableHead className="text-right">Line total</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((item, index) => (
            <TableRow key={`${item.description ?? 'line'}-${index}`}>
              <TableCell className="whitespace-normal">
                {value(item.description)}
              </TableCell>
              <TableCell className="text-right tabular-nums">
                {formatNumber(item.quantity)}
              </TableCell>
              <TableCell className="text-right tabular-nums">
                {formatNumber(item.unitPrice)}
              </TableCell>
              <TableCell className="text-right tabular-nums">
                {item.taxRate === null ? '—' : `${formatNumber(item.taxRate)}%`}
              </TableCell>
              <TableCell className="text-right tabular-nums">
                {formatNumber(item.taxAmount)}
              </TableCell>
              <TableCell className="text-right tabular-nums">
                {formatNumber(item.discountAmount)}
              </TableCell>
              <TableCell className="text-right font-medium tabular-nums">
                {formatNumber(item.lineTotal)}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

interface StructuredDataViewProps {
  data: unknown;
  label: string;
}

export function StructuredDataView({ data, label }: StructuredDataViewProps) {
  const parsed: StructuredExtractionData | null = parseStructuredData(data);

  if (!parsed) {
    return (
      <div>
        <p className="mb-2 text-sm text-muted-foreground">
          Structured data was not returned in a recognized format.
        </p>
        <pre className="max-h-72 overflow-auto whitespace-pre-wrap break-words rounded-lg bg-muted p-3 text-xs">
          {JSON.stringify(data, null, 2)}
        </pre>
      </div>
    );
  }

  return (
    <section aria-label={label} className="space-y-5">
      <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <DataField label="Document type">{value(parsed.documentType)}</DataField>
        <DataField label="Invoice number">{value(parsed.invoiceNumber)}</DataField>
        <DataField label="Currency">{value(parsed.currency)}</DataField>
        <DataField label="Invoice date">{value(parsed.invoiceDate)}</DataField>
        <DataField label="Due date">{value(parsed.dueDate)}</DataField>
        <DataField label="Payment terms">{value(parsed.paymentTerms)}</DataField>
        <DataField label="Vendor">{value(parsed.vendorName)}</DataField>
        <DataField label="Vendor tax ID">
          {value(parsed.vendorTaxIdentifier)}
        </DataField>
        <DataField label="Vendor contact">
          {value(parsed.vendorEmail ?? parsed.vendorPhone)}
        </DataField>
        <DataField label="Customer">{value(parsed.customerName)}</DataField>
        <DataField label="Customer tax ID">
          {value(parsed.customerTaxIdentifier)}
        </DataField>
        <DataField label="Subtotal">
          {formatMoney(parsed.subtotal, parsed.currency)}
        </DataField>
        <DataField label="Tax">{formatMoney(parsed.taxAmount, parsed.currency)}</DataField>
        <DataField label="Discount">
          {formatMoney(parsed.discountAmount, parsed.currency)}
        </DataField>
        <DataField label="Total">
          <span className="font-semibold">
            {formatMoney(parsed.totalAmount, parsed.currency)}
          </span>
        </DataField>
        <div className="sm:col-span-2 lg:col-span-3">
          <DataField label="Notes">{value(parsed.notes)}</DataField>
        </div>
      </dl>

      <div>
        <h4 className="mb-2 text-sm font-semibold">Line items</h4>
        <LineItemsTable items={parsed.lineItems} />
      </div>
    </section>
  );
}
