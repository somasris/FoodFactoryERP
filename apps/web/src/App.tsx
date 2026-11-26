import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from './context/AuthContext';
import { OfflineProvider } from './context/OfflineContext';
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
          <OfflineSyncCoordinator />
          <AppRoutes />
        </AuthProvider>
      </OfflineProvider>
    </QueryClientProvider>
  );
};

export default App;
