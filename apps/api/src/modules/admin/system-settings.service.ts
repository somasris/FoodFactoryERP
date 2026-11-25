import { Prisma } from '@prisma/client';
import { prisma } from '../../services/prisma.service';
import { AppError } from '../../middleware/error.middleware';
import { NotificationEventsService } from '../notifications/notification-events.service';
import { UpdateSettingsInput } from './admin.types';
import { AdminActorMeta } from './organization.service';

export type SettingCategory =
  | 'GENERAL'
  | 'INVENTORY'
  | 'PRODUCTION'
  | 'SALES'
  | 'TAX'
  | 'NOTIFICATIONS'
  | 'SECURITY';

export interface SettingDefinition {
  key: string;
  category: SettingCategory;
  valueType: 'STRING' | 'NUMBER' | 'BOOLEAN';
  defaultValue: string;
  description: string;
  validate: (val: string) => boolean;
  validationMessage: string;
}

const isPositiveNumber = (v: string) => !Number.isNaN(Number(v)) && Number(v) > 0;
const isNonNegativeNumber = (v: string) => !Number.isNaN(Number(v)) && Number(v) >= 0;
const isBooleanString = (v: string) => v === 'true' || v === 'false';

export const SETTING_DEFINITIONS: SettingDefinition[] = [
  // GENERAL
  {
    key: 'GENERAL_DEFAULT_TIMEZONE',
    category: 'GENERAL',
    valueType: 'STRING',
    defaultValue: 'Asia/Kolkata',
    description: 'Default business timezone for reporting and scheduling',
    validate: v => v.trim().length >= 3 && v.trim().length <= 50,
    validationMessage: 'Timezone must be a valid IANA timezone string (3-50 chars)',
  },
  {
    key: 'GENERAL_DEFAULT_CURRENCY',
    category: 'GENERAL',
    valueType: 'STRING',
    defaultValue: 'INR',
    description: 'Default ERP currency code',
    validate: v => /^[A-Z]{3}$/.test(v),
    validationMessage: 'Currency must be a 3-letter uppercase ISO code (e.g. INR)',
  },
  {
    key: 'GENERAL_FY_START_MONTH',
    category: 'GENERAL',
    valueType: 'NUMBER',
    defaultValue: '4',
    description: 'Financial year start month (4 = April for Indian FY)',
    validate: v => Number.isInteger(Number(v)) && Number(v) >= 1 && Number(v) <= 12,
    validationMessage: 'Financial year start month must be an integer between 1 and 12',
  },
  // INVENTORY
  {
    key: 'INVENTORY_DEFAULT_WAREHOUSE_CODE',
    category: 'INVENTORY',
    valueType: 'STRING',
    defaultValue: 'WH-RM-01',
    description: 'Default warehouse code for inventory operations',
    validate: v => v.trim().length >= 2 && v.trim().length <= 30,
    validationMessage: 'Warehouse code must be 2-30 characters',
  },
  {
    key: 'INVENTORY_LOW_STOCK_ALERT_THRESHOLD',
    category: 'INVENTORY',
    valueType: 'NUMBER',
    defaultValue: '50',
    description: 'Default minimum stock alert threshold when item reorder level is unset',
    validate: isNonNegativeNumber,
    validationMessage: 'Low stock alert threshold must be a non-negative number',
  },
  {
    key: 'INVENTORY_EXPIRY_ALERT_DAYS',
    category: 'INVENTORY',
    valueType: 'NUMBER',
    defaultValue: '30',
    description: 'Days before batch expiry to trigger near-expiry alerts',
    validate: v => Number.isInteger(Number(v)) && Number(v) >= 1 && Number(v) <= 365,
    validationMessage: 'Expiry alert days must be an integer between 1 and 365',
  },
  // PRODUCTION
  {
    key: 'PRODUCTION_VARIANCE_THRESHOLD_PERCENT',
    category: 'PRODUCTION',
    valueType: 'NUMBER',
    defaultValue: '5',
    description: 'Percentage threshold above which material consumption variance requires approval',
    validate: v => isNonNegativeNumber(v) && Number(v) <= 100,
    validationMessage: 'Variance threshold must be between 0 and 100',
  },
  {
    key: 'PRODUCTION_REQUIRE_QUALITY_INSPECTION',
    category: 'PRODUCTION',
    valueType: 'BOOLEAN',
    defaultValue: 'true',
    description: 'Require finished goods quality inspection before batches become saleable',
    validate: isBooleanString,
    validationMessage: 'Must be "true" or "false"',
  },
  // SALES
  {
    key: 'SALES_INVOICE_NUMBER_PREFIX',
    category: 'SALES',
    valueType: 'STRING',
    defaultValue: 'INV',
    description: 'Prefix for generated GST sales invoice numbers',
    validate: v => /^[A-Z0-9-]{2,10}$/.test(v),
    validationMessage: 'Invoice prefix must be 2-10 uppercase alphanumeric characters',
  },
  {
    key: 'SALES_ORDER_AUTO_RESERVE_ON_CONFIRM',
    category: 'SALES',
    valueType: 'BOOLEAN',
    defaultValue: 'true',
    description: 'Automatically reserve finished goods stock upon sales order confirmation',
    validate: isBooleanString,
    validationMessage: 'Must be "true" or "false"',
  },
  // TAX
  {
    key: 'TAX_DEFAULT_GST_RATE_PERCENT',
    category: 'TAX',
    valueType: 'NUMBER',
    defaultValue: '5',
    description: 'Default GST rate percentage reference for packaged food items',
    validate: v => [0, 5, 12, 18, 28].includes(Number(v)),
    validationMessage: 'Default GST rate must be a standard slab (0, 5, 12, 18, or 28)',
  },
  {
    key: 'TAX_EFFECTIVE_FROM_DATE',
    category: 'TAX',
    valueType: 'STRING',
    defaultValue: '2026-04-01',
    description: 'Applicable effective date for current tax configuration (YYYY-MM-DD)',
    validate: v => /^\d{4}-\d{2}-\d{2}$/.test(v),
    validationMessage: 'Effective date must be in YYYY-MM-DD format',
  },
  // NOTIFICATIONS
  {
    key: 'NOTIFICATIONS_EMAIL_ENABLED',
    category: 'NOTIFICATIONS',
    valueType: 'BOOLEAN',
    defaultValue: 'false',
    description: 'Enable email notifications for critical alerts and approvals',
    validate: isBooleanString,
    validationMessage: 'Must be "true" or "false"',
  },
  {
    key: 'NOTIFICATIONS_LOW_STOCK_ALERTS',
    category: 'NOTIFICATIONS',
    valueType: 'BOOLEAN',
    defaultValue: 'true',
    description: 'Enable system alerts for low stock and expiring batches',
    validate: isBooleanString,
    validationMessage: 'Must be "true" or "false"',
  },
  // SECURITY
  {
    key: 'SECURITY_SESSION_TIMEOUT_MINUTES',
    category: 'SECURITY',
    valueType: 'NUMBER',
    defaultValue: '60',
    description: 'Inactivity session timeout warning threshold in minutes',
    validate: v => isPositiveNumber(v) && Number(v) >= 5 && Number(v) <= 1440,
    validationMessage: 'Session timeout must be between 5 and 1440 minutes',
  },
  {
    key: 'SECURITY_PASSWORD_MIN_LENGTH',
    category: 'SECURITY',
    valueType: 'NUMBER',
    defaultValue: '8',
    description: 'Minimum required password length (minimum enforced floor: 8)',
    validate: v => Number.isInteger(Number(v)) && Number(v) >= 8 && Number(v) <= 64,
    validationMessage: 'Password minimum length must be an integer between 8 and 64',
  },
];

