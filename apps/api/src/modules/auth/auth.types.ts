import { z } from 'zod';

export const loginSchema = z.object({
  usernameOrEmail: z
    .string()
    .min(3, 'Username or email must be at least 3 characters long')
    .max(100, 'Username or email must not exceed 100 characters'),
  password: z.string().min(1, 'Password is required'),
});

export const refreshSchema = z.object({
  refreshToken: z.string().optional(),
});

export type LoginInput = z.infer<typeof loginSchema>;
export type RefreshInput = z.infer<typeof refreshSchema>;

export interface AuthUserData {
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

export interface AuthResult {
  user: AuthUserData;
  accessToken: string;
  refreshToken: string;
}
