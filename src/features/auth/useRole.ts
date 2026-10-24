import { useCallback } from 'react';
import type { MembershipRole } from 'src/lib/api/types';
import { useAuth } from './useAuth';

export function useRole() {
  const { role, membershipError } = useAuth();

  const hasRole = useCallback(
    (...allowed: MembershipRole[]) => role !== null && allowed.includes(role),
    [role],
  );

  return { role, membershipError, hasRole };
}