const DEFINITION_MAP = new Map(SETTING_DEFINITIONS.map(d => [d.key, d]));

export class SystemSettingsService {
  /**
   * Ensure all whitelisted settings exist in system_configs and return them grouped/filtered.
   */
  static async listSettings(category?: string) {
    const existing = await prisma.systemConfig.findMany({
      where: {
        key: { in: SETTING_DEFINITIONS.map(d => d.key) },
      },
      include: {
        updatedBy: { select: { id: true, username: true, fullName: true } },
      },
    });

    const existingMap = new Map(existing.map(e => [e.key, e]));
    const missing = SETTING_DEFINITIONS.filter(d => !existingMap.has(d.key));

    if (missing.length > 0) {
      await prisma.systemConfig.createMany({
        data: missing.map(d => ({
          key: d.key,
          value: d.defaultValue,
          category: d.category,
          valueType: d.valueType,
          description: d.description,
          version: 1,
        })),
        skipDuplicates: true,
      });
    }

    const allConfigs = await prisma.systemConfig.findMany({
      where: {
        key: { in: SETTING_DEFINITIONS.map(d => d.key) },
        ...(category ? { category: category.toUpperCase() } : {}),
      },
      include: {
        updatedBy: { select: { id: true, username: true, fullName: true } },
      },
      orderBy: [{ category: 'asc' }, { key: 'asc' }],
    });

    const grouped: Record<string, typeof allConfigs> = {};
    for (const cfg of allConfigs) {
      if (!grouped[cfg.category]) grouped[cfg.category] = [];
      grouped[cfg.category].push(cfg);
    }

    return {
      items: allConfigs,
      grouped,
    };
  }

