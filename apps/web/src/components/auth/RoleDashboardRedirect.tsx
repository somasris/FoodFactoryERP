import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { getDefaultDashboardPath, getModuleIndexPath } from '../../config/navigation';

/**
 * Redirects authenticated users from '/' or '/dashboard' to their
 * database-role-resolved authorized landing dashboard.
 */
export const RoleDashboardRedirect: React.FC = () => {
  const { user } = useAuth();
  const destination = getDefaultDashboardPath(user);
  return <Navigate to={destination} replace />;
};

/**
 * Redirects a module index route (e.g. '/reports', '/master-data') to the
 * first authorized route within that module for the authenticated user.
 */
export const ModuleIndexRedirect: React.FC<{ basePath: string }> = ({ basePath }) => {
  const { user } = useAuth();
  const destination = getModuleIndexPath(user, basePath);
  return <Navigate to={destination} replace />;
};
