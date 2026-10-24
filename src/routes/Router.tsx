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
const Documents = Loadable(lazy(() => import('../views/documents/Documents')));

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
      { path: '/documents', element: <Documents /> },

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
