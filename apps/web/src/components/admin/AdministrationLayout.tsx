import React from 'react';
import {
  Building2,
  Factory,
  Users,
  ShieldCheck,
  Warehouse,
  Sliders,
  FileSearch,
  HeartPulse,
  HardDriveDownload,
  Wrench,
} from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { ModuleLayoutHeader } from '../common/ModuleLayoutHeader';

export const AdministrationLayout: React.FC = () => {
  const { hasPermission } = useAuth();

  const tabs = [
    { label: 'Organization', to: '/admin/organization', icon: Building2, permission: 'administration.organization.read' },
    { label: 'Factories', to: '/admin/factories', icon: Factory, permission: 'administration.factories.read' },
    { label: 'Users', to: '/admin/users', icon: Users, permission: 'administration.users.read' },
    { label: 'Roles & Permissions', to: '/admin/roles', icon: ShieldCheck, permission: 'administration.roles.read' },
    { label: 'Warehouse Access', to: '/admin/warehouse-access', icon: Warehouse, permission: 'administration.warehouse_access.read' },
    { label: 'System Settings', to: '/admin/settings', icon: Sliders, permission: 'administration.settings.read' },
    { label: 'Audit & Governance', to: '/admin/governance', icon: FileSearch, permission: 'governance.audit.read' },
    { label: 'System Health', to: '/admin/health', icon: HeartPulse, permission: 'operations.health.read' },
    { label: 'Backup & Recovery', to: '/admin/backups', icon: HardDriveDownload, permission: 'operations.backup.read' },
    { label: 'Maintenance', to: '/admin/maintenance', icon: Wrench, permission: 'operations.maintenance.manage' },
  ].filter(t => hasPermission(t.permission));

  return (
    <ModuleLayoutHeader
      title="System Administration"
      description="Organization profile, factory locations, user security, RBAC governance, system health, and operations."
      tabs={tabs}
      ariaLabel="Administration sections"
    />
  );
};
