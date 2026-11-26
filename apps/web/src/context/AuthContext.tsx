/* eslint-disable react-refresh/only-export-components */
import React, { createContext, useEffect, useState, useCallback } from 'react';
import { authService, UserProfile } from '../services/auth.service';
import { setOnAuthFailure } from '../services/api-client';
import { offlineRepo } from '../offline/offline-repository';
import { setActiveOfflineUserId } from '../offline/offline-cache';

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

const SESSION_HINT_KEY = 'ff_has_session';

function hasSessionHint(): boolean {
  try {
    return window.localStorage.getItem(SESSION_HINT_KEY) === '1';
  } catch {
    return false;
  }
}

function setSessionHint(active: boolean): void {
  try {
    if (active) {
      window.localStorage.setItem(SESSION_HINT_KEY, '1');
    } else {
      window.localStorage.removeItem(SESSION_HINT_KEY);
    }
  } catch {
    // Ignore storage errors
  }
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const handleAuthFailure = useCallback(() => {
    setSessionHint(false);
    setActiveOfflineUserId(null);
    setUser(null);
  }, []);

  // Set auth failure callback on mount
  useEffect(() => {
    setOnAuthFailure(handleAuthFailure);
  }, [handleAuthFailure]);

  // Initial silent authentication check via HTTP-only refresh cookie (only when a session hint exists)
  useEffect(() => {
    let isMounted = true;

    const initAuth = async () => {
      if (!hasSessionHint()) {
        const isOffline = typeof navigator !== 'undefined' && !navigator.onLine;
        if (isOffline) {
          const snapshot = await offlineRepo.getLastActiveUserSnapshot().catch(() => null);
          if (snapshot && isMounted) {
            setActiveOfflineUserId(snapshot.userProfileSnapshot.id);
            setUser(snapshot.userProfileSnapshot);
            setIsLoading(false);
            return;
          }
        }
        if (isMounted) {
          setActiveOfflineUserId(null);
          setUser(null);
          setIsLoading(false);
        }
        return;
      }

      try {
        const userProfile = await authService.refresh();
        setSessionHint(true);
        setActiveOfflineUserId(userProfile.id);
        await offlineRepo.saveUserSessionSnapshot(userProfile).catch(() => undefined);
        if (isMounted) {
          setUser(userProfile);
        }
      } catch {
        // Only fall back to a previously authenticated, non-expired offline session when offline
        const isOffline = typeof navigator !== 'undefined' && !navigator.onLine;
        if (isOffline) {
          const snapshot = await offlineRepo.getLastActiveUserSnapshot().catch(() => null);
          if (snapshot && isMounted) {
            setActiveOfflineUserId(snapshot.userProfileSnapshot.id);
            setUser(snapshot.userProfileSnapshot);
            setIsLoading(false);
            return;
          }
        }
        setSessionHint(false);
        if (isMounted) {
          setActiveOfflineUserId(null);
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
    setSessionHint(true);
    setActiveOfflineUserId(userProfile.id);
    await offlineRepo.saveUserSessionSnapshot(userProfile).catch(() => undefined);
    setUser(userProfile);
    return userProfile;
  };

  const logout = async (): Promise<void> => {
    const currentUserId = user?.id;
    try {
      await authService.logout();
    } catch {
      // Allow safe offline logout even when the server is unreachable
    } finally {
      setSessionHint(false);
      setActiveOfflineUserId(null);
      if (currentUserId) {
        await offlineRepo.clearUserDataOnLogout(currentUserId, false).catch(() => undefined);
      }
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
