import { z } from 'zod';

export const GSTIN_REGEX = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
export const PAN_REGEX = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/;
export const STATE_CODE_REGEX = /^[0-9]{2}$/;

export const updateOrganizationSchema = z.object({
  legalName: z.string().min(2).max(150).optional(),
  tradeName: z.string().max(150).optional().nullable(),
  gstin: z
    .string()
    .regex(GSTIN_REGEX, 'Invalid Indian GSTIN format (15 characters)')
    .optional(),
  pan: z
    .string()
    .regex(PAN_REGEX, 'Invalid Indian PAN format (10 characters)')
    .optional(),
  state: z.string().min(2).max(50).optional(),
  stateCode: z
    .string()
    .regex(STATE_CODE_REGEX, 'State code must be a 2-digit number')
    .optional(),
  email: z.string().email().max(100).optional().nullable(),
  phone: z.string().max(20).optional().nullable(),
  address: z.string().min(5).max(1000).optional(),
  logoUrl: z.string().url().max(500).optional().nullable().or(z.literal('')),
  registrationNumber: z.string().max(100).optional().nullable(),
  fssaiLicense: z.string().max(30).optional().nullable(),
  financialYearStartMonth: z.number().int().min(1).max(12).optional(),
  defaultCurrency: z.string().min(3).max(10).optional(),
  defaultTimezone: z.string().min(2).max(50).optional(),
  preferences: z.record(z.unknown()).optional().nullable(),
});

export const createFactorySchema = z.object({
  code: z
    .string()
    .min(2)
    .max(20)
    .regex(/^[A-Z0-9_-]+$/, 'Factory code must contain uppercase letters, numbers, - or _'),
  name: z.string().min(2).max(100),
  state: z.string().min(2).max(50),
  stateCode: z.string().regex(STATE_CODE_REGEX, 'State code must be a 2-digit number'),
  address: z.string().min(5).max(1000),
  email: z.string().email().max(100).optional().nullable().or(z.literal('')),
  phone: z.string().max(20).optional().nullable(),
  operationalInfo: z.record(z.unknown()).optional().nullable(),
});

export const updateFactorySchema = createFactorySchema.partial();

export const factoryStatusSchema = z.object({
  isActive: z.boolean(),
});

export const assignFactoryWarehousesSchema = z.object({
  warehouseIds: z.array(z.string().uuid()),
});

export const adminListUsersQuerySchema = z.object({
  search: z.string().optional(),
  role: z.string().optional(),
  isActive: z
    .enum(['true', 'false'])
    .transform(v => v === 'true')
    .optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const resetUserPasswordSchema = z.object({
  newPassword: z.string().min(8).max(128),
  reason: z.string().min(3).max(255).optional(),
});

export const createRoleSchema = z.object({
  code: z
    .string()
    .min(2)
    .max(30)
    .regex(/^[A-Z0-9_]+$/, 'Role code must contain uppercase letters, numbers, and underscores'),
  name: z.string().min(2).max(50),
  description: z.string().max(255).optional().nullable(),
  permissionCodes: z.array(z.string()).default([]),
});

export const updateRoleSchema = z.object({
  name: z.string().min(2).max(50).optional(),
  description: z.string().max(255).optional().nullable(),
  isActive: z.boolean().optional(),
});

export const updateRolePermissionsSchema = z.object({
  permissionCodes: z.array(z.string()),
});

export const assignUserWarehouseAccessSchema = z.object({
  assignments: z.array(
    z.object({
      warehouseId: z.string().uuid(),
      accessLevel: z.enum(['READ', 'READ_WRITE']).default('READ_WRITE'),
    }),
  ),
});

export const updateSettingsSchema = z.object({
  settings: z
    .array(
      z.object({
        key: z.string().min(2).max(100),
        value: z.string().max(1000),
        expectedVersion: z.number().int().min(1).optional(),
      }),
    )
    .min(1),
});

export type UpdateOrganizationInput = z.infer<typeof updateOrganizationSchema>;
export type CreateFactoryInput = z.infer<typeof createFactorySchema>;
export type UpdateFactoryInput = z.infer<typeof updateFactorySchema>;
export type AdminListUsersQuery = z.infer<typeof adminListUsersQuerySchema>;
export type ResetUserPasswordInput = z.infer<typeof resetUserPasswordSchema>;
export type CreateRoleInput = z.infer<typeof createRoleSchema>;
export type UpdateRoleInput = z.infer<typeof updateRoleSchema>;
export type UpdateRolePermissionsInput = z.infer<typeof updateRolePermissionsSchema>;
export type AssignUserWarehouseAccessInput = z.infer<typeof assignUserWarehouseAccessSchema>;
export type UpdateSettingsInput = z.infer<typeof updateSettingsSchema>;
