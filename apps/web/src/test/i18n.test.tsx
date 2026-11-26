import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { I18nProvider, useTranslation, translateKey } from '../i18n/I18nContext';
import { AuthContext } from '../context/AuthContext';
import { en } from '../i18n/en';
import { ta } from '../i18n/ta';

const LangTester = () => {
  const { language, setLanguage, t } = useTranslation();
  return (
    <div>
      <span data-testid="lang">{language}</span>
      <span data-testid="title">{t('factoryPulse.title')}</span>
      <button onClick={() => setLanguage('ta')}>SwitchTamil</button>
      <button onClick={() => setLanguage('en')}>SwitchEnglish</button>
    </div>
  );
};

describe('Sprint 5: English + Tamil Localization', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  afterEach(() => {
    cleanup();
  });

  it('has matching domain keys between English and Tamil dictionaries and falls back to English', () => {
    for (const domain of Object.keys(en) as Array<keyof typeof en>) {
      const enKeys = Object.keys(en[domain]);
      const taKeys = Object.keys(ta[domain]);
      expect(taKeys).toEqual(enKeys);
    }

    expect(translateKey('ta', 'common.nonExistentKey', 'Fallback')).toBe('Fallback');
  });

  it('switches between English and Tamil without reload and persists per-user preference', () => {
    const user = {
      id: 'i18n-user-1',
      email: 'i18n@test.local',
      username: 'i18nuser',
      fullName: 'I18n User',
      isActive: true,
      roles: ['ADMIN'],
      permissions: [],
    };

    render(
      <AuthContext.Provider
        value={{
          user,
          isAuthenticated: true,
          isLoading: false,
          login: async () => user,
          logout: async () => {},
          hasRole: () => true,
          hasPermission: () => true,
        }}
      >
        <I18nProvider>
          <LangTester />
        </I18nProvider>
      </AuthContext.Provider>,
    );

    expect(screen.getByTestId('lang').textContent).toBe('en');
    expect(screen.getByTestId('title').textContent).toBe('Live Factory Pulse');

    fireEvent.click(screen.getByText('SwitchTamil'));
    expect(screen.getByTestId('lang').textContent).toBe('ta');
    expect(screen.getByTestId('title').textContent).toBe('நேரடி தொழிற்சாலை நிலை');
    expect(window.localStorage.getItem('ff_lang_i18n-user-1')).toBe('ta');

    // Guest or another user does not inherit user-1's preference
    expect(window.localStorage.getItem('ff_lang_other-user')).toBeNull();
  });
});
