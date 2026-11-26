import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { AuthContext } from '../context/AuthContext';
import { ThemeProvider, useTheme } from '../context/ThemeContext';
import { I18nProvider, useTranslation } from '../i18n/I18nContext';
import { en } from '../i18n/en';
import { ta } from '../i18n/ta';

const CombinedTester = () => {
  const { themeMode, resolvedTheme, setThemeMode } = useTheme();
  const { language, setLanguage, t } = useTranslation();
  return (
    <div>
      <span data-testid="theme-mode">{themeMode}</span>
      <span data-testid="resolved-theme">{resolvedTheme}</span>
      <span data-testid="lang">{language}</span>
      <span data-testid="label-dashboard">{t('navigation.Executive Dashboard')}</span>
      <span data-testid="label-status">{t('status.APPROVED')}</span>
      <button onClick={() => setThemeMode('dark')}>SetDark</button>
      <button onClick={() => setThemeMode('light')}>SetLight</button>
      <button onClick={() => setThemeMode('system')}>SetSystem</button>
      <button onClick={() => setLanguage('ta')}>SetTamil</button>
      <button onClick={() => setLanguage('en')}>SetEnglish</button>
    </div>
  );
};

describe('Complete Light/Dark Theme + English/Tamil Combination Suite', () => {
  const userA = {
    id: 'combo-user-a',
    email: 'a@foodfactory.local',
    username: 'usera',
    fullName: 'User A',
    isActive: true,
    roles: ['ADMIN'],
    permissions: [],
  };

  beforeEach(() => {
    window.localStorage.clear();
    document.documentElement.classList.remove('dark');
  });

  afterEach(() => {
    cleanup();
  });

  it('verifies 100% translation key parity between English and Tamil across all domains', () => {
    const enDomains = Object.keys(en) as Array<keyof typeof en>;
    const taDomains = Object.keys(ta);
    expect(taDomains).toEqual(enDomains);

    let totalKeys = 0;
    for (const domain of enDomains) {
      const enKeys = Object.keys(en[domain]);
      const taKeys = Object.keys(ta[domain]);
      expect(taKeys).toEqual(enKeys);
      totalKeys += enKeys.length;
    }
    expect(totalKeys).toBeGreaterThan(130);
  });

  it('supports all 4 combinations (EN+Light, EN+Dark, TA+Light, TA+Dark) without resetting either preference', () => {
    render(
      <AuthContext.Provider
        value={{
          user: userA,
          isAuthenticated: true,
          isLoading: false,
          login: async () => userA,
          logout: async () => {},
          hasRole: () => true,
          hasPermission: () => true,
        }}
      >
        <ThemeProvider>
          <I18nProvider>
            <CombinedTester />
          </I18nProvider>
        </ThemeProvider>
      </AuthContext.Provider>,
    );

    // 1. EN + Light (default)
    expect(screen.getByTestId('resolved-theme').textContent).toBe('light');
    expect(screen.getByTestId('lang').textContent).toBe('en');
    expect(screen.getByTestId('label-dashboard').textContent).toBe('Executive Dashboard');
    expect(document.documentElement.classList.contains('dark')).toBe(false);

    // 2. EN + Dark
    fireEvent.click(screen.getByText('SetDark'));
    expect(screen.getByTestId('resolved-theme').textContent).toBe('dark');
    expect(screen.getByTestId('lang').textContent).toBe('en');
    expect(document.documentElement.classList.contains('dark')).toBe(true);

    // 3. TA + Dark (theme remains dark!)
    fireEvent.click(screen.getByText('SetTamil'));
    expect(screen.getByTestId('resolved-theme').textContent).toBe('dark');
    expect(screen.getByTestId('lang').textContent).toBe('ta');
    expect(screen.getByTestId('label-dashboard').textContent).toBe('நிர்வாக முகப்புப் பலகை');
    expect(screen.getByTestId('label-status').textContent).toBe('அங்கீகரிக்கப்பட்டது');
    expect(document.documentElement.classList.contains('dark')).toBe(true);

    // 4. TA + Light (language remains Tamil!)
    fireEvent.click(screen.getByText('SetLight'));
    expect(screen.getByTestId('resolved-theme').textContent).toBe('light');
    expect(screen.getByTestId('lang').textContent).toBe('ta');
    expect(document.documentElement.classList.contains('dark')).toBe(false);

    // Verify per-user persistence
    expect(window.localStorage.getItem('ff_theme_combo-user-a')).toBe('light');
    expect(window.localStorage.getItem('ff_lang_combo-user-a')).toBe('ta');
  });
});
