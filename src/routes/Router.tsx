// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import { lazy } from 'react';
import { Navigate, createBrowserRouter } from 'react-router';
import ProtectedRoute from '../features/auth/ProtectedRoute';
import Loadable from '../layouts/full/shared/loadable/Loadable';
import { ASSISTANT_ROUTE_ALLOWLIST } from '../features/assistant/localIntent';

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
      { path: ASSISTANT_ROUTE_ALLOWLIST.dashboard.path, exact: true, element: <Modern /> },
      // { path: '/', exact: true, element: <SamplePage /> },
      { path: '*', element: <Navigate to="/auth/404" /> },

      { path: ASSISTANT_ROUTE_ALLOWLIST.vendors.path, element: <Vendors /> },
      { path: ASSISTANT_ROUTE_ALLOWLIST.customers.path, element: <Customers /> },
      { path: ASSISTANT_ROUTE_ALLOWLIST.invoices.path, element: <Invoices /> },
      { path: ASSISTANT_ROUTE_ALLOWLIST.accounts.path, element: <Accounts /> },
      { path: ASSISTANT_ROUTE_ALLOWLIST.expenses.path, element: <Expenses /> },
      { path: ASSISTANT_ROUTE_ALLOWLIST.journals.path, element: <Journals /> },
      { path: ASSISTANT_ROUTE_ALLOWLIST.generalLedger.path, element: <GeneralLedger /> },
      { path: ASSISTANT_ROUTE_ALLOWLIST.trialBalance.path, element: <TrialBalance /> },
      { path: ASSISTANT_ROUTE_ALLOWLIST.profitAndLoss.path, element: <ProfitAndLoss /> },
      { path: ASSISTANT_ROUTE_ALLOWLIST.balanceSheet.path, element: <BalanceSheet /> },
      { path: ASSISTANT_ROUTE_ALLOWLIST.documents.path, element: <Documents /> },
      { path: ASSISTANT_ROUTE_ALLOWLIST.assistant.path, element: <AccountingAssistant /> },
      { path: ASSISTANT_ROUTE_ALLOWLIST.organizationSettings.path, element: <OrganizationSettings /> },
      { path: ASSISTANT_ROUTE_ALLOWLIST.auditLogs.path, element: <AuditLogs /> },

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
