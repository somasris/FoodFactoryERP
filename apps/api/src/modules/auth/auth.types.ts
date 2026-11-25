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

export const registerSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(2, 'Full name must be at least 2 characters long')
      .max(100, 'Full name must not exceed 100 characters'),
    email: z
      .string()
      .trim()
      .toLowerCase()
      .email('Please provide a valid email address')
      .max(100, 'Email must not exceed 100 characters'),
    password: z
      .string()
      .min(8, 'Password must be at least 8 characters long')
      .max(128, 'Password must not exceed 128 characters'),
    phoneNumber: z.string().trim().max(20).optional().nullable(),
  })
  .strict();

export type LoginInput = z.infer<typeof loginSchema>;
export type RefreshInput = z.infer<typeof refreshSchema>;
export type RegisterInput = z.infer<typeof registerSchema>;

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
