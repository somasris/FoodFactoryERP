import React from 'react';
import {
  LayoutDashboard,
  ClipboardList,
  CalendarRange,
  TrendingUp,
  Factory,
  BarChart3,
  PlayCircle,
  Layers,
  Scale,
  ShieldCheck,
  GitBranch,
  Calculator,
  FileSpreadsheet,
} from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { ModuleLayoutHeader } from '../common/ModuleLayoutHeader';

export const ProductionLayout: React.FC = () => {
  const { hasPermission } = useAuth();

  const tabs = [
    { label: 'Planning Dashboard', to: '/production/planning', icon: LayoutDashboard, permission: 'production.plans.read' },
    { label: 'Demand & MRP', to: '/production/demand', icon: TrendingUp, permission: 'production.demand.read' },
    { label: 'Production Plans', to: '/production/plans', icon: CalendarRange, permission: 'production.plans.read' },
    { label: 'Work Orders', to: '/production/work-orders', icon: Factory, permission: 'production.work_orders.read', end: true },
    { label: 'WO Dashboard', to: '/production/work-orders/dashboard', icon: BarChart3, permission: 'production.work_orders.read' },
    { label: 'Execution', to: '/production/execution', icon: PlayCircle, permission: 'production.batches.read' },
    { label: 'Batches', to: '/production/batches', icon: Layers, permission: 'production.batches.read' },
    { label: 'Reconciliation', to: '/production/reconciliation', icon: Scale, permission: 'production.batches.read' },
    { label: 'Quality', to: '/production/quality', icon: ShieldCheck, permission: 'production.quality.read' },
    { label: 'Traceability', to: '/production/traceability', icon: GitBranch, permission: 'production.batches.read' },
    { label: 'Costing', to: '/production/costing', icon: Calculator, permission: 'production.costing.read' },
    { label: 'Analytics & Reports', to: '/production/reports', icon: FileSpreadsheet, permission: 'production.reports.read' },
    { label: 'BOM & Recipes', to: '/production/boms', icon: ClipboardList, permission: 'bom.read' },
  ].filter(t => hasPermission(t.permission));

  return (
    <ModuleLayoutHeader
      title="Production"
      tabs={tabs}
      ariaLabel="Production navigation"
    />
  );
};
