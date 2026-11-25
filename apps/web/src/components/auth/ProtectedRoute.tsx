import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { Loader2 } from 'lucide-react';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredRoles?: string[];
  requiredPermissions?: string[];
  anyPermission?: string[];
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
  children,
  requiredRoles,
  requiredPermissions,
  anyPermission,
}) => {
  const { isAuthenticated, isLoading, hasRole, hasPermission } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#F7F8F2]">
        <div className="flex items-center gap-3 text-[#24352A]">
          <Loader2 className="w-8 h-8 animate-spin text-[#245C3A]" />
          <span className="font-semibold text-lg tracking-wide">
            Verifying FoodFactory Session...
          </span>
        </div>
        <p className="text-xs text-slate-400 mt-2">
          Checking cryptographic credentials and access privileges
        </p>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (requiredRoles && requiredRoles.length > 0) {
    const hasAnyRole = requiredRoles.some(role => hasRole(role));
    if (!hasAnyRole) {
      return <Navigate to="/unauthorized" replace />;
    }
  }

  if (requiredPermissions && requiredPermissions.length > 0) {
    const hasAllPermissions = requiredPermissions.every(perm => hasPermission(perm));
    if (!hasAllPermissions) {
      return <Navigate to="/unauthorized" replace />;
    }
  }

  if (anyPermission && anyPermission.length > 0) {
    const hasSomePermission = anyPermission.some(perm => hasPermission(perm));
    if (!hasSomePermission) {
      return <Navigate to="/unauthorized" replace />;
    }
  }

  return <>{children}</>;
};
