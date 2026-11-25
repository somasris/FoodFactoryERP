import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { getDefaultDashboardPath } from '../../config/navigation';

/**
 * Redirects authenticated users from '/' or '/dashboard' to their
 * database-role-resolved authorized landing dashboard.
 */
export const RoleDashboardRedirect: React.FC = () => {
  const { user } = useAuth();
  const destination = getDefaultDashboardPath(user);
  return <Navigate to={destination} replace />;
};
