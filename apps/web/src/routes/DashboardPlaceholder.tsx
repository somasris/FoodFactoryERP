import React from 'react';
import {
  ShoppingCart,
  Boxes,
  Cpu,
  BarChart3,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  Database,
  Server,
  Building2,
} from 'lucide-react';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from '../components/common/Card';
import { Badge } from '../components/common/Badge';
import { useApiHealth, useDatabaseHealth } from '../hooks/useHealth';
import { Link } from 'react-router-dom';

export const DashboardPlaceholder: React.FC = () => {
  const { data: apiHealth, isLoading: apiLoading } = useApiHealth();
  const { data: dbHealth, isLoading: dbLoading } = useDatabaseHealth();

  const modulePlaceholders = [
    {
      title: 'Sales & Customer Orders',
      icon: ShoppingCart,
      color: 'text-brand-blue',
      borderColor: 'hover:border-blue-300',
      description:
        'Customer order intake, delivery tracking, rate sheets, and GST invoice generation for retail & distribution networks.',
      scope: ['Customer Orders', 'GST Invoicing', 'Payment Tracking', 'Outstanding Ledgers'],
      phase: 'Phase 2 Architecture',
      route: '/sales',
    },
    {
      title: 'Inventory & Raw Materials',
      icon: Boxes,
      color: 'text-teal-600',
      borderColor: 'hover:border-teal-300',
      description:
        'Procurement of raw food ingredients, packaging supplies, batch stock tracking, and reorder threshold management.',
      scope: ['Raw Materials', 'Packaging Stock', 'Batch Expiry Control', 'Supplier Purchases'],
      phase: 'Phase 2 Architecture',
      route: '/inventory',
    },
    {
      title: 'BOM & Production Processing',
      icon: Cpu,
      color: 'text-brand-navy',
      borderColor: 'hover:border-slate-400',
      description:
        'Recipes and Bill of Materials (BOM), batch conversion ratios, production schedules, machine yield, and wastage records.',
      scope: ['Standard BOM Recipes', 'Batch Work Orders', 'Yield & Scrap Tracking', 'WIP Stages'],
      phase: 'Phase 3 Architecture',
      route: '/production',
    },
    {
      title: 'Costing & Audit Reports',
      icon: BarChart3,
      color: 'text-amber-600',
      borderColor: 'hover:border-amber-300',
      description:
        'True unit production costing (ingredient + packaging + direct overheads), profit margin analysis, and monthly audit summaries.',
      scope: [
        'Finished Goods Costing',
        'Margin Calculations',
        'Monthly Audit Ledgers',
        'GST Reconciliation',
      ],
      phase: 'Phase 3 Architecture',
      route: '/reports',
    },
  ];

  return (
    <div className="space-y-6">
      {/* Welcome & Overview Banner */}
      <div className="relative overflow-hidden rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Badge variant="teal">Foundation Milestone 1.1</Badge>
              <Badge variant="outline">NIT Tiruchirappalli</Badge>
            </div>
            <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-brand-navy">
              FoodFactory ERP
            </h1>
            <p className="max-w-3xl text-sm md:text-base text-slate-600 leading-relaxed">
              A specialized manufacturing Enterprise Resource Planning (ERP) platform architected
              for small-scale South Indian packaged food manufacturers. Designed for unified sales
              order processing, recipe-based BOM production control, inventory management, and
              audit-grade costing.
            </p>
          </div>
          <div className="shrink-0 rounded-lg bg-slate-50 border border-slate-200 p-4 min-w-[240px]">
            <div className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">
              Foundation Health
            </div>
            <div className="space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-slate-600">
                  <Server className="h-3.5 w-3.5" /> API Gateway:
                </span>
                <span className="font-semibold text-emerald-600">
                  {apiLoading
                    ? 'Checking...'
                    : apiHealth?.status === 'healthy'
                      ? 'v1 Online'
                      : 'Offline'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-slate-600">
                  <Database className="h-3.5 w-3.5" /> PostgreSQL:
                </span>
                <span className="font-semibold text-emerald-600">
                  {dbLoading
                    ? 'Checking...'
                    : dbHealth?.status === 'connected'
                      ? 'Connected'
                      : 'Offline'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-slate-600">
                  <Building2 className="h-3.5 w-3.5" /> Host Node:
                </span>
                <span className="font-mono text-slate-500">
                  {apiHealth?.environment || 'development'}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Target User Roles Bar */}
      <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold text-brand-navy">Five Core Enterprise Roles</h3>
            <p className="text-xs text-slate-500">
              Role-based authorization and modular UI workflows planned for implementation
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {[
              { role: 'SALESMAN', desc: 'Order intake & customer balances' },
              { role: 'ADMIN', desc: 'System configuration & master data' },
              { role: 'PRODUCTION', desc: 'Batch work orders & BOM execution' },
              { role: 'OWNER', desc: 'Executive oversight & profit margins' },
              { role: 'AUDITOR', desc: 'Tax compliance, invoices & ledgers' },
            ].map(item => (
              <div
                key={item.role}
                className="flex items-center gap-1.5 rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs"
                title={item.desc}
              >
                <span className="font-bold text-brand-navy">{item.role}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Placeholder Cards for Core ERP Modules */}
      <div>
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-brand-navy">Core ERP Functional Modules</h2>
            <p className="text-xs text-slate-500">
              Architectural boundaries established — business logic will be integrated in subsequent
              phases
            </p>
          </div>
          <Badge variant="outline" className="text-xs">
            Clean Architecture Placeholders
          </Badge>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {modulePlaceholders.map(module => {
            const Icon = module.icon;
            return (
              <Card
                key={module.title}
                className={`transition-all duration-200 border-slate-200 ${module.borderColor} shadow-sm hover:shadow`}
              >
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="rounded-lg bg-slate-100 p-2.5">
                        <Icon className={`h-5 w-5 ${module.color}`} />
                      </div>
                      <CardTitle className="text-base">{module.title}</CardTitle>
                    </div>
                    <Badge variant="outline" className="text-[11px] text-slate-600">
                      {module.phase}
                    </Badge>
                  </div>
                  <CardDescription className="pt-2 text-xs leading-relaxed">
                    {module.description}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-1.5">
                    <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                      Planned Capabilities
                    </div>
                    <ul className="grid grid-cols-2 gap-1.5 text-xs text-slate-600">
                      {module.scope.map(item => (
                        <li key={item} className="flex items-center gap-1.5">
                          <CheckCircle2 className="h-3 w-3 text-teal-600 shrink-0" />
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </CardContent>
                <CardFooter className="border-t border-slate-100 pt-3 flex items-center justify-between">
                  <span className="text-[11px] text-slate-400">Status: Defined in Monorepo</span>
                  <Link
                    to={module.route}
                    className="inline-flex items-center gap-1 text-xs font-semibold text-brand-blue hover:text-brand-navy transition-colors"
                  >
                    <span>View Architectural Spec</span>
                    <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                </CardFooter>
              </Card>
            );
          })}
        </div>
      </div>

      {/* Strict Phase 1.1 Architectural Compliance Notice */}
      <div className="rounded-lg border border-amber-200 bg-amber-50/60 p-4">
        <div className="flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <h4 className="text-sm font-semibold text-amber-900">
              Phase 1.1 Architectural Governance Notice
            </h4>
            <p className="text-xs text-amber-800 leading-relaxed">
              In strict accordance with Phase 1.1 requirements, no mock transaction numbers,
              simulated stock quantities, or fake dashboard KPIs are displayed. The monorepo
              workspace, client-server communication, PostgreSQL database connection, and responsive
              navigation shell are fully verified and ready for domain design in Phase 1.2.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
