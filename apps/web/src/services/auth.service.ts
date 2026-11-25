import { apiClient, setAccessToken } from './api-client';

export interface UserProfile {
  id: string;
  email: string;
  username: string;
  fullName: string;
  phone?: string | null;
  isActive: boolean;
  companyId?: string | null;
  roles: string[];
  permissions: string[];
  warehouseAccess?: Array<{
    warehouseId: string;
    warehouseCode: string;
    warehouseName: string;
    accessLevel: string;
  }>;
}

export interface AuthResponseData {
  user: UserProfile;
  accessToken: string;
  refreshToken?: string;
}

export interface RegisterPayload {
  name: string;
  email: string;
  password: string;
  phoneNumber?: string;
}

export interface RegisterResponseData {
  id: string;
  email: string;
  fullName: string;
  isActive: boolean;
  registrationStatus: 'PENDING_APPROVAL' | 'APPROVED' | 'REJECTED';
  createdAt: string;
}

export const authService = {
  async register(payload: RegisterPayload): Promise<RegisterResponseData> {
    const response = await apiClient<RegisterResponseData>('/auth/register', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    return response.data as RegisterResponseData;
  },
  async login(usernameOrEmail: string, password: string): Promise<UserProfile> {
    const response = await apiClient<AuthResponseData>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ usernameOrEmail, password }),
    });

    if (response.data?.accessToken) {
      setAccessToken(response.data.accessToken);
    }

    if (!response.data?.user) {
      throw new Error('Invalid user payload received from server');
    }

    return response.data.user;
  },

  async refresh(): Promise<UserProfile> {
    const response = await apiClient<AuthResponseData>('/auth/refresh', {
      method: 'POST',
      body: JSON.stringify({}),
    });

    if (response.data?.accessToken) {
      setAccessToken(response.data.accessToken);
    }

    if (!response.data?.user) {
      throw new Error('Failed to refresh session');
    }

    return response.data.user;
  },

  async logout(): Promise<void> {
    try {
      await apiClient('/auth/logout', {
        method: 'POST',
        body: JSON.stringify({}),
      });
    } finally {
      setAccessToken(null);
    }
  },

  async getMe(): Promise<UserProfile> {
    const response = await apiClient<UserProfile>('/auth/me', {
      method: 'GET',
    });

    if (!response.data) {
      throw new Error('Failed to retrieve user profile');
    }

    return response.data;
  },
};
