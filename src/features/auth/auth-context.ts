import { createContext } from 'react';
import type {
  LoginRequest,
  MembershipRole,
  OrganizationResponse,
  RegisterRequest,
  UserResponse,
} from 'src/lib/api/types';

export type AuthStatus = 'initializing' | 'authenticated' | 'unauthenticated';

export interface AuthContextValue {
  status: AuthStatus;
  user: UserResponse | null;
  organization: OrganizationResponse | null;
  role: MembershipRole | null;
  membershipError: string | null;
  login: (credentials: LoginRequest) => Promise<void>;
  register: (request: RegisterRequest) => Promise<void>;
  logout: () => void;
}

export const AuthContext = createContext<AuthContextValue | null>(null);