  /**
   * Update validated system settings with optimistic concurrency check and AuditLog.
   */
  static async updateSettings(input: UpdateSettingsInput, actor: AdminActorMeta) {
    // Validate keys and values upfront
    for (const item of input.settings) {
      const def = DEFINITION_MAP.get(item.key);
      if (!def) {
        throw new AppError(
          `Setting key '${item.key}' is not a permitted configurable system setting.`,
          400,
        );
      }
      if (!def.validate(item.value)) {
        throw new AppError(`Invalid value for '${item.key}': ${def.validationMessage}`, 400);
      }
    }

    // Ensure defaults exist before transaction
    await this.listSettings();

    const updatedItems = await prisma.$transaction(async tx => {
      const results = [];

      for (const item of input.settings) {
        const current = await tx.systemConfig.findUnique({
          where: { key: item.key },
        });
        if (!current) {
          throw new AppError(`Setting '${item.key}' not found.`, 404);
        }

        if (item.expectedVersion !== undefined && current.version !== item.expectedVersion) {
          throw new AppError(
            `Concurrency conflict for setting '${item.key}': expected version ${item.expectedVersion}, found ${current.version}. Please reload and try again.`,
            409,
          );
        }

        if (current.value === item.value) {
          results.push(current);
          continue;
        }

        // Atomic conditional update with version increment
        const updateRes = await tx.systemConfig.updateMany({
          where: {
            key: item.key,
            version: current.version,
          },
          data: {
            value: item.value,
            version: { increment: 1 },
            updatedById: actor.userId,
          },
        });

        if (updateRes.count === 0) {
          throw new AppError(
            `Concurrent modification detected for setting '${item.key}'. Please retry.`,
            409,
          );
        }

        const saved = await tx.systemConfig.findUnique({
          where: { key: item.key },
          include: {
            updatedBy: { select: { id: true, username: true, fullName: true } },
          },
        });

        await tx.auditLog.create({
          data: {
            userId: actor.userId,
            action: 'UPDATE',
            entityType: 'SystemConfig',
            entityId: current.id,
            previousState: { key: current.key, value: current.value, version: current.version },
            newState: { key: current.key, value: item.value, version: current.version + 1 },
            remarks: `System setting '${current.key}' updated by ${actor.username}`,
            ipAddress: actor.ipAddress || null,
            userAgent: actor.userAgent || null,
          },
        });

        if (saved) results.push(saved);
      }

      return results;
    });

    await NotificationEventsService.onSystemSettingsChanged(input.settings.map(s => s.key));

    return updatedItems;
  }

  static async getSettingsHistory(page = 1, limit = 20) {
    const skip = (page - 1) * limit;
    const where: Prisma.AuditLogWhereInput = { entityType: 'SystemConfig' };

    const [items, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        include: {
          user: { select: { id: true, username: true, fullName: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.auditLog.count({ where }),
    ]);

    return {
      items,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 1,
      },
    };
  }
}
