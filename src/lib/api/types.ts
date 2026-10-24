export interface ApiErrorResponse {
  timestamp?: string;
  status?: number;
  error?: string;
  message?: string;
  path?: string;
  fieldErrors?: Record<string, string>;
}

export interface PageResponse<T> {
  content: T[];
  totalElements: number;
  totalPages: number;
  number: number;
  size: number;
  first: boolean;
  last: boolean;
  numberOfElements: number;
  empty: boolean;
  sort?: {
    empty?: boolean;
    sorted?: boolean;
    unsorted?: boolean;
  };
}

export interface UserResponse {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface OrganizationResponse {
  id: string;
  name: string;
  legalName: string;
  businessType: string;
  country: string;
  currency: string;
  timezone: string;
  createdAt: string;
  updatedAt: string;
}

export type MembershipRole = 'OWNER' | 'ADMIN' | 'ACCOUNTANT' | 'EMPLOYEE' | 'VIEWER';

export interface MembershipResponse {
  id: string;
  userId: string;
  userEmail: string;
  userFirstName: string;
  userLastName: string;
  organizationId: string;
  organizationName: string;
  role: MembershipRole;
  createdAt: string;
}

export interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  tokenType: string;
  /** Access-token lifetime in milliseconds. */
  expiresIn: number;
  user: UserResponse;
  organization: OrganizationResponse | null;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  organizationName: string;
  legalName: string;
  businessType: string;
  country: string;
  currency: string;
  timezone: string;
}

export interface RefreshRequest {
  refreshToken: string;
}
