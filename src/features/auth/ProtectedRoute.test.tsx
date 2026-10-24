// @vitest-environment jsdom
import type { ReactNode } from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter, RouterProvider, createMemoryRouter } from 'react-router';
import { testOrganization, testUser } from 'src/test/api-fixtures';
import { AuthContext, type AuthContextValue } from './auth-context';
import ProtectedRoute from './ProtectedRoute';

function createAuthValue(overrides: Partial<AuthContextValue> = {}): AuthContextValue {
  return {
    status: 'authenticated',
    user: testUser,
    organization: testOrganization,
    role: 'OWNER',
    membershipError: null,
    login: vi.fn(async () => undefined),
    register: vi.fn(async () => undefined),
    logout: vi.fn(),
    ...overrides,
  };
}

function protectedElement(auth: AuthContextValue, content: ReactNode) {
  return (
    <AuthContext.Provider value={auth}>
      <ProtectedRoute>{content}</ProtectedRoute>
    </AuthContext.Provider>
  );
}

function renderApp(initialPath: string, auth: AuthContextValue) {
  const router = createMemoryRouter(
    [
      {
        path: '/auth/auth2/login',
        element: <div>Login page</div>,
      },
      {
        path: '/auth/auth2/register',
        element: <div>Register page</div>,
      },
      {
        path: '/',
        element: protectedElement(auth, <div>Protected content</div>),
      },
      {
        path: '/apps/notes',
        element: protectedElement(auth, <div>Notes content</div>),
      },
    ],
    { initialEntries: [initialPath] },
  );

  render(<RouterProvider router={router} />);
  return router;
}

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('ProtectedRoute', () => {
  it('renders protected content for an authenticated session', () => {
    renderApp('/', createAuthValue());

    expect(screen.getByText('Protected content')).toBeTruthy();
  });

  it('redirects unauthenticated users and preserves the intended destination', async () => {
    const router = renderApp('/apps/notes', createAuthValue({ status: 'unauthenticated' }));

    await waitFor(() => expect(screen.getByText('Login page')).toBeTruthy());
    expect(router.state.location.pathname).toBe('/auth/auth2/login');
    expect(router.state.location.state).toMatchObject({
      from: { pathname: '/apps/notes' },
    });
  });

  it('keeps the login and registration routes public', () => {
    const unauthenticated = createAuthValue({
      status: 'unauthenticated',
      user: null,
      organization: null,
      role: null,
    });
    const loginRouter = renderApp('/auth/auth2/login', unauthenticated);
    expect(screen.getByText('Login page')).toBeTruthy();
    expect(loginRouter.state.location.pathname).toBe('/auth/auth2/login');

    cleanup();

    const registerRouter = renderApp('/auth/auth2/register', unauthenticated);
    expect(screen.getByText('Register page')).toBeTruthy();
    expect(registerRouter.state.location.pathname).toBe('/auth/auth2/register');
  });

  it('shows a loading state instead of protected content while initializing', () => {
    const { container } = render(
      <MemoryRouter initialEntries={['/']}>
        <AuthContext.Provider
          value={createAuthValue({
            status: 'initializing',
            user: null,
            organization: null,
            role: null,
          })}
        >
          <ProtectedRoute>
            <div>Protected content</div>
          </ProtectedRoute>
        </AuthContext.Provider>
      </MemoryRouter>,
    );

    expect(screen.queryByText('Protected content')).toBeNull();
    expect(container.querySelector('.fallback-spinner')).toBeTruthy();
  });

  it('shows a safe state when the session has no organization', async () => {
    const auth = createAuthValue({ organization: null, role: null });
    const router = renderApp('/', auth);

    expect(screen.getByText('Organization unavailable')).toBeTruthy();
    expect(screen.queryByText('Protected content')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Sign out' }));

    expect(auth.logout).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(router.state.location.pathname).toBe('/auth/auth2/login'));
  });
});
