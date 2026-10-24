import { api } from './client';
import type { AuthResponse, LoginRequest, RegisterRequest } from './types';

const authRequestOptions = {
  skipAuth: true,
  retryOnUnauthorized: false,
} as const;

export function login(request: LoginRequest): Promise<AuthResponse> {
  return api.post<AuthResponse>('/auth/login', request, authRequestOptions);
}

export function register(request: RegisterRequest): Promise<AuthResponse> {
  return api.post<AuthResponse>('/auth/register', request, authRequestOptions);
}
