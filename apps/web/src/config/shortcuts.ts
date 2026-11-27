import { ROUTES } from './routes';

export interface ShortcutDefinition {
  id: string;
  keys: string[];
  displayKeys: string;
  category: 'general' | 'navigation' | 'actions';
  titleKey: string;
  defaultTitle: string;
  subtitleKey?: string;
  defaultSubtitle?: string;
  path?: string;
  requiredPermissions?: string[];
  /** True if this entry appears in Command Center Quick Actions */
  quickAction?: boolean;
}

export const SHORTCUT_DEFINITIONS: ShortcutDefinition[] = [
  {
    id: 'global:command-center',
    keys: ['ctrl+k', 'meta+k'],
    displayKeys: 'Ctrl+K / ⌘K',
    category: 'general',
    titleKey: 'shortcuts.openCommandCenter',
    defaultTitle: 'Open Command Center',
  },
  {
    id: 'global:shortcuts-help',
    keys: ['?'],
    displayKeys: '?',
    category: 'general',
    titleKey: 'shortcuts.showShortcutsHelp',
    defaultTitle: 'Show Keyboard Shortcuts',
  },
  {
    id: 'act:new-so',
    keys: ['c s'],
    displayKeys: 'C then S',
    category: 'actions',
    titleKey: 'commandCenter.createSalesOrder',
    defaultTitle: 'Create Sales Order',
    defaultSubtitle: 'Open new sales order draft form',
    path: ROUTES.SALES_ORDER_NEW,
    requiredPermissions: ['sales.orders.create'],
    quickAction: true,
  },
  {
    id: 'act:open-inventory',
    keys: ['g i'],
    displayKeys: 'G then I',
    category: 'navigation',
    titleKey: 'commandCenter.openInventory',
    defaultTitle: 'Open Inventory',
    defaultSubtitle: 'View live warehouse stock overview',
    path: ROUTES.INVENTORY_DASHBOARD,
    requiredPermissions: ['inventory.read'],
    quickAction: true,
  },
  {
    id: 'act:expiring-stock',
    keys: ['g e'],
    displayKeys: 'G then E',
    category: 'navigation',
    titleKey: 'commandCenter.viewExpiringStock',
    defaultTitle: 'View Expiring Stock',
    defaultSubtitle: 'Review batches nearing expiry',
    path: ROUTES.INVENTORY_BATCH_EXPIRY,
    requiredPermissions: ['inventory.read'],
    quickAction: true,
  },
  {
    id: 'act:production-calendar',
    keys: ['g p'],
    displayKeys: 'G then P',
    category: 'navigation',
    titleKey: 'commandCenter.openProductionCalendar',
    defaultTitle: 'Open Production Calendar',
    defaultSubtitle: 'View production plans and schedules',
    path: ROUTES.PRODUCTION_PLANS,
    requiredPermissions: ['production.plans.read'],
    quickAction: true,
  },
  {
    id: 'act:pending-qc',
    keys: ['g q'],
    displayKeys: 'G then Q',
    category: 'navigation',
    titleKey: 'commandCenter.viewPendingQuality',
    defaultTitle: 'View Pending Quality Inspections',
    defaultSubtitle: 'Inspect batches awaiting quality decision',
    path: ROUTES.PRODUCTION_QUALITY,
    requiredPermissions: ['production.quality.read'],
    quickAction: true,
  },
  {
    id: 'act:work-orders',
    keys: ['g w'],
    displayKeys: 'G then W',
    category: 'navigation',
    titleKey: 'commandCenter.openWorkOrders',
    defaultTitle: 'Open Work Orders',
    defaultSubtitle: 'Manage factory work orders',
    path: ROUTES.PRODUCTION_WORK_ORDERS,
    requiredPermissions: ['production.work_orders.read'],
    quickAction: true,
  },
  {
    id: 'nav:sales-orders',
    keys: ['g s'],
    displayKeys: 'G then S',
    category: 'navigation',
    titleKey: 'navigation.Sales Orders',
    defaultTitle: 'Sales Orders',
    path: ROUTES.SALES_ORDERS,
    requiredPermissions: ['sales.orders.read'],
  },
  {
    id: 'nav:executive-dashboard',
    keys: ['g d'],
    displayKeys: 'G then D',
    category: 'navigation',
    titleKey: 'navigation.Executive Dashboard',
    defaultTitle: 'Executive Dashboard',
    path: ROUTES.EXECUTIVE_DASHBOARD,
    requiredPermissions: ['analytics.dashboard.read'],
  },
  {
    id: 'nav:activity-timeline',
    keys: ['g a'],
    displayKeys: 'G then A',
    category: 'navigation',
    titleKey: 'ux.activityTimeline',
    defaultTitle: 'Recent Activity Timeline',
    path: ROUTES.ACTIVITY_TIMELINE,
  },
];

export function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName.toLowerCase();
  if (tag === 'input' || tag === 'textarea' || tag === 'select') return true;
  if (target.isContentEditable) return true;
  return Boolean(target.closest('[contenteditable="true"]'));
}
