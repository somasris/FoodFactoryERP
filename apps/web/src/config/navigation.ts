import { UserProfile } from '../services/auth.service';
import {
  LayoutDashboard,
  ShoppingCart,
  Boxes,
  Cpu,
  Database,
  ShieldCheck,
  Settings,
  LucideIcon,
} from 'lucide-react';

export interface NavItemConfig {
  label: string;
  path: string;
  requiredPermissions?: string[];
  anyPermission?: string[];
}

export interface NavGroupConfig {
  id: string;
  label: string;
  icon: LucideIcon;
  basePath: string;
  items: NavItemConfig[];
}

export const NAV_GROUPS: NavGroupConfig[] = [
  {
    id: 'overview',
    label: 'Executive & BI',
    icon: LayoutDashboard,
    basePath: '/reports',
    items: [
      {
        label: 'Executive Dashboard',
        path: '/reports/executive',
        requiredPermissions: ['analytics.dashboard.read'],
      },
      {
        label: 'Business Intelligence',
        path: '/reports/bi',
        anyPermission: [
          'analytics.sales.read',
          'analytics.inventory.read',
          'analytics.production.read',
          'analytics.profitability.read',
          'analytics.factory.read',
        ],
      },
    ],
  },
  {
    id: 'sales',
    label: 'Sales & Orders',
    icon: ShoppingCart,
    basePath: '/sales',
    items: [
      {
        label: 'Sales Dashboard',
        path: '/sales/dashboard',
        requiredPermissions: ['sales.dashboard.read'],
      },
      {
        label: 'Sales Orders',
        path: '/sales/orders',
        requiredPermissions: ['sales.orders.read'],
      },
      {
        label: 'Pending Approvals',
        path: '/sales/approvals',
        anyPermission: ['sales.orders.approve', 'sales.orders.reject'],
      },
      {
        label: 'Order Fulfillment',
        path: '/sales/fulfillment',
        requiredPermissions: ['sales.orders.fulfill'],
      },
      {
        label: 'Sales Invoices',
        path: '/sales/invoices',
        requiredPermissions: ['sales.invoices.read'],
      },
    ],
  },
  {
    id: 'production',
    label: 'Production & Quality',
    icon: Cpu,
    basePath: '/production',
    items: [
      {
        label: 'Execution Dashboard',
        path: '/production/execution',
        requiredPermissions: ['production.batches.read'],
      },
      {
        label: 'Live Factory Pulse',
        path: '/production/factory-pulse',
        requiredPermissions: ['production.batches.read'],
      },
      {
        label: 'Production Planning',
        path: '/production/planning',
        requiredPermissions: ['production.plans.read'],
      },
      {
        label: 'Demand & MRP',
        path: '/production/demand',
        requiredPermissions: ['production.demand.read'],
      },
      {
        label: 'Work Orders',
        path: '/production/work-orders',
        requiredPermissions: ['production.work_orders.read'],
      },
      {
        label: 'Production Batches',
        path: '/production/batches',
        requiredPermissions: ['production.batches.read'],
      },
      {
        label: 'Material Reconciliation',
        path: '/production/reconciliation',
        requiredPermissions: ['production.batches.read'],
      },
      {
        label: 'Quality Inspections',
        path: '/production/quality',
        requiredPermissions: ['production.quality.read'],
      },
      {
        label: 'Batch Traceability',
        path: '/production/traceability',
        requiredPermissions: ['production.batches.read'],
      },
      {
        label: 'Production Costing',
        path: '/production/costing',
        requiredPermissions: ['production.costing.read'],
      },
      {
        label: 'Production Analytics',
        path: '/production/reports',
        requiredPermissions: ['production.reports.read'],
      },
    ],
  },
  {
    id: 'inventory',
    label: 'Inventory & Stock',
    icon: Boxes,
    basePath: '/inventory',
    items: [
      {
        label: 'Inventory Dashboard',
        path: '/inventory/dashboard',
        requiredPermissions: ['inventory.read'],
      },
      {
        label: 'Stock Balances',
        path: '/inventory/balances',
        requiredPermissions: ['inventory.read'],
      },
      {
        label: 'Receipts',
        path: '/inventory/receipts',
        requiredPermissions: ['inventory.read'],
      },
      {
        label: 'Issues',
        path: '/inventory/issues',
        requiredPermissions: ['inventory.read'],
      },
      {
        label: 'Warehouse Transfers',
        path: '/inventory/transfers',
        requiredPermissions: ['inventory.read'],
      },
      {
        label: 'Stock Adjustments',
        path: '/inventory/adjustments',
        requiredPermissions: ['inventory.read'],
      },
      {
        label: 'Batch Expiry',
        path: '/inventory/batches',
        requiredPermissions: ['inventory.read'],
      },
      {
        label: 'Inventory Valuation',
        path: '/inventory/valuation',
        requiredPermissions: ['inventory.valuation.read'],
      },
      {
        label: 'Transaction Ledger',
        path: '/inventory/transactions',
        requiredPermissions: ['inventory.read'],
      },
      {
        label: 'Warehouse Layout',
        path: '/inventory/warehouse-layout',
        requiredPermissions: ['inventory.read'],
      },
      {
        label: 'Zones & Bins',
        path: '/inventory/zones-bins',
        requiredPermissions: ['inventory.read'],
      },
      {
        label: 'Location Stock',
        path: '/inventory/location-stock',
        requiredPermissions: ['inventory.read'],
      },
      {
        label: 'Barcode Labels',
        path: '/inventory/barcodes',
        requiredPermissions: ['inventory.read'],
      },
      {
        label: 'Scan Operations',
        path: '/inventory/scan',
        requiredPermissions: ['inventory.read'],
      },
      {
        label: 'Put-Away',
        path: '/inventory/put-away',
        requiredPermissions: ['inventory.transfer.create'],
      },
      {
        label: 'Picking (FEFO)',
        path: '/inventory/picking',
        requiredPermissions: ['inventory.issue.create'],
      },
      {
        label: 'Bin Transfers',
        path: '/inventory/bin-transfers',
        requiredPermissions: ['inventory.transfer.create'],
      },
      {
        label: 'Cycle Counts',
        path: '/inventory/cycle-counts',
        requiredPermissions: ['compliance.stock_audit.read'],
      },
      {
        label: 'Warehouse Analytics',
        path: '/inventory/analytics',
        requiredPermissions: ['inventory.read'],
      },
    ],
  },
  {
    id: 'master-data',
    label: 'Master Data',
    icon: Database,
    basePath: '/master-data',
    items: [
      {
        label: 'Products',
        path: '/master-data/products',
        requiredPermissions: ['master_data.read'],
      },
      {
        label: 'Product Variants',
        path: '/master-data/product-variants',
        requiredPermissions: ['master_data.read'],
      },
      {
        label: 'Raw Materials',
        path: '/master-data/raw-materials',
        requiredPermissions: ['master_data.read'],
      },
      {
        label: 'BOMs & Recipes',
        path: '/master-data/boms',
        anyPermission: ['bom.read', 'master_data.read'],
      },
      {
        label: 'Customers',
        path: '/master-data/customers',
        requiredPermissions: ['customers.read'],
      },
      {
        label: 'Suppliers',
        path: '/master-data/suppliers',
        anyPermission: ['suppliers.read', 'master_data.read'],
      },
      {
        label: 'Warehouses',
        path: '/master-data/warehouses',
        anyPermission: ['warehouses.read', 'master_data.read'],
      },
      {
        label: 'UOM & Conversions',
        path: '/master-data/uoms',
        requiredPermissions: ['master_data.read'],
      },
      {
        label: 'Tax Configuration',
        path: '/master-data/tax',
        requiredPermissions: ['master_data.read'],
      },
    ],
  },
  {
    id: 'compliance',
    label: 'Compliance & Audit',
    icon: ShieldCheck,
    basePath: '/reports',
    items: [
      {
        label: 'Financial Compliance',
        path: '/reports/compliance',
        anyPermission: ['compliance.tax.read', 'compliance.documents.read'],
      },
      {
        label: 'Stock Audits',
        path: '/reports/stock-audit',
        requiredPermissions: ['compliance.stock_audit.read'],
      },
      {
        label: 'Audit & Governance',
        path: '/admin/governance',
        requiredPermissions: ['governance.audit.read'],
      },
    ],
  },
  {
    id: 'admin',
    label: 'Administration',
    icon: Settings,
    basePath: '/admin',
    items: [
      {
        label: 'Organization',
        path: '/admin/organization',
        requiredPermissions: ['administration.organization.read'],
      },
      {
        label: 'Factories',
        path: '/admin/factories',
        requiredPermissions: ['administration.factories.read'],
      },
      {
        label: 'Users',
        path: '/admin/users',
        anyPermission: ['administration.users.read', 'users.read'],
      },
      {
        label: 'Roles & Permissions',
        path: '/admin/roles',
        requiredPermissions: ['administration.roles.read'],
      },
      {
        label: 'Warehouse Access',
        path: '/admin/warehouse-access',
        requiredPermissions: ['administration.warehouse_access.read'],
      },
      {
        label: 'System Settings',
        path: '/admin/settings',
        requiredPermissions: ['administration.settings.read'],
      },
      {
        label: 'System Health',
        path: '/admin/health',
        requiredPermissions: ['operations.health.read'],
      },
      {
        label: 'Backups & Recovery',
        path: '/admin/backups',
        requiredPermissions: ['operations.backup.read'],
      },
      {
        label: 'Maintenance Mode',
        path: '/admin/maintenance',
        requiredPermissions: ['operations.maintenance.manage'],
      },
    ],
  },
];

