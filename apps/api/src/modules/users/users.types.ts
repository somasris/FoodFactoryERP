import { z } from 'zod';

export const createUserSchema = z.object({
  email: z.string().email('Invalid email address').max(100),
  username: z
    .string()
    .min(3, 'Username must be at least 3 characters')
    .max(50)
    .regex(
      /^[a-zA-Z0-9_-]+$/,
      'Username must contain only letters, numbers, hyphens, and underscores',
    ),
  password: z.string().min(8, 'Password must be at least 8 characters long'),
  fullName: z.string().min(2, 'Full name must be at least 2 characters').max(100),
  phone: z.string().max(20).optional().nullable(),
  roleCodes: z.array(z.string()).min(1, 'At least one role must be assigned'),
  companyId: z.string().uuid().optional().nullable(),
  warehouseAccess: z
    .array(
      z.object({
        warehouseId: z.string().uuid(),
        accessLevel: z.enum(['READ', 'READ_WRITE']).default('READ_WRITE'),
      }),
    )
    .optional(),
});

export const updateUserSchema = z.object({
  fullName: z.string().min(2).max(100).optional(),
  phone: z.string().max(20).optional().nullable(),
  email: z.string().email().max(100).optional(),
});

export const assignRolesSchema = z.object({
  roleCodes: z.array(z.string()).min(1, 'At least one role must be assigned'),
});

export const updateStatusSchema = z.object({
  isActive: z.boolean(),
});

export type CreateUserInput = z.infer<typeof createUserSchema>;
export type UpdateUserInput = z.infer<typeof updateUserSchema>;
export type AssignRolesInput = z.infer<typeof assignRolesSchema>;
export type UpdateStatusInput = z.infer<typeof updateStatusSchema>;
