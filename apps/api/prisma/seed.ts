import { PrismaClient, WarehouseType } from '@prisma/client';
import { env } from '../src/config/env';
import { getDemoAccounts, isDemoModeEnabled } from '../src/config/demo-accounts';
import { hashPassword, validatePasswordPolicy } from '../src/utils/password';

const prisma = new PrismaClient();

// Definition of ERP Permissions
const PERMISSIONS = [
  // User Management
  {
    code: 'users.read',
    module: 'users',
    action: 'READ',
    description: 'View user accounts and profiles',
  },
  {
    code: 'users.create',
    module: 'users',
    action: 'CREATE',
    description: 'Provision new user accounts',
  },
  {
    code: 'users.update',
    module: 'users',
    action: 'UPDATE',
    description: 'Update user profiles and details',
  },
  {
    code: 'users.disable',
    module: 'users',
    action: 'UPDATE',
    description: 'Deactivate or reactivate user accounts',
  },
  {
    code: 'users.roles.assign',
    module: 'users',
    action: 'UPDATE',
    description: 'Assign or modify user roles',
  },
  {
    code: 'users.sessions.revoke',
    module: 'users',
    action: 'DELETE',
    description: 'Terminate active user sessions',
  },

  // Customer Management
  {
    code: 'customers.read',
    module: 'customers',
    action: 'READ',
    description: 'View customer accounts and directories',
  },
  {
    code: 'customers.create',
    module: 'customers',
    action: 'CREATE',
    description: 'Register new customers and retailers',
  },
  {
    code: 'customers.update',
    module: 'customers',
    action: 'UPDATE',
    description: 'Update customer contact and tax info',
  },

  // Sales Orders
  {
    code: 'sales.orders.read',
    module: 'sales',
    action: 'READ',
    description: 'View sales orders and order status',
  },
  {
    code: 'sales.orders.create',
    module: 'sales',
    action: 'CREATE',
    description: 'Draft and book sales orders',
  },
  {
    code: 'sales.orders.approve',
    module: 'sales',
    action: 'APPROVE',
    description: 'Authorize and approve sales orders',
  },
  // Phase 2 Granular Sales & Orders Permissions
  {
    code: 'sales.orders.update',
    module: 'sales',
    action: 'UPDATE',
    description: 'Edit draft or rejected sales orders',
  },
  {
    code: 'sales.orders.submit',
    module: 'sales',
    action: 'UPDATE',
    description: 'Submit draft sales orders for approval',
  },
  {
    code: 'sales.orders.reject',
    module: 'sales',
    action: 'APPROVE',
    description: 'Reject submitted sales orders',
  },
  {
    code: 'sales.orders.confirm',
    module: 'sales',
    action: 'APPROVE',
    description: 'Confirm approved sales orders and reserve stock',
  },
  {
    code: 'sales.orders.cancel',
    module: 'sales',
    action: 'CANCEL',
    description: 'Cancel sales orders and release reserved stock',
  },
  {
    code: 'sales.orders.fulfill',
    module: 'sales',
    action: 'POST',
    description: 'Fulfill confirmed sales orders via inventory issue',
  },
  {
    code: 'sales.dashboard.read',
    module: 'sales',
    action: 'READ',
    description: 'View sales dashboard metrics and order summaries',
  },
  // Phase 2.6 Granular Sales Invoicing Permissions
  {
    code: 'sales.invoices.read',
    module: 'sales',
    action: 'READ',
    description: 'View sales invoices and invoice status history',
  },
  {
    code: 'sales.invoices.create',
    module: 'sales',
    action: 'CREATE',
    description: 'Create draft sales invoices from fulfilled sales orders',
  },
  {
    code: 'sales.invoices.update',
    module: 'sales',
    action: 'UPDATE',
    description: 'Edit draft sales invoices',
  },
  {
    code: 'sales.invoices.issue',
    module: 'sales',
    action: 'APPROVE',
    description: 'Issue draft sales invoices as final GST tax invoices',
  },
  {
    code: 'sales.invoices.cancel',
    module: 'sales',
    action: 'CANCEL',
    description: 'Cancel sales invoices with mandatory reason',
  },
  {
    code: 'sales.invoices.download',
    module: 'sales',
    action: 'READ',
    description: 'Download GST sales invoice PDF documents',
  },
  // P0.1 Customer Payments & Receivables
  {
    code: 'sales.payments.read',
    module: 'sales',
    action: 'READ',
    description: 'View customer payments, receivables, and ageing reports',
  },
  {
    code: 'sales.payments.create',
    module: 'sales',
    action: 'CREATE',
    description: 'Record customer payments',
  },
  {
    code: 'sales.payments.allocate',
    module: 'sales',
    action: 'UPDATE',
    description: 'Allocate customer payments to issued invoices',
  },
  {
    code: 'sales.payments.reverse',
    module: 'sales',
    action: 'CANCEL',
    description: 'Reverse customer payments with mandatory reason',
  },
  // P0.2 GST Credit Notes
  {
    code: 'sales.credit_notes.read',
    module: 'sales',
    action: 'READ',
    description: 'View GST credit notes and customer credit balances',
  },
  {
    code: 'sales.credit_notes.create',
    module: 'sales',
    action: 'CREATE',
    description: 'Create draft GST credit notes',
  },
  {
    code: 'sales.credit_notes.issue',
    module: 'sales',
    action: 'POST',
    description: 'Issue GST credit notes against issued sales invoices',
  },
  {
    code: 'sales.credit_notes.cancel',
    module: 'sales',
    action: 'CANCEL',
    description: 'Cancel GST credit notes with mandatory reason',
  },
  {
    code: 'sales.credit_notes.download',
    module: 'sales',
    action: 'READ',
    description: 'Download GST credit note PDF documents',
  },
  // P0.3 Supplier Purchase Invoices & Purchase Register
  {
    code: 'purchases.invoices.read',
    module: 'purchases',
    action: 'READ',
    description: 'View supplier purchase invoices, receipt matches, and purchase register',
  },
  {
    code: 'purchases.invoices.create',
    module: 'purchases',
    action: 'CREATE',
    description: 'Create draft supplier purchase invoices',
  },
  {
    code: 'purchases.invoices.update',
    module: 'purchases',
    action: 'UPDATE',
    description: 'Update draft supplier purchase invoices and ITC classification',
  },
  {
    code: 'purchases.invoices.post',
    module: 'purchases',
    action: 'POST',
    description: 'Post supplier purchase invoices to purchase register',
  },
  {
    code: 'purchases.invoices.cancel',
    module: 'purchases',
    action: 'CANCEL',
    description: 'Cancel supplier purchase invoices with mandatory reason',
  },
  {
    code: 'purchases.invoices.match',
    module: 'purchases',
    action: 'UPDATE',
    description: 'Match supplier purchase invoices against inventory receipts',
  },

  // Inventory Management
  {
    code: 'inventory.read',
    module: 'inventory',
    action: 'READ',
    description: 'View stock balances and inventory transactions',
  },
  {
    code: 'inventory.adjust',
    module: 'inventory',
    action: 'UPDATE',
    description: 'Perform physical stock adjustments',
  },
  {
    code: 'inventory.transfer',
    module: 'inventory',
    action: 'CREATE',
    description: 'Transfer stock between factory warehouses',
  },
  // Phase 1.5 Stage 3 Granular Inventory Permissions
  {
    code: 'inventory.receipt.create',
    module: 'inventory',
    action: 'CREATE',
    description: 'Create and submit inventory receipt documents',
  },
  {
    code: 'inventory.receipt.approve',
    module: 'inventory',
    action: 'APPROVE',
    description: 'Approve submitted inventory receipts',
  },
  {
    code: 'inventory.receipt.post',
    module: 'inventory',
    action: 'POST',
    description: 'Post inventory receipts to stock ledger',
  },
  {
    code: 'inventory.issue.create',
    module: 'inventory',
    action: 'CREATE',
    description: 'Create and submit inventory issue documents',
  },
  {
    code: 'inventory.issue.approve',
    module: 'inventory',
    action: 'APPROVE',
    description: 'Approve submitted inventory issues',
  },
  {
    code: 'inventory.issue.post',
    module: 'inventory',
    action: 'POST',
    description: 'Post inventory issues to stock ledger',
  },
  {
    code: 'inventory.transfer.create',
    module: 'inventory',
    action: 'CREATE',
    description: 'Create warehouse transfer documents',
  },
  {
    code: 'inventory.transfer.approve',
    module: 'inventory',
    action: 'APPROVE',
    description: 'Approve warehouse transfer documents',
  },
  {
    code: 'inventory.transfer.dispatch',
    module: 'inventory',
    action: 'UPDATE',
    description: 'Dispatch approved warehouse transfers from source warehouse',
  },
  {
    code: 'inventory.transfer.receive',
    module: 'inventory',
    action: 'UPDATE',
    description: 'Receive in-transit transfers into destination warehouse',
  },
  {
    code: 'inventory.adjustment.create',
    module: 'inventory',
    action: 'CREATE',
    description: 'Create and submit inventory adjustment documents',
  },
  {
    code: 'inventory.adjustment.approve',
    module: 'inventory',
    action: 'APPROVE',
    description: 'Approve submitted inventory adjustments',
  },
  {
    code: 'inventory.adjustment.post',
    module: 'inventory',
    action: 'POST',
    description: 'Post inventory adjustments to stock ledger',
  },
  {
    code: 'inventory.valuation.read',
    module: 'inventory',
    action: 'READ',
    description: 'View inventory valuation and MWAC cost history',
  },

  // Production Management
  {
    code: 'production.read',
    module: 'production',
    action: 'READ',
    description: 'View BOMs and production runs',
  },
  {
    code: 'production.create',
    module: 'production',
    action: 'CREATE',
    description: 'Schedule and start production runs',
  },
  {
    code: 'production.complete',
    module: 'production',
    action: 'APPROVE',
    description: 'Finish batches and record good output',
  },
  // Phase 3.2 Production Planning Permissions
  {
    code: 'production.demand.read',
    module: 'production',
    action: 'READ',
    description: 'View sales demand and net production requirements',
  },
  {
    code: 'production.plans.read',
    module: 'production',
    action: 'READ',
    description: 'View production plans and material availability analysis',
  },
  {
    code: 'production.plans.create',
    module: 'production',
    action: 'CREATE',
    description: 'Create draft production plans from demand',
  },
  {
    code: 'production.plans.update',
    module: 'production',
    action: 'UPDATE',
    description: 'Edit draft or rejected production plans',
  },
  {
    code: 'production.plans.submit',
    module: 'production',
    action: 'UPDATE',
    description: 'Submit production plans for approval',
  },
  {
    code: 'production.plans.approve',
    module: 'production',
    action: 'APPROVE',
    description: 'Approve or reject submitted production plans',
  },
  {
    code: 'production.plans.release',
    module: 'production',
    action: 'APPROVE',
    description: 'Release approved production plans for work order generation',
  },
  {
    code: 'production.plans.cancel',
    module: 'production',
    action: 'CANCEL',
    description: 'Cancel eligible production plans with reason',
  },
  // Phase 3.3 Work Order Management Permissions
  {
    code: 'production.work_orders.read',
    module: 'production',
    action: 'READ',
    description: 'View work orders, schedules, and material requirements',
  },
  {
    code: 'production.work_orders.create',
    module: 'production',
    action: 'CREATE',
    description: 'Create work orders from approved or released production plans',
  },
  {
    code: 'production.work_orders.update',
    module: 'production',
    action: 'UPDATE',
    description: 'Edit draft or rejected work orders',
  },
  {
    code: 'production.work_orders.submit',
    module: 'production',
    action: 'UPDATE',
    description: 'Submit work orders for approval',
  },
  {
    code: 'production.work_orders.approve',
    module: 'production',
    action: 'APPROVE',
    description: 'Approve or reject submitted work orders',
  },
  {
    code: 'production.work_orders.release',
    module: 'production',
    action: 'APPROVE',
    description: 'Release approved work orders to the shop floor',
  },
  {
    code: 'production.work_orders.cancel',
    module: 'production',
    action: 'CANCEL',
    description: 'Cancel eligible work orders with reason',
  },
  {
    code: 'production.batches.read',
    module: 'production',
    action: 'READ',
    description: 'View production batches and execution history',
  },
  {
    code: 'production.batches.create',
    module: 'production',
    action: 'CREATE',
    description: 'Create production batches from released work orders',
  },
  {
    code: 'production.batches.execute',
    module: 'production',
    action: 'UPDATE',
    description: 'Start, pause, resume, and record output/wastage on batches',
  },
  {
    code: 'production.batches.consume',
    module: 'production',
    action: 'ISSUE',
    description: 'Record raw material consumption and reservations for batches',
  },
  {
    code: 'production.batches.complete',
    module: 'production',
    action: 'APPROVE',
    description: 'Complete production batches and receive finished goods',
  },
  {
    code: 'production.batches.cancel',
    module: 'production',
    action: 'CANCEL',
    description: 'Cancel eligible production batches with reason',
  },
  {
    code: 'production.batches.return',
    module: 'production',
    action: 'UPDATE',
    description: 'Return unused or excess consumed materials from batches',
  },
  {
    code: 'production.variances.approve',
    module: 'production',
    action: 'APPROVE',
    description: 'Approve or reject excess material consumption variances',
  },
  {
    code: 'production.quality.read',
    module: 'production',
    action: 'READ',
    description: 'View finished goods quality inspections and batch traceability',
  },
  {
    code: 'production.quality.inspect',
    module: 'production',
    action: 'UPDATE',
    description: 'Record finished goods quality inspection decisions',
  },
  {
    code: 'production.quality.release',
    module: 'production',
    action: 'APPROVE',
    description: 'Release quarantined finished goods or disposition rejected batches',
  },
  {
    code: 'production.costing.read',
    module: 'production',
    action: 'READ',
    description: 'View production batch costings and variance reports',
  },
  {
    code: 'production.costing.entry',
    module: 'production',
    action: 'CREATE',
    description: 'Record labour, machine, and overhead cost entries and calculate draft batch costs',
  },
  {
    code: 'production.costing.review',
    module: 'production',
    action: 'APPROVE',
    description: 'Approve cost entries and review calculated batch costings',
  },
  {
    code: 'production.costing.finalize',
    module: 'production',
    action: 'POST',
    description: 'Finalize batch costing and apply finished goods valuation adjustments',
  },
  {
    code: 'production.reports.read',
    module: 'production',
    action: 'READ',
    description: 'View operational production analytics and reports',
  },
  {
    code: 'production.reports.costing.read',
    module: 'production',
    action: 'READ',
    description: 'View sensitive production cost and variance analytics reports',
  },
  {
    code: 'production.reports.export',
    module: 'production',
    action: 'READ',
    description: 'Export production reports in CSV, Excel, and PDF formats',
  },

  // Procurement Management
  {
    code: 'purchases.read',
    module: 'purchases',
    action: 'READ',
    description: 'View purchase orders and goods receipts',
  },
  {
    code: 'purchases.create',
    module: 'purchases',
    action: 'CREATE',
    description: 'Raise purchase orders for ingredients and pouches',
  },
  {
    code: 'purchases.approve',
    module: 'purchases',
    action: 'APPROVE',
    description: 'Authorize purchase orders and supplier bills',
  },

  // Invoicing & GST
  {
    code: 'invoices.read',
    module: 'invoices',
    action: 'READ',
    description: 'View sales and supplier invoices',
  },
  {
    code: 'invoices.create',
    module: 'invoices',
    action: 'CREATE',
    description: 'Generate GST tax invoices',
  },
  {
    code: 'invoices.post',
    module: 'invoices',
    action: 'POST',
    description: 'Post GST invoices to tax ledgers',
  },

  // Payments & Financials
  {
    code: 'payments.read',
    module: 'payments',
    action: 'READ',
    description: 'View customer receipts and supplier disbursements',
  },
  {
    code: 'payments.record',
    module: 'payments',
    action: 'CREATE',
    description: 'Record payment collections and disbursements',
  },

  // Reports & Auditing
  {
    code: 'reports.read',
    module: 'reports',
    action: 'READ',
    description: 'Access financial, costing, and inventory reports',
  },
  {
    code: 'audit.read',
    module: 'audit',
    action: 'READ',
    description: 'Inspect immutable system security and activity logs',
  },

  // Phase 4.1 System Administration
  {
    code: 'administration.organization.read',
    module: 'administration',
    action: 'READ',
    description: 'View organization profile, GSTIN, and configuration history',
  },
  {
    code: 'administration.organization.update',
    module: 'administration',
    action: 'UPDATE',
    description: 'Update organization profile, tax registration, and preferences',
  },
  {
    code: 'administration.factories.read',
    module: 'administration',
    action: 'READ',
    description: 'View factory locations and associated warehouses',
  },
  {
    code: 'administration.factories.manage',
    module: 'administration',
    action: 'UPDATE',
    description: 'Create, update, and manage factory locations',
  },
  {
    code: 'administration.users.read',
    module: 'administration',
    action: 'READ',
    description: 'View user administration directory and activity history',
  },
  {
    code: 'administration.users.manage',
    module: 'administration',
    action: 'UPDATE',
    description: 'Manage user accounts, password resets, and security status',
  },
  {
    code: 'administration.roles.read',
    module: 'administration',
    action: 'READ',
    description: 'View roles, permissions, and role assignment history',
  },
  {
    code: 'administration.roles.manage',
    module: 'administration',
    action: 'UPDATE',
    description: 'Create custom roles and manage role permissions',
  },
  {
    code: 'administration.warehouse_access.read',
    module: 'administration',
    action: 'READ',
    description: 'View user-to-warehouse access mappings and history',
  },
  {
    code: 'administration.warehouse_access.manage',
    module: 'administration',
    action: 'UPDATE',
    description: 'Assign and revoke user warehouse access permissions',
  },
  {
    code: 'administration.settings.read',
    module: 'administration',
    action: 'READ',
    description: 'View centralized system settings and change history',
  },
  {
    code: 'administration.settings.update',
    module: 'administration',
    action: 'UPDATE',
    description: 'Update validated system configuration settings',
  },

  // Phase 4.2 Financial & Compliance Management
  {
    code: 'compliance.tax.read',
    module: 'compliance',
    action: 'READ',
    description: 'View GST, HSN, and sales/purchase tax compliance summaries',
  },
  {
    code: 'compliance.inventory.read',
    module: 'compliance',
    action: 'READ',
    description: 'View inventory valuation and movement reconciliation reports',
  },
  {
    code: 'compliance.stock_audit.read',
    module: 'compliance',
    action: 'READ',
    description: 'View physical stock audit sessions and variance details',
  },
  {
    code: 'compliance.stock_audit.create',
    module: 'compliance',
    action: 'CREATE',
    description: 'Create and submit physical stock count audit sessions',
  },
  {
    code: 'compliance.stock_audit.review',
    module: 'compliance',
    action: 'APPROVE',
    description: 'Approve, reject, and post stock audit adjustments to inventory ledger',
  },
  {
    code: 'compliance.documents.read',
    module: 'compliance',
    action: 'READ',
    description: 'View compliance document metadata and verification status',
  },
  {
    code: 'compliance.documents.manage',
    module: 'compliance',
    action: 'UPDATE',
    description: 'Register and verify compliance document metadata',
  },
  {
    code: 'compliance.export',
    module: 'compliance',
    action: 'READ',
    description: 'Export compliance, tax, valuation, and traceability reports',
  },

  // Phase 4.3 Business Intelligence & Reports
  {
    code: 'analytics.dashboard.read',
    module: 'analytics',
    action: 'READ',
    description: 'View executive KPI dashboard',
  },
  {
    code: 'analytics.sales.read',
    module: 'analytics',
    action: 'READ',
    description: 'View sales intelligence and fulfillment analytics',
  },
  {
    code: 'analytics.inventory.read',
    module: 'analytics',
    action: 'READ',
    description: 'View inventory aging, quality distribution, and valuation analytics',
  },
  {
    code: 'analytics.production.read',
    module: 'analytics',
    action: 'READ',
    description: 'View integrated production efficiency analytics',
  },
  {
    code: 'analytics.profitability.read',
    module: 'analytics',
    action: 'READ',
    description: 'View product-wise gross margin and profitability analytics',
  },
  {
    code: 'analytics.factory.read',
    module: 'analytics',
    action: 'READ',
    description: 'View factory-level performance comparison analytics',
  },
  {
    code: 'analytics.export',
    module: 'analytics',
    action: 'READ',
    description: 'Export business intelligence analytics reports',
  },

  // Phase 4.4 Audit & Governance
  {
    code: 'governance.audit.read',
    module: 'governance',
    action: 'READ',
    description: 'Inspect centralized immutable audit trail and field-level diffs',
  },
  {
    code: 'governance.audit.export',
    module: 'governance',
    action: 'READ',
    description: 'Export redacted audit trail logs',
  },
  {
    code: 'governance.approvals.read',
    module: 'governance',
    action: 'READ',
    description: 'View centralized cross-module approval governance history',
  },
  {
    code: 'governance.activity.read',
    module: 'governance',
    action: 'READ',
    description: 'Monitor user login, security alert, and configuration activity',
  },

  // Phase 4.5 System Reliability & Operations
  {
    code: 'operations.health.read',
    module: 'operations',
    action: 'READ',
    description: 'View authenticated system health, database status, and migration info',
  },
  {
    code: 'operations.monitoring.read',
    module: 'operations',
    action: 'READ',
    description: 'View API performance telemetry and redacted error logs',
  },
  {
    code: 'operations.backup.read',
    module: 'operations',
    action: 'READ',
    description: 'View backup history, verification status, and restore requests',
  },
  {
    code: 'operations.backup.create',
    module: 'operations',
    action: 'CREATE',
    description: 'Trigger and verify database backups',
  },
  {
    code: 'operations.restore.request',
    module: 'operations',
    action: 'CREATE',
    description: 'Request a controlled database restore workflow',
  },
  {
    code: 'operations.restore.approve',
    module: 'operations',
    action: 'APPROVE',
    description: 'Approve or reject controlled database restore requests',
  },
  {
    code: 'operations.maintenance.manage',
    module: 'operations',
    action: 'UPDATE',
    description: 'Enable or disable controlled application maintenance mode',
  },

  // Phase 1.4 Master Data Management
  {
    code: 'master_data.read',
    module: 'master_data',
    action: 'READ',
    description: 'View products, raw materials, units of measure, and tax configurations',
  },
  {
    code: 'master_data.create',
    module: 'master_data',
    action: 'CREATE',
    description: 'Create products, raw materials, units of measure, and tax configurations',
  },
  {
    code: 'master_data.update',
    module: 'master_data',
    action: 'UPDATE',
    description: 'Update or toggle status of master data entities',
  },
  {
    code: 'suppliers.read',
    module: 'suppliers',
    action: 'READ',
    description: 'View supplier directory and addresses',
  },
  {
    code: 'suppliers.create',
    module: 'suppliers',
    action: 'CREATE',
    description: 'Register new supplier accounts',
  },
  {
    code: 'suppliers.update',
    module: 'suppliers',
    action: 'UPDATE',
    description: 'Update supplier details, addresses, and status',
  },
  {
    code: 'warehouses.read',
    module: 'warehouses',
    action: 'READ',
    description: 'View warehouse facilities within authorized scope',
  },
  {
    code: 'warehouses.create',
    module: 'warehouses',
    action: 'CREATE',
    description: 'Create new warehouse facilities',
  },
  {
    code: 'warehouses.update',
    module: 'warehouses',
    action: 'UPDATE',
    description: 'Update warehouse details and status',
  },
  {
    code: 'bom.read',
    module: 'bom',
    action: 'READ',
    description: 'View bills of materials, versions, and overheads',
  },
  {
    code: 'bom.create',
    module: 'bom',
    action: 'CREATE',
    description: 'Create bills of materials and new BOM versions',
  },
  {
    code: 'bom.update',
    module: 'bom',
    action: 'UPDATE',
    description: 'Update draft BOM versions and BOM headers',
  },
  {
    code: 'bom.approve',
    module: 'bom',
    action: 'APPROVE',
    description: 'Activate or obsolete BOM versions',
  },
];

