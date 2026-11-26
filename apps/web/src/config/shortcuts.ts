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
    path: '/sales/orders/new',
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
    defaultSubtitle: 'View live warehouse stock balances',
    path: '/inventory/stock',
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
    path: '/inventory/expiry',
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
    path: '/production/plans',
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
    path: '/production/quality',
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
    path: '/production/work-orders',
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
    path: '/sales/orders',
    requiredPermissions: ['sales.orders.read'],
  },
  {
    id: 'nav:executive-dashboard',
    keys: ['g d'],
    displayKeys: 'G then D',
    category: 'navigation',
    titleKey: 'navigation.Executive Dashboard',
    defaultTitle: 'Executive Dashboard',
    path: '/reports/executive',
    requiredPermissions: ['analytics.dashboard.read'],
  },
  {
    id: 'nav:activity-timeline',
    keys: ['g a'],
    displayKeys: 'G then A',
    category: 'navigation',
    titleKey: 'ux.activityTimeline',
    defaultTitle: 'Recent Activity Timeline',
    path: '/activity',
  },
];

export function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName.toLowerCase();
  if (tag === 'input' || tag === 'textarea' || tag === 'select') return true;
  if (target.isContentEditable) return true;
  return Boolean(target.closest('[contenteditable="true"]'));
}
