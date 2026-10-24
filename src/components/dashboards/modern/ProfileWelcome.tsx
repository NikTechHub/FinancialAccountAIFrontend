import supportImg from '../../../assets/images/dashboard/customer-support-img.png';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from 'src/components/ui/select';
import { useAuth } from 'src/features/auth/useAuth';
import { formatDateRange } from 'src/features/dashboard/formatters';
import {
  REPORT_PERIOD_OPTIONS,
  type PeriodId,
  type ReportPeriod,
} from 'src/features/dashboard/period';

interface ProfileWelcomeProps {
  period: ReportPeriod;
  onPeriodChange: (period: PeriodId) => void;
}

function initialsFor(firstName: string, lastName: string): string {
  return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase() || 'A';
}

function isPeriodId(value: string): value is PeriodId {
  return REPORT_PERIOD_OPTIONS.some((option) => option.id === value);
}

const ProfileWelcome = ({ period, onPeriodChange }: ProfileWelcomeProps) => {
  const { user, organization } = useAuth();
  const displayName = user?.firstName?.trim() || 'there';
  const initials = user ? initialsFor(user.firstName, user.lastName) : 'A';
  const organizationName = organization?.name ?? 'your organization';

  return (
    <div className="relative flex items-center justify-between gap-4 rounded-lg bg-lightsecondary p-6 lg:pr-48">
      <div className="flex min-w-0 items-start gap-3">
        <div className="flex h-[50px] w-[50px] shrink-0 items-center justify-center rounded-full bg-primary text-lg font-semibold text-white">
          {initials}
        </div>
        <div className="flex min-w-0 flex-col gap-1">
          <h5 className="card-title">Welcome back, {displayName} 👋</h5>
          <p className="break-words text-muted-foreground">
            {organizationName} · {formatDateRange(period.fromDate, period.toDate)}
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <span className="text-xs font-medium text-muted-foreground">Period</span>
            <Select
              value={period.id}
              onValueChange={(value) => {
                if (isPeriodId(value)) onPeriodChange(value);
              }}
            >
              <SelectTrigger
                aria-label="Reporting period"
                className="h-8 w-[155px] bg-white/70 dark:bg-white/10"
              >
                <SelectValue placeholder="Select period" />
              </SelectTrigger>
              <SelectContent>
                {REPORT_PERIOD_OPTIONS.map((option) => (
                  <SelectItem key={option.id} value={option.id}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      <div className="absolute bottom-0 right-8 hidden lg:block">
        <img src={supportImg} alt="support-img" width={145} height={95} />
      </div>
    </div>
  );
};

export default ProfileWelcome;