// Five Core ERP Roles
const ROLES = [
  {
    code: 'OWNER',
    name: 'Business Owner',
    description: 'Enterprise owner with unrestricted administrative and operational authority',
  },
  {
    code: 'ADMIN',
    name: 'System Administrator',
    description: 'System operations manager managing users, configurations, and core workflows',
  },
  {
    code: 'PRODUCTION',
    name: 'Production Incharge',
    description: 'Plant supervisor overseeing batch execution, recipes, and warehouse transfers',
  },
  {
    code: 'SALESMAN',
    name: 'Field Sales Representative',
    description: 'Sales representative handling retailer accounts and order booking',
  },
  {
    code: 'AUDITOR',
    name: 'Compliance Auditor',
    description: 'Independent auditor with strictly enforced read-only access to records and logs',
  },
];

// Mappings of Permissions per Role
const ROLE_PERMISSIONS_MAP: Record<string, string[]> = {
  OWNER: PERMISSIONS.map(p => p.code), // Universal permissions
  ADMIN: [
    'users.read',
    'users.create',
    'users.update',
    'users.disable',
    'users.roles.assign',
    'users.sessions.revoke',
    'customers.read',
    'customers.create',
    'customers.update',
    'sales.orders.read',
    'sales.orders.create',
    'sales.orders.update',
    'sales.orders.submit',
    'sales.orders.approve',
    'sales.orders.reject',
    'sales.orders.confirm',
    'sales.orders.cancel',
    'sales.orders.fulfill',
    'sales.dashboard.read',
    'sales.invoices.read',
    'sales.invoices.create',
    'sales.invoices.update',
    'sales.invoices.issue',
    'sales.invoices.cancel',
    'sales.invoices.download',
    'sales.payments.read',
    'sales.payments.create',
    'sales.payments.allocate',
    'sales.payments.reverse',
    'sales.credit_notes.read',
    'sales.credit_notes.create',
    'sales.credit_notes.issue',
    'sales.credit_notes.cancel',
    'sales.credit_notes.download',
    'purchases.invoices.read',
    'purchases.invoices.create',
    'purchases.invoices.update',
    'purchases.invoices.post',
    'purchases.invoices.cancel',
    'purchases.invoices.match',
    'inventory.read',
    'inventory.adjust',
    'inventory.transfer',
    'inventory.receipt.create',
    'inventory.receipt.approve',
    'inventory.receipt.post',
    'inventory.issue.create',
    'inventory.issue.approve',
    'inventory.issue.post',
    'inventory.transfer.create',
    'inventory.transfer.approve',
    'inventory.transfer.dispatch',
    'inventory.transfer.receive',
    'inventory.adjustment.create',
    'inventory.adjustment.approve',
    'inventory.adjustment.post',
    'inventory.valuation.read',
    'production.read',
    'production.create',
    'production.complete',
    'production.demand.read',
    'production.plans.read',
    'production.work_orders.read',
    'production.plans.create',
    'production.plans.update',
    'production.plans.submit',
    'production.plans.release',
    'production.plans.cancel',
    'production.work_orders.read',
    'production.work_orders.create',
    'production.work_orders.update',
    'production.work_orders.submit',
    'production.work_orders.approve',
    'production.work_orders.release',
    'production.work_orders.cancel',
    'production.batches.read',
    'production.batches.create',
    'production.batches.execute',
    'production.batches.consume',
    'production.batches.complete',
    'production.batches.cancel',
    'production.batches.return',
    'production.variances.approve',
    'production.quality.read',
    'production.quality.inspect',
    'production.quality.release',
    'production.costing.read',
    'production.costing.entry',
    'production.costing.review',
    'production.costing.finalize',
    'production.reports.read',
    'production.reports.costing.read',
    'production.reports.export',
    'purchases.read',
    'purchases.create',
    'purchases.approve',
    'invoices.read',
    'invoices.create',
    'invoices.post',
    'payments.read',
    'payments.record',
    'reports.read',
    'audit.read',
    'master_data.read',
    'master_data.create',
    'master_data.update',
    'suppliers.read',
    'suppliers.create',
    'suppliers.update',
    'warehouses.read',
    'warehouses.create',
    'warehouses.update',
    'bom.read',
    'bom.create',
    'bom.update',
    'bom.approve',
    // Phase 4.1 System Administration
    'administration.organization.read',
    'administration.organization.update',
    'administration.factories.read',
    'administration.factories.manage',
    'administration.users.read',
    'administration.users.manage',
    'administration.roles.read',
    'administration.roles.manage',
    'administration.warehouse_access.read',
    'administration.warehouse_access.manage',
    'administration.settings.read',
    'administration.settings.update',
    // Phase 4.2 Compliance
    'compliance.tax.read',
    'compliance.inventory.read',
    'compliance.stock_audit.read',
    'compliance.stock_audit.create',
    'compliance.stock_audit.review',
    'compliance.documents.read',
    'compliance.documents.manage',
    'compliance.export',
    // Phase 4.3 Analytics
    'analytics.dashboard.read',
    'analytics.sales.read',
    'analytics.inventory.read',
    'analytics.production.read',
    'analytics.profitability.read',
    'analytics.factory.read',
    'analytics.export',
    // Phase 4.4 Governance
    'governance.audit.read',
    'governance.audit.export',
    'governance.approvals.read',
    'governance.activity.read',
    // Phase 4.5 Operations
    'operations.health.read',
    'operations.monitoring.read',
    'operations.backup.read',
    'operations.backup.create',
    'operations.restore.request',
    'operations.restore.approve',
    'operations.maintenance.manage',
  ],
  PRODUCTION: [
    'production.read',
    'production.create',
    'production.complete',
    'production.demand.read',
    'production.plans.read',
    'production.work_orders.read',
    'production.plans.create',
    'production.plans.update',
    'production.plans.submit',
    'production.plans.release',
    'production.plans.cancel',
    'production.work_orders.read',
    'production.work_orders.create',
    'production.work_orders.update',
    'production.work_orders.submit',
    'production.work_orders.release',
    'production.work_orders.cancel',
    'production.batches.read',
    'production.batches.create',
    'production.batches.execute',
    'production.batches.consume',
    'production.batches.complete',
    'production.batches.cancel',
    'production.batches.return',
    'production.quality.read',
    'production.quality.inspect',
    'production.costing.read',
    'production.costing.entry',
    'production.reports.read',
    'production.reports.export',
    'sales.orders.read',
    'sales.orders.fulfill',
    'sales.dashboard.read',
    'inventory.read',
    'inventory.transfer',
    'inventory.transfer.create',
    'inventory.transfer.dispatch',
    'inventory.transfer.receive',
    'master_data.read',
    'warehouses.read',
    'bom.read',
    'bom.create',
    'bom.update',
    // Phase 4.2 Compliance (Inventory & Stock Audit Count Creation)
    'compliance.inventory.read',
    'compliance.stock_audit.read',
    'compliance.stock_audit.create',
    'compliance.documents.read',
    // Phase 4.3 Production & Inventory Analytics (no profitability/sales)
    'analytics.production.read',
    'analytics.inventory.read',
    'analytics.factory.read',
  ],
  SALESMAN: [
    'customers.read',
    'customers.create',
    'customers.update',
    'sales.orders.read',
    'sales.orders.create',
    'sales.orders.update',
    'sales.orders.submit',
    'sales.orders.cancel',
    'sales.dashboard.read',
    'sales.invoices.read',
    'sales.invoices.create',
    'sales.invoices.update',
    'sales.invoices.download',
    'sales.payments.read',
    'sales.payments.create',
    'sales.payments.allocate',
    'sales.credit_notes.read',
    'sales.credit_notes.download',
    'production.demand.read',
    'inventory.read',
    'master_data.read',
    'warehouses.read',
    // Phase 4.3 Sales Analytics only
    'analytics.sales.read',
  ],
  AUDITOR: [
    // Strictly read-only
    'users.read',
    'customers.read',
    'sales.orders.read',
    'sales.dashboard.read',
    'sales.invoices.read',
    'sales.invoices.download',
    'sales.payments.read',
    'sales.credit_notes.read',
    'sales.credit_notes.download',
    'purchases.invoices.read',
    'inventory.read',
    'inventory.valuation.read',
    'production.read',
    'production.demand.read',
    'production.plans.read',
    'production.work_orders.read',
    'production.batches.read',
    'production.quality.read',
    'production.costing.read',
    'production.reports.read',
    'production.reports.costing.read',
    'production.reports.export',
    'purchases.read',
    'invoices.read',
    'payments.read',
    'reports.read',
    'audit.read',
    'master_data.read',
    'suppliers.read',
    'warehouses.read',
    'bom.read',
    // Phase 4.1 System Administration (Read-Only)
    'administration.organization.read',
    'administration.factories.read',
    'administration.users.read',
    'administration.roles.read',
    'administration.warehouse_access.read',
    'administration.settings.read',
    // Phase 4.2 Compliance (Read-Only)
    'compliance.tax.read',
    'compliance.inventory.read',
    'compliance.stock_audit.read',
    'compliance.documents.read',
    'compliance.export',
    // Phase 4.3 Business Intelligence (Read-Only)
    'analytics.dashboard.read',
    'analytics.sales.read',
    'analytics.inventory.read',
    'analytics.production.read',
    'analytics.profitability.read',
    'analytics.factory.read',
    'analytics.export',
    // Phase 4.4 Governance
    'governance.audit.read',
    'governance.audit.export',
    'governance.approvals.read',
    'governance.activity.read',
    // Phase 4.5 Operations (Read-Only)
    'operations.health.read',
    'operations.monitoring.read',
    'operations.backup.read',
  ],
};

