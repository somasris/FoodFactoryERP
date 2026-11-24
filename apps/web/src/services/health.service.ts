import { apiClient } from './api-client';
import { ApiHealthData, DatabaseHealthData } from '../types/api';

export const healthService = {
  checkApiHealth: async () => {
    const response = await apiClient<ApiHealthData>('/health');
    return response.data;
  },

  checkDatabaseHealth: async () => {
    const response = await apiClient<DatabaseHealthData>('/health/database');
    return response.data;
  },
};
