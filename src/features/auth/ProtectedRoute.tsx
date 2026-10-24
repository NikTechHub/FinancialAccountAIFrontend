import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router';
import Spinner from 'src/views/spinner/Spinner';
import NoOrganization from './NoOrganization';
import { useAuth } from './useAuth';

export default function ProtectedRoute({ children }: { children: ReactNode }) {
  const { status, organization } = useAuth();
  const location = useLocation();

  if (status === 'initializing') {
    return <Spinner />;
  }

  if (status === 'unauthenticated') {
    return <Navigate to="/auth/auth2/login" replace state={{ from: location }} />;
  }

  if (!organization) {
    return <NoOrganization />;
  }

  return <>{children}</>;
}
