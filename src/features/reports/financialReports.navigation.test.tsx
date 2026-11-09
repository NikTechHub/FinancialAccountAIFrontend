// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { AuthContext, type AuthContextValue } from 'src/features/auth/auth-context';
import { clearSession } from 'src/lib/api/session';
import { jsonResponse, testOrganization, testUser } from 'src/test/api-fixtures';
import { balanceSheetFixture, profitAndLossFixture } from 'src/test/financial-report-fixtures';
import SidebarContent from 'src/layouts/full/vertical/sidebar/sidebaritems';
import appRouter from 'src/routes/Router';

// Keep the real route tree, auth guard, lazy report views and pages. The shell's
// unrelated dashboard providers are outside these navigation integration tests.
vi.mock('src/layouts/full/FullLayout', async () => ({ default: (await import('react-router')).Outlet }));
vi.mock('src/layouts/blank/BlankLayout', async () => ({ default: (await import('react-router')).Outlet }));
vi.mock('src/views/authentication/auth2/Login', () => ({ default: () => <div>Sign in page</div> }));

const routers: ReturnType<typeof createMemoryRouter>[] = [];
beforeAll(async () => {
  // Wait for Vite's cold module transforms explicitly before timing DOM assertions.
  await Promise.all([import('src/views/reports/ProfitAndLoss'), import('src/views/reports/BalanceSheet')]);
});
afterEach(() => { cleanup(); routers.splice(0).forEach((router) => router.dispose()); clearSession(); vi.unstubAllGlobals(); });
afterAll(() => appRouter.dispose());

function visit(path: string, authenticated: boolean) {
  const router = createMemoryRouter(appRouter.routes, { initialEntries: [path] }); routers.push(router);
  const auth: AuthContextValue = {
    status: authenticated ? 'authenticated' : 'unauthenticated', user: authenticated ? testUser : null,
    organization: authenticated ? testOrganization : null, role: authenticated ? 'VIEWER' : null,
    membershipError: null, login: vi.fn(), register: vi.fn(), logout: vi.fn(),
  };
  render(<AuthContext.Provider value={auth}><RouterProvider router={router} /></AuthContext.Provider>);
  return router;
}

describe('financial report navigation', () => {
  it('keeps unique accounting routes and matching sidebar entries', () => {
    const paths = appRouter.routes.flatMap((route) => route.children?.map((child) => child.path) ?? []);
    const sidebar = SidebarContent.flatMap((group) => group.children ?? []);
    for (const path of ['/accounts', '/journal-entries', '/reports/general-ledger', '/reports/trial-balance', '/reports/profit-and-loss', '/reports/balance-sheet']) {
      expect(paths.filter((value) => value === path)).toHaveLength(1);
      expect(sidebar.filter((item) => item.url === path && !item.disabled && !item.isPro)).toHaveLength(1);
    }
  });

  it.each(['/reports/profit-and-loss', '/reports/balance-sheet'])('protects %s and preserves the requested destination', async (path) => {
    const fetchMock = vi.fn(); vi.stubGlobal('fetch', fetchMock);
    const router = visit(path, false);
    await screen.findByText('Sign in page');
    expect(router.state.location.pathname).toBe('/auth/auth2/login');
    expect(router.state.location.state).toMatchObject({ from: { pathname: path } });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it.each([
    ['/reports/profit-and-loss', 'Consulting revenue'], ['/reports/balance-sheet', 'Bank account'],
  ])('loads %s for an authenticated viewer', async (path, account) => {
    vi.stubGlobal('fetch', vi.fn(async () => jsonResponse(path.endsWith('balance-sheet') ? balanceSheetFixture() : profitAndLossFixture())));
    const router = visit(path, true);
    await waitFor(() => expect(screen.getByText(account)).toBeTruthy());
    expect(router.state.location.pathname).toBe(path);
  });
});