async function main() {
  console.info('🌱 Starting Phase 1.3 Foundation & Security Seeder...');

  // 1. Maintain System Configurations
  await prisma.systemConfig.upsert({
    where: { key: 'SYSTEM_STATUS' },
    update: { value: 'INITIALIZED' },
    create: {
      key: 'SYSTEM_STATUS',
      value: 'INITIALIZED',
      description: 'System initialization status for FoodFactory ERP Foundation',
    },
  });

  await prisma.systemConfig.upsert({
    where: { key: 'FOUNDATION_PHASE' },
    update: { value: 'PHASE_1.3' },
    create: {
      key: 'FOUNDATION_PHASE',
      value: 'PHASE_1.3',
      description: 'Current foundation milestone for NIT Tiruchirappalli internship project',
    },
  });

  // 2. Seed Base Organization & Benchmark Facilities
  console.info('  -> Seeding benchmark enterprise organization...');
  const company = await prisma.company.upsert({
    where: { code: 'COMP-01' },
    update: {},
    create: {
      code: 'COMP-01',
      legalName: 'South Indian Food Works Pvt Ltd',
      tradeName: 'FoodFactory South India',
      gstin: '33AAACF1234M1Z5',
      pan: 'AAACF1234M',
      state: 'Tamil Nadu',
      stateCode: '33',
      email: 'contact@southindianfoodworks.com',
      phone: '+91 431 2500000',
      address: 'Industrial Estate, Thuvakudi, Tiruchirappalli, Tamil Nadu 620015',
    },
  });

  const factory = await prisma.factory.upsert({
    where: { code: 'FAC-TRICHY-01' },
    update: {},
    create: {
      companyId: company.id,
      code: 'FAC-TRICHY-01',
      name: 'Trichy Packaged Foods Plant',
      state: 'Tamil Nadu',
      stateCode: '33',
      address: 'Plot 42, Thuvakudi Industrial Complex, NIT Post, Tiruchirappalli',
    },
  });

  const whRM = await prisma.warehouse.upsert({
    where: { code: 'WH-RM-01' },
    update: {},
    create: {
      factoryId: factory.id,
      code: 'WH-RM-01',
      name: 'Main Raw Material Warehouse',
      warehouseType: WarehouseType.RAW_MATERIAL,
      address: 'Bay A, Trichy Plant',
    },
  });

  const whPKG = await prisma.warehouse.upsert({
    where: { code: 'WH-PKG-01' },
    update: {},
    create: {
      factoryId: factory.id,
      code: 'WH-PKG-01',
      name: 'Packaging Materials Warehouse',
      warehouseType: WarehouseType.PACKAGING,
      address: 'Bay B, Trichy Plant',
    },
  });

  const whFG = await prisma.warehouse.upsert({
    where: { code: 'WH-FG-01' },
    update: {},
    create: {
      factoryId: factory.id,
      code: 'WH-FG-01',
      name: 'Finished Goods Warehouse',
      warehouseType: WarehouseType.FINISHED_GOODS,
      address: 'Dispatch Bay C, Trichy Plant',
    },
  });

  // 3. Seed Permissions
  console.info(`  -> Seeding ${PERMISSIONS.length} granular permissions...`);
  const permissionRecordMap = new Map<string, string>();
  for (const perm of PERMISSIONS) {
    const record = await prisma.permission.upsert({
      where: { code: perm.code },
      update: {
        module: perm.module,
        action: perm.action,
        description: perm.description,
      },
      create: {
        code: perm.code,
        module: perm.module,
        action: perm.action,
        description: perm.description,
      },
    });
    permissionRecordMap.set(perm.code, record.id);
  }

  // 4. Seed Five Roles
  console.info(`  -> Seeding 5 core roles...`);
  const roleRecordMap = new Map<string, string>();
  for (const role of ROLES) {
    const record = await prisma.role.upsert({
      where: { code: role.code },
      update: {
        name: role.name,
        description: role.description,
        isActive: true,
      },
      create: {
        code: role.code,
        name: role.name,
        description: role.description,
        isActive: true,
      },
    });
    roleRecordMap.set(role.code, record.id);
  }

  // 5. Seed Role-Permission Mappings
  console.info('  -> Seeding role-permission mappings...');
  for (const [roleCode, permCodes] of Object.entries(ROLE_PERMISSIONS_MAP)) {
    const roleId = roleRecordMap.get(roleCode);
    if (!roleId) continue;

    for (const permCode of permCodes) {
      const permissionId = permissionRecordMap.get(permCode);
      if (!permissionId) continue;

      await prisma.rolePermission.upsert({
        where: {
          roleId_permissionId: {
            roleId,
            permissionId,
          },
        },
        update: {},
        create: {
          roleId,
          permissionId,
        },
      });
    }
  }

  // 6. Seed Initial OWNER Account if configured via Environment Variables
  const ownerEmail = env.INITIAL_OWNER_EMAIL?.trim().toLowerCase();
  const ownerPassword = env.INITIAL_OWNER_PASSWORD;
  const ownerUsername = (env.INITIAL_OWNER_USERNAME || 'owner').trim().toLowerCase();
  const ownerFullName = (env.INITIAL_OWNER_FULLNAME || 'Managing Director').trim();

  if (ownerEmail && ownerPassword) {
    console.info(`  -> Provisioning initial OWNER account (${ownerEmail})...`);
    const policyResult = validatePasswordPolicy(ownerPassword);
    if (!policyResult.isValid) {
      throw new Error(`Initial OWNER password policy failure: ${policyResult.reason}`);
    }

    const ownerRole = await prisma.role.findUnique({ where: { code: 'OWNER' } });

    if (!ownerRole) {
      throw new Error('OWNER role not found during initial owner provisioning');
    }

    const existingUser = await prisma.user.findFirst({
      where: {
        OR: [
          { email: { equals: ownerEmail, mode: 'insensitive' } },
          { username: { equals: ownerUsername, mode: 'insensitive' } },
        ],
      },
    });

    let ownerUserId = existingUser?.id;

    if (!existingUser) {
      const passwordHash = await hashPassword(ownerPassword);
      const user = await prisma.user.create({
        data: {
          companyId: company.id,
          email: ownerEmail,
          username: ownerUsername,
          passwordHash,
          fullName: ownerFullName,
          isActive: true,
          registrationStatus: 'APPROVED',
          userRoles: {
            create: {
              roleId: ownerRole.id,
            },
          },
        },
      });
      ownerUserId = user.id;
      console.info(`  ✅ Initial OWNER account created successfully: ${ownerEmail}`);
    } else {
      // Ensure existing account is active/approved and has OWNER role without overwriting password
      await prisma.$transaction(async tx => {
        if (!existingUser.isActive || existingUser.registrationStatus !== 'APPROVED') {
          await tx.user.update({
            where: { id: existingUser.id },
            data: { isActive: true, registrationStatus: 'APPROVED' },
          });
        }
        await tx.userRole.upsert({
          where: {
            userId_roleId: {
              userId: existingUser.id,
              roleId: ownerRole.id,
            },
          },
          update: {},
          create: {
            userId: existingUser.id,
            roleId: ownerRole.id,
          },
        });
      });
      console.info(`  ℹ️ Existing user ${ownerEmail} verified with OWNER role.`);
    }

    // Grant access to all warehouses
    if (ownerUserId) {
      for (const wh of [whRM, whPKG, whFG]) {
        await prisma.userWarehouseAccess.upsert({
          where: {
            userId_warehouseId: {
              userId: ownerUserId,
              warehouseId: wh.id,
            },
          },
          update: { accessLevel: 'READ_WRITE' },
          create: {
            userId: ownerUserId,
            warehouseId: wh.id,
            accessLevel: 'READ_WRITE',
          },
        });
      }
    }
  } else {
    console.info(
      '  ℹ️ INITIAL_OWNER_EMAIL and INITIAL_OWNER_PASSWORD not set. Skipping owner user creation.',
    );
  }

  // 5b. Provision Development Demo Accounts (STRICTLY non-production + DEMO_MODE_ENABLED=true)
  if (isDemoModeEnabled()) {
    const demoAccounts = getDemoAccounts();
    for (const demo of demoAccounts) {
      const role = await prisma.role.findUnique({ where: { code: demo.role } });
      if (!role) continue;

      const existingDemo = await prisma.user.findFirst({
        where: {
          OR: [{ email: demo.email.toLowerCase() }, { username: demo.username.toLowerCase() }],
        },
        include: {
          userRoles: true,
        },
      });

      // Never overwrite an existing user's password; only repair missing demo role assignment when role is active
      if (!existingDemo) {
        if (!role.isActive) continue;
        const demoHash = await hashPassword(demo.password);
        const createdDemo = await prisma.user.create({
          data: {
            companyId: company.id,
            email: demo.email.toLowerCase(),
            username: demo.username.toLowerCase(),
            passwordHash: demoHash,
            fullName: demo.fullName,
            isActive: true,
            registrationStatus: 'APPROVED',
            userRoles: {
              create: { roleId: role.id },
            },
          },
        });

        const warehousesForRole =
          demo.role === 'SALESMAN'
            ? [{ wh: whFG, level: 'READ' as const }]
            : demo.role === 'AUDITOR'
              ? [
                  { wh: whRM, level: 'READ' as const },
                  { wh: whPKG, level: 'READ' as const },
                  { wh: whFG, level: 'READ' as const },
                ]
              : [
                  { wh: whRM, level: 'READ_WRITE' as const },
                  { wh: whPKG, level: 'READ_WRITE' as const },
                  { wh: whFG, level: 'READ_WRITE' as const },
                ];

        for (const item of warehousesForRole) {
          await prisma.userWarehouseAccess.upsert({
            where: {
              userId_warehouseId: { userId: createdDemo.id, warehouseId: item.wh.id },
            },
            update: {},
            create: {
              userId: createdDemo.id,
              warehouseId: item.wh.id,
              accessLevel: item.level,
            },
          });
        }
        console.info(`  ✅ Demo ${demo.role} account created: ${demo.email}`);
      } else if (role.isActive) {
        const hasTargetRole = existingDemo.userRoles.some(ur => ur.roleId === role.id);
        if (!hasTargetRole) {
          await prisma.$transaction(async tx => {
            await tx.userRole.upsert({
              where: {
                userId_roleId: { userId: existingDemo.id, roleId: role.id },
              },
              update: {},
              create: {
                userId: existingDemo.id,
                roleId: role.id,
              },
            });
          });
          console.info(`  🔧 Restored missing ${demo.role} role assignment for demo account: ${demo.email}`);
        }
      }
    }
  }

  console.info('✅ Phase 1.3 database seed completed successfully!');

  // 6. Seed Baseline Master Data (Units of Measure & Standard GST Tax Rates)
  const defaultUoms = [
    { code: 'KG', name: 'Kilogram', symbol: 'kg', category: 'WEIGHT', isBaseUnit: true, decimalPlaces: 3 },
    { code: 'G', name: 'Gram', symbol: 'g', category: 'WEIGHT', isBaseUnit: false, decimalPlaces: 2 },
    { code: 'L', name: 'Litre', symbol: 'L', category: 'VOLUME', isBaseUnit: true, decimalPlaces: 3 },
    { code: 'ML', name: 'Millilitre', symbol: 'mL', category: 'VOLUME', isBaseUnit: false, decimalPlaces: 2 },
    { code: 'PCS', name: 'Pieces', symbol: 'pcs', category: 'COUNT', isBaseUnit: true, decimalPlaces: 0 },
    { code: 'BOX', name: 'Box', symbol: 'box', category: 'COUNT', isBaseUnit: false, decimalPlaces: 0 },
  ];

  for (const uom of defaultUoms) {
    await prisma.unitOfMeasure.upsert({
      where: { code: uom.code },
      update: {},
      create: uom,
    });
  }

  const defaultTaxRates = [
    {
      code: 'GST_0',
      name: 'GST 0% (Exempt)',
      ratePercentage: '0.00',
      cgstPercentage: '0.00',
      sgstPercentage: '0.00',
      igstPercentage: '0.00',
    },
    {
      code: 'GST_5',
      name: 'GST 5%',
      ratePercentage: '5.00',
      cgstPercentage: '2.50',
      sgstPercentage: '2.50',
      igstPercentage: '5.00',
    },
    {
      code: 'GST_12',
      name: 'GST 12%',
      ratePercentage: '12.00',
      cgstPercentage: '6.00',
      sgstPercentage: '6.00',
      igstPercentage: '12.00',
    },
    {
      code: 'GST_18',
      name: 'GST 18%',
      ratePercentage: '18.00',
      cgstPercentage: '9.00',
      sgstPercentage: '9.00',
      igstPercentage: '18.00',
    },
  ];

  for (const tax of defaultTaxRates) {
    await prisma.taxRate.upsert({
      where: { code: tax.code },
      update: {},
      create: tax,
    });
  }

  console.info('✅ Phase 1.4 baseline master data seed completed successfully!');
}

main()
  .catch(e => {
    console.error('❌ Error during database seeding:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
