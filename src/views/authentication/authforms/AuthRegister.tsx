import { useState, type ChangeEvent, type FormEvent } from 'react';
import { Navigate, useNavigate } from 'react-router';
import { Alert, AlertDescription } from 'src/components/ui/alert';
import { Button } from 'src/components/ui/button';
import { Input } from 'src/components/ui/input';
import { Label } from 'src/components/ui/label';
import { toFormError } from 'src/features/auth/form-errors';
import { useAuth } from 'src/features/auth/useAuth';
import { COUNTRY_OPTIONS, CURRENCY_OPTIONS, currencyForCountry } from 'src/features/organization/regional';

interface RegisterForm {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  organizationName: string;
  legalName: string;
  businessType: string;
  country: string;
  currency: string;
  timezone: string;
}

const requiredFields: Array<keyof RegisterForm> = [
  'firstName',
  'lastName',
  'email',
  'password',
  'organizationName',
  'legalName',
  'businessType',
  'country',
  'currency',
  'timezone',
];

function detectedTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch {
    return 'UTC';
  }
}

const AuthRegister = () => {
  const { register, status } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState<RegisterForm>(() => ({
    firstName: '',
    lastName: '',
    email: '',
    password: '',
    organizationName: '',
    legalName: '',
    businessType: '',
    country: '',
    currency: 'USD',
    timezone: detectedTimezone(),
  }));
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (status === 'authenticated') {
    return <Navigate to="/" replace />;
  }

  const updateField =
    (field: keyof RegisterForm) => (event: ChangeEvent<HTMLInputElement>) => {
      setForm((current) => ({ ...current, [field]: event.target.value }));
    };

  const fieldError = (field: keyof RegisterForm) =>
    fieldErrors[field] ? (
      <p className="mt-1 text-sm text-error">{fieldErrors[field]}</p>
    ) : null;

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isSubmitting) return;

    const trimmed = Object.fromEntries(
      requiredFields.map((field) => [field, form[field].trim()]),
    ) as Record<keyof RegisterForm, string>;

    if (requiredFields.some((field) => !trimmed[field])) {
      setError('Please complete all required fields.');
      return;
    }

    if (form.password.length < 8 || form.password.length > 100) {
      setFieldErrors({ password: 'Password must be between 8 and 100 characters.' });
      setError('Please review the highlighted fields.');
      return;
    }

    if (trimmed.currency.length !== 3) {
      setFieldErrors({ currency: 'Currency must be a three-letter code.' });
      setError('Please review the highlighted fields.');
      return;
    }

    setError(null);
    setFieldErrors({});
    setIsSubmitting(true);

    try {
      await register({
        firstName: trimmed.firstName,
        lastName: trimmed.lastName,
        email: trimmed.email,
        password: form.password,
        organizationName: trimmed.organizationName,
        legalName: trimmed.legalName,
        businessType: trimmed.businessType,
        country: trimmed.country,
        currency: trimmed.currency.toUpperCase(),
        timezone: trimmed.timezone,
      });
      navigate('/', { replace: true });
    } catch (submitError) {
      const formError = toFormError(
        submitError,
        'Registration failed. Please review your details and try again.',
      );
      setError(formError.message);
      setFieldErrors(formError.fieldErrors ?? {});
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <form className="mt-6" onSubmit={handleSubmit} noValidate>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-3">
          <div className="mb-4">
            <div className="mb-2 block">
              <Label htmlFor="firstName" className="font-semibold">
                First Name
              </Label>
            </div>
            <Input
              id="firstName"
              name="firstName"
              autoComplete="given-name"
              value={form.firstName}
              onChange={updateField('firstName')}
              variant={fieldErrors.firstName ? 'failure' : 'default'}
              required
            />
            {fieldError('firstName')}
          </div>
          <div className="mb-4">
            <div className="mb-2 block">
              <Label htmlFor="lastName" className="font-semibold">
                Last Name
              </Label>
            </div>
            <Input
              id="lastName"
              name="lastName"
              autoComplete="family-name"
              value={form.lastName}
              onChange={updateField('lastName')}
              variant={fieldErrors.lastName ? 'failure' : 'default'}
              required
            />
            {fieldError('lastName')}
          </div>
        </div>
        <div className="mb-4">
          <div className="mb-2 block">
            <Label htmlFor="emadd" className="font-semibold">
              Email Address
            </Label>
          </div>
          <Input
            id="emadd"
            name="email"
            type="email"
            autoComplete="email"
            value={form.email}
            onChange={updateField('email')}
            variant={fieldErrors.email ? 'failure' : 'default'}
            required
          />
          {fieldError('email')}
        </div>
        <div className="mb-6">
          <div className="mb-2 block">
            <Label htmlFor="userpwd" className="font-semibold">
              Password
            </Label>
          </div>
          <Input
            id="userpwd"
            name="password"
            type="password"
            autoComplete="new-password"
            value={form.password}
            onChange={updateField('password')}
            variant={fieldErrors.password ? 'failure' : 'default'}
            required
          />
          {fieldError('password')}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-3">
          <div className="mb-4">
            <div className="mb-2 block">
              <Label htmlFor="organizationName" className="font-semibold">
                Organization Name
              </Label>
            </div>
            <Input
              id="organizationName"
              name="organizationName"
              value={form.organizationName}
              onChange={updateField('organizationName')}
              placeholder="Acme"
              variant={fieldErrors.organizationName ? 'failure' : 'default'}
              required
            />
            {fieldError('organizationName')}
          </div>
          <div className="mb-4">
            <div className="mb-2 block">
              <Label htmlFor="legalName" className="font-semibold">
                Legal Name
              </Label>
            </div>
            <Input
              id="legalName"
              name="legalName"
              value={form.legalName}
              onChange={updateField('legalName')}
              placeholder="Acme LLC"
              variant={fieldErrors.legalName ? 'failure' : 'default'}
              required
            />
            {fieldError('legalName')}
          </div>
          <div className="mb-4">
            <div className="mb-2 block">
              <Label htmlFor="businessType" className="font-semibold">
                Business Type
              </Label>
            </div>
            <Input
              id="businessType"
              name="businessType"
              value={form.businessType}
              onChange={updateField('businessType')}
              placeholder="Services"
              variant={fieldErrors.businessType ? 'failure' : 'default'}
              required
            />
            {fieldError('businessType')}
          </div>
          <div className="mb-4">
            <div className="mb-2 block">
              <Label htmlFor="country" className="font-semibold">
                Country
              </Label>
            </div>
            <select
              id="country"
              name="country"
              value={form.country}
              onChange={(event) => {
                const country = event.target.value;
                setForm((current) => ({
                  ...current,
                  country,
                  currency: currencyForCountry(country) ?? current.currency,
                }));
              }}
              className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              aria-invalid={fieldErrors.country ? true : undefined}
              required
            >
              {COUNTRY_OPTIONS.map((option) => <option key={option.code} value={option.code}>{option.name}</option>)}
            </select>
            {fieldError('country')}
          </div>
          <div className="mb-4">
            <div className="mb-2 block">
              <Label htmlFor="currency" className="font-semibold">
                Currency
              </Label>
            </div>
            <select
              id="currency"
              name="currency"
              value={form.currency}
              onChange={(event) => setForm((current) => ({ ...current, currency: event.target.value }))}
              className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              aria-invalid={fieldErrors.currency ? true : undefined}
              required
            >
              {CURRENCY_OPTIONS.map((option) => <option key={option.code} value={option.code}>{option.name} ({option.code} · {option.symbol})</option>)}
            </select>
            {fieldError('currency')}
          </div>
          <div className="mb-4">
            <div className="mb-2 block">
              <Label htmlFor="timezone" className="font-semibold">
                Timezone
              </Label>
            </div>
            <Input
              id="timezone"
              name="timezone"
              value={form.timezone}
              onChange={updateField('timezone')}
              placeholder="America/New_York"
              variant={fieldErrors.timezone ? 'failure' : 'default'}
              required
            />
            {fieldError('timezone')}
          </div>
        </div>
        {error && (
          <Alert variant="lighterror" className="mb-4">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        <Button type="submit" className="w-full" disabled={isSubmitting}>
          {isSubmitting ? 'Creating account...' : 'Sign Up'}
        </Button>
      </form>
    </>
  );
};

export default AuthRegister;
