import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { login as loginRequest, register as registerRequest } from 'src/lib/api/auth';
import { api } from 'src/lib/api/client';
import {
  applyAuthResponse,
  clearSession,
  getAccessToken,
  hasRefreshToken,
  refreshSession,
  subscribeToSession,
} from 'src/lib/api/session';
import type {
  AuthResponse,
  LoginRequest,
  MembershipResponse,
  MembershipRole,
  OrganizationResponse,
  RegisterRequest,
  UserResponse,
} from 'src/lib/api/types';
import { AuthContext, type AuthContextValue, type AuthStatus } from './auth-context';

interface AuthState {
  status: AuthStatus;
  user: UserResponse | null;
  organization: OrganizationResponse | null;
  role: MembershipRole | null;
  membershipError: string | null;
}

interface MembershipResult {
  role: MembershipRole | null;
  error: string | null;
}

const membershipRoles = new Set<MembershipRole>([
  'OWNER',
  'ADMIN',
  'ACCOUNTANT',
  'EMPLOYEE',
  'VIEWER',
]);

const unauthenticatedState: AuthState = {
  status: 'unauthenticated',
  user: null,
  organization: null,
  role: null,
  membershipError: null,
};

const initializingState: AuthState = {
  ...unauthenticatedState,
  status: 'initializing',
};

async function resolveMembership(
  organization: OrganizationResponse | null,
  user: UserResponse,
): Promise<MembershipResult> {
  if (!organization) return { role: null, error: null };

  try {
    const members = await api.get<MembershipResponse[]>(
      `/organizations/${organization.id}/members`,
    );

    if (!Array.isArray(members)) {
      return { role: null, error: 'Membership information is unavailable.' };
    }

    const membership = members.find((member) => member?.userId === user.id);
    if (!membership) {
      return {
        role: null,
        error: 'Your membership in this organization could not be verified.',
      };
    }

    if (!membershipRoles.has(membership.role)) {
      return { role: null, error: 'Membership information is unavailable.' };
    }

    return { role: membership.role, error: null };
  } catch {
    return {
      role: null,
      error: 'Membership information is unavailable. Some features may be limited.',
    };
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>(() =>
    hasRefreshToken() ? initializingState : unauthenticatedState,
  );
  const mountedRef = useRef(false);
  const statusRef = useRef<AuthStatus>(state.status);
  const organizationIdRef = useRef<string | null>(state.organization?.id ?? null);
  const hydrationIdRef = useRef(0);

  const applyState = useCallback((next: AuthState) => {
    statusRef.current = next.status;
    organizationIdRef.current = next.organization?.id ?? null;
    setState(next);
  }, []);

  const hydrate = useCallback(
    async (session: AuthResponse) => {
      const hydrationId = hydrationIdRef.current + 1;
      hydrationIdRef.current = hydrationId;

      const membership = await resolveMembership(session.organization, session.user);

      if (!mountedRef.current || hydrationId !== hydrationIdRef.current) return;

      if (!getAccessToken()) {
        applyState(unauthenticatedState);
        return;
      }

      applyState({
        status: 'authenticated',
        user: session.user,
        organization: session.organization,
        role: membership.role,
        membershipError: membership.error,
      });
    },
    [applyState],
  );

  useEffect(() => {
    mountedRef.current = true;

    const unsubscribe = subscribeToSession((session) => {
      if (!mountedRef.current) return;

      if (!session) {
        hydrationIdRef.current += 1;
        applyState(unauthenticatedState);
        return;
      }

      if (statusRef.current === 'authenticated') {
        const nextOrganizationId = session.organization?.id ?? null;

        if (nextOrganizationId !== organizationIdRef.current) {
          void hydrate(session);
          return;
        }

        setState((current) =>
          current.status === 'authenticated'
            ? { ...current, user: session.user, organization: session.organization }
            : current,
        );
      }
    });

    if (!hasRefreshToken()) {
      applyState(unauthenticatedState);
    } else {
      void (async () => {
        try {
          const session = await refreshSession();
          await hydrate(session);
        } catch {
          if (mountedRef.current && statusRef.current === 'initializing') {
            hydrationIdRef.current += 1;
            applyState(unauthenticatedState);
          }
        }
      })();
    }

    return () => {
      mountedRef.current = false;
      unsubscribe();
    };
  }, [applyState, hydrate]);

  const login = useCallback(
    async (credentials: LoginRequest) => {
      const session = await loginRequest(credentials);
      applyAuthResponse(session);
      await hydrate(session);
      if (!getAccessToken()) throw new Error('The session could not be established.');
    },
    [hydrate],
  );

  const register = useCallback(
    async (request: RegisterRequest) => {
      const session = await registerRequest(request);
      applyAuthResponse(session);
      await hydrate(session);
      if (!getAccessToken()) throw new Error('The session could not be established.');
    },
    [hydrate],
  );

  const logout = useCallback(() => {
    hydrationIdRef.current += 1;
    clearSession();
    applyState(unauthenticatedState);
  }, [applyState]);

  const updateOrganization = useCallback((organization: NonNullable<AuthState['organization']>) => {
    setState((current) => current.status === 'authenticated'
      ? { ...current, organization }
      : current);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      status: state.status,
      user: state.user,
      organization: state.organization,
      updateOrganization,
      role: state.role,
      membershipError: state.membershipError,
      login,
      register,
      logout,
    }),
    [state, login, register, logout, updateOrganization],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