export function userHasPermission(user: UserProfile | null, permissionCode: string): boolean {
  if (!user) return false;
  if (user.roles.includes('OWNER')) return true;
  return user.permissions.includes(permissionCode);
}

export function canAccessNavItem(user: UserProfile | null, item: NavItemConfig): boolean {
  if (!user) return false;
  if (user.roles.includes('OWNER')) return true;
  if (item.requiredPermissions && item.requiredPermissions.length > 0) {
    return item.requiredPermissions.every(p => userHasPermission(user, p));
  }
  if (item.anyPermission && item.anyPermission.length > 0) {
    return item.anyPermission.some(p => userHasPermission(user, p));
  }
  return true;
}

/**
 * Resolve the role-specific default landing dashboard path based on database roles & permissions.
 * Falls back to the first authorized route if a role lacks access to its primary destination.
 */
export function getDefaultDashboardPath(user: UserProfile | null): string {
  if (!user) return '/login';

  const roles = user.roles || [];

  const roleCandidates: string[] = [];
  if (roles.includes('OWNER')) {
    roleCandidates.push('/reports/executive', '/admin/organization');
  } else if (roles.includes('ADMIN')) {
    roleCandidates.push('/admin/organization', '/reports/executive');
  } else if (roles.includes('SALESMAN')) {
    roleCandidates.push('/sales/dashboard', '/sales/orders');
  } else if (roles.includes('PRODUCTION')) {
    roleCandidates.push('/production/execution', '/production/planning', '/production/work-orders');
  } else if (roles.includes('AUDITOR')) {
    roleCandidates.push('/admin/governance', '/reports/executive', '/reports/compliance');
  }

  for (const candidate of roleCandidates) {
    if (canAccessPath(user, candidate)) {
      return candidate;
    }
  }

  // Fallback to first authorized nav item across all groups
  for (const group of NAV_GROUPS) {
    for (const item of group.items) {
      if (canAccessNavItem(user, item)) {
        return item.path;
      }
    }
  }

  return '/unauthorized';
}

