import React from 'react';
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
import { ModuleLayoutHeader } from '../common/ModuleLayoutHeader';

const masterDataTabs = [
  { label: 'Products', to: '/master-data/products', icon: Package, permission: 'master_data.read' },
  { label: 'Product Variants', to: '/master-data/product-variants', icon: Layers, permission: 'master_data.read' },
  { label: 'Product Categories', to: '/master-data/product-categories', icon: FolderTree, permission: 'master_data.read' },
  { label: 'Raw Materials', to: '/master-data/raw-materials', icon: Wheat, permission: 'master_data.read' },
  { label: 'Material Categories', to: '/master-data/raw-material-categories', icon: Tags, permission: 'master_data.read' },
  { label: 'Suppliers', to: '/master-data/suppliers', icon: Truck, permission: 'suppliers.read' },
  { label: 'Customers', to: '/master-data/customers', icon: Users, permission: 'customers.read' },
  { label: 'Units (UoM)', to: '/master-data/uoms', icon: Ruler, permission: 'master_data.read' },
  { label: 'Unit Conversions', to: '/master-data/unit-conversions', icon: ArrowLeftRight, permission: 'master_data.read' },
  { label: 'Tax Config', to: '/master-data/tax', icon: Percent, permission: 'master_data.read' },
  { label: 'Warehouses', to: '/master-data/warehouses', icon: WarehouseIcon, permission: 'warehouses.read' },
  { label: 'Bill of Materials', to: '/master-data/boms', icon: ClipboardList, permission: 'bom.read' },
];

export const MasterDataLayout: React.FC = () => {
  const { hasPermission } = useAuth();
  const visibleTabs = masterDataTabs.filter(tab => hasPermission(tab.permission));

  return (
    <ModuleLayoutHeader
      title="Master Data"
      tabs={visibleTabs}
      ariaLabel="Master data navigation"
    />
  );
};
