// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import { lazy } from 'react';
import { Navigate, createBrowserRouter } from 'react-router';
import ProtectedRoute from '../features/auth/ProtectedRoute';
import Loadable from '../layouts/full/shared/loadable/Loadable';

/* ***Layouts**** */
const FullLayout = Loadable(lazy(() => import('../layouts/full/FullLayout')));
const BlankLayout = Loadable(lazy(() => import('../layouts/blank/BlankLayout')));

// authentication

const Login2 = Loadable(lazy(() => import('../views/authentication/auth2/Login')));

const Register2 = Loadable(lazy(() => import('../views/authentication/auth2/Register')));

const Maintainance = Loadable(lazy(() => import('../views/authentication/Maintainance')));

// Dashboards
const Modern = Loadable(lazy(() => import('../views/dashboards/Modern')));

// Accounting
const Vendors = Loadable(lazy(() => import('../views/vendors/Vendors')));
const Customers = Loadable(lazy(() => import('../views/customers/Customers')));
const Invoices = Loadable(lazy(() => import('../views/invoices/Invoices')));
const Accounts = Loadable(lazy(() => import('../views/accounts/Accounts')));
const Expenses = Loadable(lazy(() => import('../views/expenses/Expenses')));
const Journals = Loadable(lazy(() => import('../views/journals/Journals')));
const GeneralLedger = Loadable(lazy(() => import('../views/reports/GeneralLedger')));
const TrialBalance = Loadable(lazy(() => import('../views/reports/TrialBalance')));
const ProfitAndLoss = Loadable(lazy(() => import('../views/reports/ProfitAndLoss')));
const BalanceSheet = Loadable(lazy(() => import('../views/reports/BalanceSheet')));
const Documents = Loadable(lazy(() => import('../views/documents/Documents')));
const AccountingAssistant = Loadable(lazy(() => import('../views/assistant/AccountingAssistant')));
const OrganizationSettings = Loadable(lazy(() => import('../views/organization/OrganizationSettings')));
const AuditLogs = Loadable(lazy(() => import('../views/audit/AuditLogs')));

//pages
const UserProfile = Loadable(lazy(() => import('../views/pages/user-profile/UserProfile')));

/* ****Apps***** */
const Notes = Loadable(lazy(() => import('../views/apps/notes/Notes')));
const Form = Loadable(lazy(() => import('../views/utilities/form/Form')));
const Table = Loadable(lazy(() => import('../views/utilities/table/Table')));
const Tickets = Loadable(lazy(() => import('../views/apps/tickets/Tickets')));
const CreateTickets = Loadable(lazy(() => import('../views/apps/tickets/CreateTickets')));
const Blog = Loadable(lazy(() => import('../views/apps/blog/Blog')));
const BlogDetail = Loadable(lazy(() => import('../views/apps/blog/BlogDetail')));

const Error = Loadable(lazy(() => import('../views/authentication/Error')));

// // icons
const SolarIcon = Loadable(lazy(() => import('../views/icons/SolarIcon')));

// const SamplePage = lazy(() => import('../views/sample-page/SamplePage'));

const Router = [
  {
    path: '/',
    element: (
      <ProtectedRoute>
        <FullLayout />
      </ProtectedRoute>
    ),
    children: [
      { path: '/', exact: true, element: <Modern /> },
      // { path: '/', exact: true, element: <SamplePage /> },
      { path: '*', element: <Navigate to="/auth/404" /> },

      { path: '/vendors', element: <Vendors /> },
      { path: '/customers', element: <Customers /> },
      { path: '/invoices', element: <Invoices /> },
      { path: '/accounts', element: <Accounts /> },
      { path: '/expenses', element: <Expenses /> },
      { path: '/journal-entries', element: <Journals /> },
      { path: '/reports/general-ledger', element: <GeneralLedger /> },
      { path: '/reports/trial-balance', element: <TrialBalance /> },
      { path: '/reports/profit-and-loss', element: <ProfitAndLoss /> },
      { path: '/reports/balance-sheet', element: <BalanceSheet /> },
      { path: '/documents', element: <Documents /> },
      { path: '/ai-assistant', element: <AccountingAssistant /> },
      { path: '/organization-settings', element: <OrganizationSettings /> },
      { path: '/audit-logs', element: <AuditLogs /> },

      { path: '/apps/notes', element: <Notes /> },
      { path: '/utilities/form', element: <Form /> },
      { path: '/utilities/table', element: <Table /> },
      { path: '/apps/tickets', element: <Tickets /> },
      { path: '/apps/tickets/create', element: <CreateTickets /> },
      { path: '/apps/blog/post', element: <Blog /> },
      { path: '/apps/blog/detail/:id', element: <BlogDetail /> },
      { path: '/user-profile', element: <UserProfile /> },
      { path: '/icons/iconify', element: <SolarIcon /> },
    ],
  },
  {
    path: '/',
    element: <BlankLayout />,
    children: [
      { path: '/auth/auth2/login', element: <Login2 /> },

      { path: '/auth/auth2/register', element: <Register2 /> },

      { path: '/auth/maintenance', element: <Maintainance /> },
      { path: '404', element: <Error /> },
      { path: '/auth/404', element: <Error /> },
      { path: '*', element: <Navigate to="/auth/404" /> },
    ],
  },
];

const router = createBrowserRouter(Router);

export default router;
