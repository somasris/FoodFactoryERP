/* eslint-disable react-refresh/only-export-components */
import React, { createContext, useEffect, useState, useCallback } from 'react';
import { authService, UserProfile } from '../services/auth.service';
import { setOnAuthFailure } from '../services/api-client';

export interface AuthContextType {
  user: UserProfile | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (usernameOrEmail: string, password: string) => Promise<UserProfile>;
  logout: () => Promise<void>;
  hasRole: (roleCode: string) => boolean;
  hasPermission: (permissionCode: string) => boolean;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const handleAuthFailure = useCallback(() => {
    setUser(null);
  }, []);

  // Set auth failure callback on mount
  useEffect(() => {
    setOnAuthFailure(handleAuthFailure);
  }, [handleAuthFailure]);

  // Initial silent authentication check via HTTP-only refresh cookie
  useEffect(() => {
    let isMounted = true;

    const initAuth = async () => {
      try {
        const userProfile = await authService.refresh();
        if (isMounted) {
          setUser(userProfile);
        }
      } catch {
        if (isMounted) {
          setUser(null);
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    initAuth();

    return () => {
      isMounted = false;
    };
  }, []);

  const login = async (usernameOrEmail: string, password: string): Promise<UserProfile> => {
    const userProfile = await authService.login(usernameOrEmail, password);
    setUser(userProfile);
    return userProfile;
  };

  const logout = async (): Promise<void> => {
    try {
      await authService.logout();
    } finally {
      setUser(null);
    }
  };

  const hasRole = useCallback(
    (roleCode: string): boolean => {
      if (!user) return false;
      if (user.roles.includes('OWNER')) return true; // Owner possesses universal access
      return user.roles.includes(roleCode);
    },
    [user],
  );

  const hasPermission = useCallback(
    (permissionCode: string): boolean => {
      if (!user) return false;
      if (user.roles.includes('OWNER')) return true; // Owner possesses universal access
      return user.permissions.includes(permissionCode);
    },
    [user],
  );

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        isLoading,
        login,
        logout,
        hasRole,
        hasPermission,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};
