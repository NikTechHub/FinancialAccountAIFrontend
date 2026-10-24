import { customerApi, vendorApi } from './api';
import type { PartyPageConfig } from './types';

export const vendorConfig: PartyPageConfig = {
  labels: {
    singular: 'Vendor',
    plural: 'Vendors',
    lowerSingular: 'vendor',
    lowerPlural: 'vendors',
  },
  api: vendorApi,
  emptyDescription: 'Add a vendor to track the businesses you buy from.',
  searchPlaceholder: 'Search vendors by name',
  readOnlyMessage:
    'Your role could not be verified, so vendor changes are disabled. You can still view the list.',
};

export const customerConfig: PartyPageConfig = {
  labels: {
    singular: 'Customer',
    plural: 'Customers',
    lowerSingular: 'customer',
    lowerPlural: 'customers',
  },
  api: customerApi,
  emptyDescription: 'Add a customer to track the businesses you sell to.',
  searchPlaceholder: 'Search customers by name',
  readOnlyMessage:
    'Your role could not be verified, so customer changes are disabled. You can still view the list.',
};
