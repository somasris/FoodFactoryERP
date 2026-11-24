import { useQuery } from '@tanstack/react-query';
import { healthService } from '../services/health.service';

export function useApiHealth() {
  return useQuery({
    queryKey: ['health', 'api'],
    queryFn: healthService.checkApiHealth,
    refetchInterval: 15000,
    retry: 1,
  });
}

export function useDatabaseHealth() {
  return useQuery({
    queryKey: ['health', 'database'],
    queryFn: healthService.checkDatabaseHealth,
    refetchInterval: 15000,
    retry: 1,
  });
}
