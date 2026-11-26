import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from './context/AuthContext';
import { OfflineProvider } from './context/OfflineContext';
import { I18nProvider } from './i18n/I18nContext';
import { ThemeProvider } from './context/ThemeContext';
import { useOfflineSync } from './hooks/useOfflineSync';
import { AppRoutes } from './routes';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 10,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

const OfflineSyncCoordinator: React.FC = () => {
  useOfflineSync();
  return null;
};

export const App: React.FC = () => {
  return (
    <QueryClientProvider client={queryClient}>
      <OfflineProvider>
        <AuthProvider>
          <ThemeProvider>
            <I18nProvider>
              <OfflineSyncCoordinator />
              <AppRoutes />
            </I18nProvider>
          </ThemeProvider>
        </AuthProvider>
      </OfflineProvider>
    </QueryClientProvider>
  );
};

export default App;
