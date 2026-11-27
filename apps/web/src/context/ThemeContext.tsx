/* eslint-disable react-refresh/only-export-components */
import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { useAuth } from '../hooks/useAuth';

export type ThemeMode = 'light' | 'dark' | 'system';
export type ResolvedTheme = 'light' | 'dark';

export interface ThemeContextValue {
  themeMode: ThemeMode;
  resolvedTheme: ResolvedTheme;
  setThemeMode: (mode: ThemeMode) => void;
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

function getThemeStorageKey(userId?: string | null): string {
  return userId ? `ff_theme_${userId}` : 'ff_theme_guest';
}

function readStoredTheme(userId?: string | null): ThemeMode {
  try {
    const val = window.localStorage.getItem(getThemeStorageKey(userId));
    if (val === 'light' || val === 'dark' || val === 'system') return val;
    return 'light';
  } catch {
    return 'light';
  }
}

function resolveSystemTheme(): ResolvedTheme {
  if (typeof window !== 'undefined' && window.matchMedia) {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  return 'light';
}

function applyThemeToDocument(resolved: ResolvedTheme, mode: ThemeMode): void {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  const colorSchemeContent = mode === 'system' ? 'light dark' : mode;
  let meta = document.querySelector('meta[name="color-scheme"]');
  if (!meta) {
    meta = document.createElement('meta');
    meta.setAttribute('name', 'color-scheme');
    document.head.appendChild(meta);
  }
  meta.setAttribute('content', colorSchemeContent);

  if (resolved === 'dark') {
    root.classList.add('dark');
    root.dataset.theme = 'dark';
  } else {
    root.classList.remove('dark');
    root.dataset.theme = 'light';
  }
}

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [themeMode, setThemeModeState] = useState<ThemeMode>(() => readStoredTheme(user?.id));
  const [systemTheme, setSystemTheme] = useState<ResolvedTheme>(() => resolveSystemTheme());

  useEffect(() => {
    setThemeModeState(readStoredTheme(user?.id));
  }, [user?.id]);

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = (e: MediaQueryListEvent) => {
      setSystemTheme(e.matches ? 'dark' : 'light');
    };
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  const resolvedTheme: ResolvedTheme = themeMode === 'system' ? systemTheme : themeMode;

  useEffect(() => {
    applyThemeToDocument(resolvedTheme, themeMode);
  }, [resolvedTheme, themeMode]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const storageKey = getThemeStorageKey(user?.id);
    const onStorage = (e: StorageEvent) => {
      if (e.key === storageKey || e.key === 'ff_theme_last') {
        setThemeModeState(readStoredTheme(user?.id));
      }
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, [user?.id]);

  const setThemeMode = useCallback(
    (mode: ThemeMode) => {
      setThemeModeState(mode);
      try {
        window.localStorage.setItem(getThemeStorageKey(user?.id), mode);
        window.localStorage.setItem('ff_theme_last', mode);
      } catch {
        // Ignore storage errors
      }
    },
    [user?.id],
  );

  return (
    <ThemeContext.Provider value={{ themeMode, resolvedTheme, setThemeMode }}>
      {children}
    </ThemeContext.Provider>
  );
};

const FALLBACK_THEME: ThemeContextValue = {
  themeMode: 'light',
  resolvedTheme: 'light',
  setThemeMode: () => {},
};

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  return ctx ?? FALLBACK_THEME;
}
