export const COUNTRY_OPTIONS = [
  { code: 'IN', name: 'India', defaultCurrency: 'INR' },
  { code: 'US', name: 'United States', defaultCurrency: 'USD' },
  { code: 'GB', name: 'United Kingdom', defaultCurrency: 'GBP' },
  { code: 'DE', name: 'Germany', defaultCurrency: 'EUR' },
  { code: 'AE', name: 'United Arab Emirates', defaultCurrency: 'AED' },
  { code: 'CA', name: 'Canada', defaultCurrency: 'CAD' },
  { code: 'AU', name: 'Australia', defaultCurrency: 'AUD' },
] as const;

export const CURRENCY_OPTIONS = [
  { code: 'INR', name: 'Indian Rupee', symbol: '₹' },
  { code: 'USD', name: 'US Dollar', symbol: '$' },
  { code: 'GBP', name: 'Pound Sterling', symbol: '£' },
  { code: 'EUR', name: 'Euro', symbol: '€' },
  { code: 'AED', name: 'UAE Dirham', symbol: 'د.إ' },
  { code: 'CAD', name: 'Canadian Dollar', symbol: 'CA$' },
  { code: 'AUD', name: 'Australian Dollar', symbol: 'A$' },
] as const;

export function currencyForCountry(countryCode: string): string | undefined {
  return COUNTRY_OPTIONS.find((country) => country.code === countryCode)?.defaultCurrency;
}

export function countryCodeForStoredValue(value: string): string | undefined {
  const normalized = value.trim().toUpperCase();
  if (COUNTRY_OPTIONS.some((country) => country.code === normalized)) return normalized;
  const legacyNames: Record<string, string> = {
    INDIA: 'IN',
    USA: 'US',
    'UNITED STATES': 'US',
    UK: 'GB',
    'UNITED KINGDOM': 'GB',
    GERMANY: 'DE',
    UAE: 'AE',
    'UNITED ARAB EMIRATES': 'AE',
    CANADA: 'CA',
    AUSTRALIA: 'AU',
  };
  return legacyNames[normalized];
}
