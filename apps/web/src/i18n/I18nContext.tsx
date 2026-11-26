/* eslint-disable react-refresh/only-export-components */
import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { en } from './en';
import { ta } from './ta';
import { useAuth } from '../hooks/useAuth';

export type SupportedLanguage = 'en' | 'ta';

const DICTIONARIES: Record<SupportedLanguage, Record<string, Record<string, string>>> = {
  en: en as unknown as Record<string, Record<string, string>>,
  ta: ta as unknown as Record<string, Record<string, string>>,
};

export interface I18nContextValue {
  language: SupportedLanguage;
  setLanguage: (lang: SupportedLanguage) => void;
  t: (key: string, fallback?: string) => string;
  formatDate: (date: string | Date | null | undefined) => string;
  formatNumber: (value: number | string, decimals?: number) => string;
  formatCurrency: (value: number | string) => string;
}

const I18nContext = createContext<I18nContextValue | undefined>(undefined);

function getStorageKey(userId?: string | null): string {
  return userId ? `ff_lang_${userId}` : 'ff_lang_guest';
}

function readStoredLanguage(userId?: string | null): SupportedLanguage {
  try {
    const val = window.localStorage.getItem(getStorageKey(userId));
    return val === 'ta' ? 'ta' : 'en';
  } catch {
    return 'en';
  }
}

export function translateKey(
  lang: SupportedLanguage,
  key: string,
  fallback?: string,
): string {
  const dotIdx = key.indexOf('.');
  if (dotIdx === -1) return fallback ?? key;
  const domain = key.slice(0, dotIdx);
  const subKey = key.slice(dotIdx + 1);

  const primary = DICTIONARIES[lang]?.[domain]?.[subKey];
  if (primary) return primary;

  const englishFallback = DICTIONARIES.en?.[domain]?.[subKey];
  if (englishFallback) return englishFallback;

  return fallback ?? subKey;
}

export const I18nProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [language, setLanguageState] = useState<SupportedLanguage>(() =>
    readStoredLanguage(user?.id),
  );

  useEffect(() => {
    setLanguageState(readStoredLanguage(user?.id));
  }, [user?.id]);

  const setLanguage = useCallback(
    (lang: SupportedLanguage) => {
      setLanguageState(lang);
      try {
        window.localStorage.setItem(getStorageKey(user?.id), lang);
      } catch {
        // Ignore storage errors
      }
    },
    [user?.id],
  );

  const t = useCallback(
    (key: string, fallback?: string) => translateKey(language, key, fallback),
    [language],
  );

  const locale = language === 'ta' ? 'ta-IN' : 'en-IN';

  const formatDate = useCallback(
    (date: string | Date | null | undefined) => {
      if (!date) return '—';
      const d = date instanceof Date ? date : new Date(date);
      if (Number.isNaN(d.getTime())) return '—';
      return new Intl.DateTimeFormat(locale, {
        year: 'numeric',
        month: 'short',
        day: '2-digit',
      }).format(d);
    },
    [locale],
  );

  const formatNumber = useCallback(
    (value: number | string, decimals?: number) => {
      const num = typeof value === 'string' ? Number(value) : value;
      if (!Number.isFinite(num)) return String(value);
      return new Intl.NumberFormat(locale, {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals ?? 4,
      }).format(num);
    },
    [locale],
  );

  const formatCurrency = useCallback(
    (value: number | string) => {
      const num = typeof value === 'string' ? Number(value) : value;
      if (!Number.isFinite(num)) return `₹${value}`;
      return new Intl.NumberFormat(locale, {
        style: 'currency',
        currency: 'INR',
        maximumFractionDigits: 2,
      }).format(num);
    },
    [locale],
  );

  return (
    <I18nContext.Provider
      value={{ language, setLanguage, t, formatDate, formatNumber, formatCurrency }}
    >
      {children}
    </I18nContext.Provider>
  );
};

const FALLBACK_I18N: I18nContextValue = {
  language: 'en',
  setLanguage: () => {},
  t: (key, fallback) => translateKey('en', key, fallback),
  formatDate: date => (date ? new Date(date).toLocaleDateString() : '—'),
  formatNumber: value => String(value),
  formatCurrency: value => `₹${value}`,
};

export function useTranslation(): I18nContextValue {
  const ctx = useContext(I18nContext);
  return ctx ?? FALLBACK_I18N;
}