/**
 * Validate whether an authenticated user is authorized to access a target path (e.g. deep link).
 */
export function canAccessPath(user: UserProfile | null, pathname: string): boolean {
  if (!user) return false;
  if (user.roles.includes('OWNER')) return true;

  const cleanPath = pathname.split('?')[0];
  if (cleanPath === '/' || cleanPath === '/dashboard' || cleanPath === '/unauthorized' || cleanPath === '/activity') {
    return true;
  }

  for (const group of NAV_GROUPS) {
    for (const item of group.items) {
      if (cleanPath === item.path || cleanPath.startsWith(`${item.path}/`)) {
        return canAccessNavItem(user, item);
      }
    }
  }

  // Prefix-based module fallback for nested detail/form routes not explicitly listed
  if (cleanPath.startsWith('/sales/invoices')) {
    return userHasPermission(user, 'sales.invoices.read');
  }
  if (cleanPath.startsWith('/sales')) {
    return userHasPermission(user, 'sales.orders.read') || userHasPermission(user, 'sales.dashboard.read');
  }
  if (cleanPath.startsWith('/production/costing')) {
    return userHasPermission(user, 'production.costing.read');
  }
  if (cleanPath.startsWith('/production/reports')) {
    return userHasPermission(user, 'production.reports.read');
  }
  if (cleanPath.startsWith('/production/boms')) {
    return userHasPermission(user, 'bom.read');
  }
  if (cleanPath.startsWith('/production')) {
    return (
      userHasPermission(user, 'production.read') ||
      userHasPermission(user, 'production.batches.read') ||
      userHasPermission(user, 'production.plans.read') ||
      userHasPermission(user, 'production.work_orders.read')
    );
  }
  if (cleanPath === '/inventory/valuation' || cleanPath.startsWith('/inventory/valuation/')) {
    return userHasPermission(user, 'inventory.valuation.read');
  }
  if (cleanPath.startsWith('/inventory')) {
    return userHasPermission(user, 'inventory.read');
  }
  if (cleanPath.startsWith('/master-data/product-categories') || cleanPath.startsWith('/master-data/raw-material-categories') || cleanPath.startsWith('/master-data/unit-conversions')) {
    return userHasPermission(user, 'master_data.read');
  }
  if (cleanPath.startsWith('/master-data')) {
    return userHasPermission(user, 'master_data.read') || userHasPermission(user, 'customers.read');
  }
  if (cleanPath.startsWith('/reports/executive')) {
    return userHasPermission(user, 'analytics.dashboard.read');
  }
  if (cleanPath.startsWith('/reports/bi')) {
    return (
      userHasPermission(user, 'analytics.sales.read') ||
      userHasPermission(user, 'analytics.inventory.read') ||
      userHasPermission(user, 'analytics.production.read') ||
      userHasPermission(user, 'analytics.profitability.read') ||
      userHasPermission(user, 'analytics.factory.read')
    );
  }
  if (cleanPath.startsWith('/reports/stock-audit')) {
    return userHasPermission(user, 'compliance.stock_audit.read');
  }
  if (cleanPath.startsWith('/reports')) {
    return (
      userHasPermission(user, 'compliance.tax.read') ||
      userHasPermission(user, 'compliance.inventory.read') ||
      userHasPermission(user, 'compliance.documents.read')
    );
  }
  if (cleanPath.startsWith('/admin/maintenance')) {
    return userHasPermission(user, 'operations.maintenance.manage');
  }
  if (cleanPath.startsWith('/admin')) {
    return userHasPermission(user, 'administration.organization.read') || userHasPermission(user, 'governance.audit.read');
  }

  return false;
}

/**
 * Resolve the first authorized route within a module base path for index redirects.
 */
export function getModuleIndexPath(user: UserProfile | null, basePath: string): string {
  if (!user) return '/login';

  for (const group of NAV_GROUPS) {
    if (group.basePath !== basePath) continue;
    for (const item of group.items) {
      if (item.path.startsWith(basePath) && canAccessNavItem(user, item)) {
        return item.path;
      }
    }
  }

  return '/unauthorized';
}
