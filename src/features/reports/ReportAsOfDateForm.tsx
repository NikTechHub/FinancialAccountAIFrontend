import { Button } from 'src/components/ui/button';
import { Input } from 'src/components/ui/input';
import { Label } from 'src/components/ui/label';

export function ReportAsOfDateForm({ value, error, onChange, onApply, onToday }: {
  value: string;
  error: string | null;
  onChange: (value: string) => void;
  onApply: () => void;
  onToday: () => void;
}) {
  return (
    <form aria-label="Report as-of date" className="border-t border-border p-4 dark:border-white/10"
      onSubmit={(event) => { event.preventDefault(); onApply(); }}>
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end">
        <div className="w-full lg:max-w-[190px]">
          <Label htmlFor="report-as-of-date">As-of date</Label>
          <Input id="report-as-of-date" type="date" className="mt-1" value={value}
            aria-invalid={Boolean(error)} aria-describedby={error ? 'report-as-of-error' : undefined}
            onChange={(event) => onChange(event.target.value)} />
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="submit" variant="outline">Apply date</Button>
          <Button type="button" variant="ghost" onClick={onToday}>Today</Button>
        </div>
      </div>
      {error && <p id="report-as-of-error" className="mt-2 text-sm text-error">{error}</p>}
    </form>
  );
}
