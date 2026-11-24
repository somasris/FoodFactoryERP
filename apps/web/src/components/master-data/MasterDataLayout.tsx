import React from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import {
  Package,
  Layers,
  FolderTree,
  Wheat,
  Tags,
  Truck,
  Users,
  Ruler,
  ArrowLeftRight,
  Percent,
  Warehouse as WarehouseIcon,
  ClipboardList,
} from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { cn } from '../../lib/utils';

interface NavTab {
  label: string;
  to: string;
  icon: React.ComponentType<{ className?: string }>;
  permission: string;
}

const masterDataTabs: NavTab[] = [
  { label: 'Products', to: '/master-data/products', icon: Package, permission: 'master_data.read' },
  {
    label: 'Product Variants',
    to: '/master-data/product-variants',
    icon: Layers,
    permission: 'master_data.read',
  },
  {
    label: 'Product Categories',
    to: '/master-data/product-categories',
    icon: FolderTree,
    permission: 'master_data.read',
  },
  {
    label: 'Raw Materials',
    to: '/master-data/raw-materials',
    icon: Wheat,
    permission: 'master_data.read',
  },
  {
    label: 'Material Categories',
    to: '/master-data/raw-material-categories',
    icon: Tags,
    permission: 'master_data.read',
  },
  { label: 'Suppliers', to: '/master-data/suppliers', icon: Truck, permission: 'suppliers.read' },
  { label: 'Customers', to: '/master-data/customers', icon: Users, permission: 'customers.read' },
  { label: 'Units (UoM)', to: '/master-data/uoms', icon: Ruler, permission: 'master_data.read' },
  {
    label: 'Unit Conversions',
    to: '/master-data/unit-conversions',
    icon: ArrowLeftRight,
    permission: 'master_data.read',
  },
  {
    label: 'Tax Config',
    to: '/master-data/tax',
    icon: Percent,
    permission: 'master_data.read',
  },
  {
    label: 'Warehouses',
    to: '/master-data/warehouses',
    icon: WarehouseIcon,
    permission: 'warehouses.read',
  },
  {
    label: 'Bill of Materials',
    to: '/master-data/boms',
    icon: ClipboardList,
    permission: 'bom.read',
  },
];

export const MasterDataLayout: React.FC = () => {
  const { hasPermission } = useAuth();
  const visibleTabs = masterDataTabs.filter(tab => hasPermission(tab.permission));

  return (
    <div className="space-y-4">
      <div className="border-b border-slate-200 bg-white px-4 pt-4 pb-3 rounded-lg shadow-sm">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-xl font-bold text-brand-navy">Master Data Management</h1>
            <p className="text-xs text-slate-500">
              Centralized source of truth for products, materials, partners, units, taxes,
              warehouses, and recipes.
            </p>
          </div>
        </div>
        <nav
          aria-label="Master data navigation"
          className="mt-3 flex flex-wrap gap-1.5 border-t border-slate-100 pt-3"
        >
          {visibleTabs.map(tab => {
            const Icon = tab.icon;
            return (
              <NavLink
                key={tab.to}
                to={tab.to}
                className={({ isActive }) =>
                  cn(
                    'inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors',
                    isActive
                      ? 'bg-brand-navy text-white shadow-sm'
                      : 'bg-slate-50 text-slate-700 hover:bg-slate-100 hover:text-brand-navy',
                  )
                }
              >
                <Icon className="h-3.5 w-3.5" />
                <span>{tab.label}</span>
              </NavLink>
            );
          })}
        </nav>
      </div>

      <Outlet />
    </div>
  );
};
