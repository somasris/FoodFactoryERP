import { env } from './env';

export type DemoRoleCode = 'OWNER' | 'ADMIN' | 'SALESMAN' | 'PRODUCTION' | 'AUDITOR';

export interface DemoAccountConfig {
  role: DemoRoleCode;
  label: string;
  description: string;
  email: string;
  username: string;
  fullName: string;
  password: string;
}

/**
 * Demo mode is strictly prohibited in production environments.
 * In development, it defaults to enabled unless explicitly set to DEMO_MODE_ENABLED=false.
 * In test, it is enabled only when DEMO_MODE_ENABLED=true.
 */
export function isDemoModeEnabled(): boolean {
  if (env.NODE_ENV === 'production') {
    return false;
  }
  if (env.DEMO_MODE_ENABLED !== undefined) {
    return env.DEMO_MODE_ENABLED === true;
  }
  return env.NODE_ENV === 'development';
}

/**
 * Centralized development/demo account configuration.
 * Never uses production administrator credentials.
 * Returns an empty list whenever demo mode is disabled or NODE_ENV === 'production'.
 */
export function getDemoAccounts(): DemoAccountConfig[] {
  if (!isDemoModeEnabled()) {
    return [];
  }

  const demoPassword = env.DEMO_DEFAULT_PASSWORD || 'DemoFactory2026!';

  return [
    {
      role: 'OWNER',
      label: 'OWNER Demo',
      description: 'Executive oversight, financials, approvals & full platform access',
      email: env.DEMO_OWNER_EMAIL || 'demo.owner@foodfactory.local',
      username: 'demo_owner',
      fullName: 'Demo Business Owner',
      password: demoPassword,
    },
    {
      role: 'ADMIN',
      label: 'ADMIN Demo',
      description: 'Administration, user management, master data & operational control',
      email: env.DEMO_ADMIN_EMAIL || 'demo.admin@foodfactory.local',
      username: 'demo_admin',
      fullName: 'Demo System Admin',
      password: demoPassword,
    },
    {
      role: 'SALESMAN',
      label: 'SALESMAN Demo',
      description: 'Sales orders, customers, and GST invoicing workflows',
      email: env.DEMO_SALESMAN_EMAIL || 'demo.salesman@foodfactory.local',
      username: 'demo_salesman',
      fullName: 'Demo Field Salesman',
      password: demoPassword,
    },
    {
      role: 'PRODUCTION',
      label: 'PRODUCTION Demo',
      description: 'BOMs, planning, work orders, batch execution & quality control',
      email: env.DEMO_PRODUCTION_EMAIL || 'demo.production@foodfactory.local',
      username: 'demo_production',
      fullName: 'Demo Production Manager',
      password: demoPassword,
    },
    {
      role: 'AUDITOR',
      label: 'AUDITOR Demo',
      description: 'Strictly read-only compliance reports, audit trail & governance',
      email: env.DEMO_AUDITOR_EMAIL || 'demo.auditor@foodfactory.local',
      username: 'demo_auditor',
      fullName: 'Demo Compliance Auditor',
      password: demoPassword,
    },
  ];
}
