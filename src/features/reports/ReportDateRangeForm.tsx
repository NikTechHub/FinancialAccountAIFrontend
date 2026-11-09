import type { FormEvent } from 'react';
import { Button } from 'src/components/ui/button';
import { Input } from 'src/components/ui/input';
import { Label } from 'src/components/ui/label';

interface ReportDateRangeFormProps {
  fromDate: string;
  toDate: string;
  error: string | null;
  onFromDateChange: (value: string) => void;
  onToDateChange: (value: string) => void;
  onApply: () => void;
  onYearToDate: () => void;
}

export function ReportDateRangeForm({
  fromDate,
  toDate,
  error,
  onFromDateChange,
  onToDateChange,
  onApply,
  onYearToDate,
}: ReportDateRangeFormProps) {
  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onApply();
  }

  return (
    <form
      aria-label="Report date range"
      onSubmit={handleSubmit}
      className="border-t border-border p-4 dark:border-white/10"
    >
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end">
        <div className="w-full lg:max-w-[190px]">
          <Label htmlFor="report-from-date">From date</Label>
          <Input
            id="report-from-date"
            type="date"
            value={fromDate}
            onChange={(event) => onFromDateChange(event.target.value)}
            aria-invalid={Boolean(error)}
            aria-describedby={error ? 'report-date-error' : undefined}
            className="mt-1"
          />
        </div>

        <div className="w-full lg:max-w-[190px]">
          <Label htmlFor="report-to-date">To date</Label>
          <Input
            id="report-to-date"
            type="date"
            value={toDate}
            onChange={(event) => onToDateChange(event.target.value)}
            aria-invalid={Boolean(error)}
            aria-describedby={error ? 'report-date-error' : undefined}
            className="mt-1"
          />
        </div>

        <div className="flex flex-wrap gap-2">
          <Button type="submit" variant="outline">
            Apply dates
          </Button>
          <Button type="button" variant="ghost" onClick={onYearToDate}>
            Year to date
          </Button>
        </div>
      </div>

      {error && (
        <p id="report-date-error" className="mt-2 text-sm text-error">
          {error}
        </p>
      )}
    </form>
  );
}
