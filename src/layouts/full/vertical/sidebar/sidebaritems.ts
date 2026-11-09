export interface ChildItem {
  id?: number | string;
  name?: string;
  icon?: string;
  children?: ChildItem[];
  item?: unknown;
  url?: string;
  color?: string;
  disabled?: boolean;
  subtitle?: string;
  badge?: boolean;
  badgeType?: string;
  isPro?: boolean;
}

export interface MenuItem {
  heading?: string;
  name?: string;
  icon?: string;
  id?: number;
  to?: string;
  items?: MenuItem[];
  children?: ChildItem[];
  url?: string;
  disabled?: boolean;
  subtitle?: string;
  badgeType?: string;
  badge?: boolean;
  isPro?: boolean;
}

import { uniqueId } from 'lodash';

const SidebarContent: MenuItem[] = [
  {
    heading: 'Home',
    children: [
      {
        name: 'Dashboard',
        icon: 'solar:widget-2-linear',
        id: uniqueId(),
        url: '/',
      },
    ],
  },
  {
    heading: 'Accounting',
    children: [
      { id: uniqueId(), name: 'Vendors', icon: 'solar:shop-2-linear', url: '/vendors' },
      { id: uniqueId(), name: 'Customers', icon: 'solar:users-group-rounded-linear', url: '/customers' },
      { id: uniqueId(), name: 'Expenses', icon: 'solar:wallet-money-linear', url: '/expenses' },
      { id: uniqueId(), name: 'Invoices', icon: 'solar:bill-list-linear', url: '/invoices' },
      { id: uniqueId(), name: 'Chart of Accounts', icon: 'solar:notebook-linear', url: '/accounts' },
      { id: uniqueId(), name: 'Journal Entries', icon: 'solar:book-2-linear', url: '/journal-entries' },
      { id: uniqueId(), name: 'General Ledger', icon: 'solar:book-bookmark-linear', url: '/reports/general-ledger' },
      { id: uniqueId(), name: 'Trial Balance', icon: 'solar:scale-linear', url: '/reports/trial-balance' },
      { id: uniqueId(), name: 'Profit & Loss', icon: 'solar:chart-2-linear', url: '/reports/profit-and-loss' },
      { id: uniqueId(), name: 'Balance Sheet', icon: 'solar:clipboard-list-linear', url: '/reports/balance-sheet' },
      { id: uniqueId(), name: 'Documents', icon: 'solar:document-text-linear', url: '/documents' },
      { id: uniqueId(), name: 'Audit Logs', icon: 'solar:clipboard-list-linear', url: '/audit-logs' },
    ],
  },
  {
    heading: 'AI',
    children: [
      {
        id: uniqueId(),
        name: 'Accounting Assistant',
        icon: 'solar:chat-round-dots-linear',
        url: '/ai-assistant',
      },
    ],
  },
  {
    heading: 'Account',
    children: [
      { id: uniqueId(), name: 'User Profile', icon: 'solar:user-circle-linear', url: '/user-profile' },
      { id: uniqueId(), name: 'Organization Settings', icon: 'solar:buildings-2-linear', url: '/organization-settings' },
    ],
  },
  {
    heading: 'Auth',
    children: [
      {
        name: 'Login',
        id: uniqueId(),
        icon: 'solar:login-2-linear',
        children: [
          { id: uniqueId(), name: 'Boxed Login', url: '/auth/auth2/login' },
        ],
      },
      {
        name: 'Register',
        id: uniqueId(),
        icon: 'solar:user-plus-rounded-linear',
        children: [
          { id: uniqueId(), name: 'Boxed Register', url: '/auth/auth2/register' },
        ],
      },
    ],
  },
];

export default SidebarContent;
