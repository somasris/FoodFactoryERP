import { createBrowserRouter } from 'react-router-dom';
import { AppShell } from '../components/layout/AppShell';
import { ProtectedRoute } from '../components/auth/ProtectedRoute';
import { RoleDashboardRedirect, ModuleIndexRedirect } from '../components/auth/RoleDashboardRedirect';
import { LoginPage } from './LoginPage';
import { UnauthorizedPage } from './UnauthorizedPage';
import { NotFoundPage } from './NotFoundPage';
import { SyncCenterPage } from './SyncCenterPage';
import { MasterDataLayout } from '../components/master-data/MasterDataLayout';
import { ProductsPage } from './master-data/ProductsPage';
import { ProductVariantsPage } from './master-data/ProductVariantsPage';
import { CategoryMasterPage } from './master-data/CategoryMasterPage';
import { RawMaterialsPage } from './master-data/RawMaterialsPage';
import { SuppliersPage } from './master-data/SuppliersPage';
import { CustomersPage } from './master-data/CustomersPage';
import { UomsPage } from './master-data/UomsPage';
import { UnitConversionsPage } from './master-data/UnitConversionsPage';
import { TaxPage } from './master-data/TaxPage';
import { WarehousesPage } from './master-data/WarehousesPage';
import { BomsPage } from './master-data/BomsPage';
import { InventoryLayout } from '../components/inventory/InventoryLayout';
import { InventoryDashboardPage } from './inventory/InventoryDashboardPage';
import { StockBalancesPage } from './inventory/StockBalancesPage';
import { InventoryReceiptsPage } from './inventory/InventoryReceiptsPage';
import { InventoryIssuesPage } from './inventory/InventoryIssuesPage';
import { WarehouseTransfersPage } from './inventory/WarehouseTransfersPage';
import { StockAdjustmentsPage } from './inventory/StockAdjustmentsPage';
import { BatchExpiryPage } from './inventory/BatchExpiryPage';
import { InventoryValuationPage } from './inventory/InventoryValuationPage';
import { InventoryTransactionsPage } from './inventory/InventoryTransactionsPage';
import { SalesLayout } from '../components/sales/SalesLayout';
import { SalesDashboardPage } from './sales/SalesDashboardPage';
import { SalesOrdersPage } from './sales/SalesOrdersPage';
import { SalesOrderFormPage } from './sales/SalesOrderFormPage';
import { SalesOrderDetailPage } from './sales/SalesOrderDetailPage';
import { PendingApprovalsPage } from './sales/PendingApprovalsPage';
import { OrderFulfillmentPage } from './sales/OrderFulfillmentPage';
import { SalesInvoicesPage } from './sales/SalesInvoicesPage';
import { SalesInvoiceDetailPage } from './sales/SalesInvoiceDetailPage';
import { SalesInvoiceFormPage } from './sales/SalesInvoiceFormPage';
import { ProductionLayout } from '../components/production/ProductionLayout';
import { ProductionPlanningDashboardPage } from './production/ProductionPlanningDashboardPage';
import { ProductionDemandPage } from './production/ProductionDemandPage';
import { ProductionPlansPage } from './production/ProductionPlansPage';
import { ProductionPlanDetailPage } from './production/ProductionPlanDetailPage';
import { WorkOrdersDashboardPage } from './production/WorkOrdersDashboardPage';
import { WorkOrdersPage } from './production/WorkOrdersPage';
import { WorkOrderFormPage } from './production/WorkOrderFormPage';
import { WorkOrderDetailPage } from './production/WorkOrderDetailPage';
import { ProductionExecutionDashboardPage } from './production/ProductionExecutionDashboardPage';
import { ProductionBatchesPage } from './production/ProductionBatchesPage';
import { ProductionBatchDetailPage } from './production/ProductionBatchDetailPage';
import { MaterialReconciliationPage } from './production/MaterialReconciliationPage';
import { QualityInspectionsPage } from './production/QualityInspectionsPage';
import { BatchTraceabilityPage } from './production/BatchTraceabilityPage';
import { ProductionCostingDashboardPage } from './production/ProductionCostingDashboardPage';
import { BatchCostingDetailPage } from './production/BatchCostingDetailPage';
import { CostVarianceReportPage } from './production/CostVarianceReportPage';
import { ProductionAnalyticsDashboardPage } from './production/ProductionAnalyticsDashboardPage';
import { ProductionPlanVsActualPage } from './production/ProductionPlanVsActualPage';
import { WorkOrderPerformanceReportPage } from './production/WorkOrderPerformanceReportPage';
import { BatchYieldReportPage } from './production/BatchYieldReportPage';
import { MaterialConsumptionReportPage } from './production/MaterialConsumptionReportPage';
import { ProductionQualityReportPage } from './production/ProductionQualityReportPage';
import { ProductionCostAnalyticsPage } from './production/ProductionCostAnalyticsPage';
import { AdministrationLayout } from '../components/admin/AdministrationLayout';
import { OrganizationPage } from './admin/OrganizationPage';
import { FactoriesPage } from './admin/FactoriesPage';
import { UsersAdminPage } from './admin/UsersAdminPage';
import { RolesPermissionsPage } from './admin/RolesPermissionsPage';
import { WarehouseAccessPage } from './admin/WarehouseAccessPage';
import { SystemSettingsPage } from './admin/SystemSettingsPage';
import { AuditGovernancePage } from './admin/AuditGovernancePage';
import { SystemHealthPage } from './admin/SystemHealthPage';
import { BackupRecoveryPage } from './admin/BackupRecoveryPage';
import { MaintenancePage } from './admin/MaintenancePage';
import { ReportsComplianceLayout } from '../components/reports/ReportsComplianceLayout';
import { FinancialCompliancePage } from './compliance/FinancialCompliancePage';
import { StockAuditPage } from './compliance/StockAuditPage';
import { ExecutiveDashboardPage } from './reports/ExecutiveDashboardPage';
import { BusinessIntelligencePage } from './reports/BusinessIntelligencePage';
import { NotificationsPage } from './notifications/NotificationsPage';
import { NotificationPreferencesPage } from './notifications/NotificationPreferencesPage';
import { WarehouseLayoutPage } from './warehouse/WarehouseLayoutPage';
import { ZoneBinManagementPage } from './warehouse/ZoneBinManagementPage';
import { LocationStockPage } from './warehouse/LocationStockPage';
import { BarcodeLabelsPage } from './warehouse/BarcodeLabelsPage';
import { ScanOperationsPage } from './warehouse/ScanOperationsPage';
import { PutAwayPage } from './warehouse/PutAwayPage';
import { PickingPage } from './warehouse/PickingPage';
import { BinTransfersPage } from './warehouse/BinTransfersPage';
import { CycleCountSchedulePage } from './warehouse/CycleCountSchedulePage';
import { WarehouseAnalyticsPage } from './warehouse/WarehouseAnalyticsPage';

export const router = createBrowserRouter([
  {
    path: '/login',
    element: <LoginPage />,
  },
  {
    path: '/signup',
    element: <LoginPage initialMode="signup" />,
  },
  {
    path: '/unauthorized',
    element: <UnauthorizedPage />,
  },
  {
    path: '/',
    element: (
      <ProtectedRoute>
        <AppShell />
      </ProtectedRoute>
    ),
    children: [
      {
        index: true,
        element: <RoleDashboardRedirect />,
      },
      {
        path: 'dashboard',
        element: <RoleDashboardRedirect />,
      },
      {
        path: 'master-data',
        element: (
          <ProtectedRoute
            anyPermission={[
              'master_data.read',
              'customers.read',
              'suppliers.read',
              'warehouses.read',
              'bom.read',
            ]}
          >
            <MasterDataLayout />
          </ProtectedRoute>
        ),
        children: [
          { index: true, element: <ModuleIndexRedirect basePath="/master-data" /> },
          {
            path: 'products',
            element: (
              <ProtectedRoute requiredPermissions={['master_data.read']}>
                <ProductsPage />
              </ProtectedRoute>
            ),
          },
          {
            path: 'product-variants',
            element: (
              <ProtectedRoute requiredPermissions={['master_data.read']}>
                <ProductVariantsPage />
              </ProtectedRoute>
            ),
          },
          {
            path: 'product-categories',
            element: (
              <ProtectedRoute requiredPermissions={['master_data.read']}>
                <CategoryMasterPage kind="product" />
              </ProtectedRoute>
            ),
          },
          {
            path: 'raw-materials',
            element: (
              <ProtectedRoute requiredPermissions={['master_data.read']}>
                <RawMaterialsPage />
              </ProtectedRoute>
            ),
          },
          {
            path: 'raw-material-categories',
            element: (
              <ProtectedRoute requiredPermissions={['master_data.read']}>
                <CategoryMasterPage kind="rawMaterial" />
              </ProtectedRoute>
            ),
          },
          {
            path: 'suppliers',
            element: (
              <ProtectedRoute anyPermission={['suppliers.read', 'master_data.read']}>
                <SuppliersPage />
              </ProtectedRoute>
            ),
          },
          {
            path: 'customers',
            element: (
              <ProtectedRoute requiredPermissions={['customers.read']}>
                <CustomersPage />
              </ProtectedRoute>
            ),
          },
          {
            path: 'uoms',
            element: (
              <ProtectedRoute requiredPermissions={['master_data.read']}>
                <UomsPage />
              </ProtectedRoute>
            ),
          },
          {
            path: 'unit-conversions',
            element: (
              <ProtectedRoute requiredPermissions={['master_data.read']}>
                <UnitConversionsPage />
              </ProtectedRoute>
            ),
          },
          {
            path: 'tax',
            element: (
              <ProtectedRoute requiredPermissions={['master_data.read']}>
                <TaxPage />
              </ProtectedRoute>
            ),
          },
          {
            path: 'warehouses',
            element: (
              <ProtectedRoute anyPermission={['warehouses.read', 'master_data.read']}>
                <WarehousesPage />
              </ProtectedRoute>
            ),
          },
          {
            path: 'boms',
            element: (
              <ProtectedRoute anyPermission={['bom.read', 'master_data.read']}>
                <BomsPage />
              </ProtectedRoute>
            ),
          },
        ],
      },
      {
        path: 'sales',
        element: (
          <ProtectedRoute requiredRoles={['SALESMAN', 'ADMIN', 'OWNER', 'PRODUCTION', 'AUDITOR']}>
            <SalesLayout />
          </ProtectedRoute>
        ),
        children: [
          { index: true, element: <ModuleIndexRedirect basePath="/sales" /> },
          {
            path: 'dashboard',
            element: (
              <ProtectedRoute requiredPermissions={['sales.dashboard.read']}>
                <SalesDashboardPage />
              </ProtectedRoute>
            ),
          },
          {
            path: 'orders',
            element: (
              <ProtectedRoute requiredPermissions={['sales.orders.read']}>
                <SalesOrdersPage />
              </ProtectedRoute>
            ),
          },
          {
            path: 'orders/new',
            element: (
              <ProtectedRoute requiredPermissions={['sales.orders.create']}>
                <SalesOrderFormPage />
              </ProtectedRoute>
            ),
          },
          {
            path: 'orders/:id',
            element: (
              <ProtectedRoute requiredPermissions={['sales.orders.read']}>
                <SalesOrderDetailPage />
              </ProtectedRoute>
            ),
          },
          {
            path: 'orders/:id/edit',
            element: (
              <ProtectedRoute requiredPermissions={['sales.orders.update']}>
                <SalesOrderFormPage />
              </ProtectedRoute>
            ),
          },
          {
            path: 'approvals',
            element: (
              <ProtectedRoute anyPermission={['sales.orders.approve', 'sales.orders.reject']}>
                <PendingApprovalsPage />
              </ProtectedRoute>
            ),
          },
          {
            path: 'fulfillment',
            element: (
              <ProtectedRoute requiredPermissions={['sales.orders.fulfill']}>
                <OrderFulfillmentPage />
              </ProtectedRoute>
            ),
          },
          {
            path: 'invoices',
            element: (
              <ProtectedRoute requiredPermissions={['sales.invoices.read']}>
                <SalesInvoicesPage />
              </ProtectedRoute>
            ),
          },
          {
            path: 'invoices/:id',
            element: (
              <ProtectedRoute requiredPermissions={['sales.invoices.read']}>
                <SalesInvoiceDetailPage />
              </ProtectedRoute>
            ),
          },
          {
            path: 'invoices/:id/edit',
            element: (
              <ProtectedRoute requiredPermissions={['sales.invoices.update']}>
                <SalesInvoiceFormPage />
              </ProtectedRoute>
            ),
          },
          {
            path: 'orders/:orderId/invoices/new',
            element: (
              <ProtectedRoute requiredPermissions={['sales.invoices.create']}>
                <SalesInvoiceFormPage />
              </ProtectedRoute>
            ),
          },
        ],
      },
      {
        path: 'inventory',
        element: (
          <ProtectedRoute requiredRoles={['ADMIN', 'PRODUCTION', 'OWNER', 'AUDITOR', 'SALESMAN']}>
            <InventoryLayout />
          </ProtectedRoute>
        ),
        children: [
          { index: true, element: <ModuleIndexRedirect basePath="/inventory" /> },
          {
            path: 'dashboard',
            element: (
              <ProtectedRoute requiredPermissions={['inventory.read']}>
                <InventoryDashboardPage />
              </ProtectedRoute>
            ),
          },
          {
            path: 'balances',
            element: (
              <ProtectedRoute requiredPermissions={['inventory.read']}>
                <StockBalancesPage />
              </ProtectedRoute>
            ),
          },
          {
            path: 'warehouse-layout',
            element: (
              <ProtectedRoute requiredPermissions={['inventory.read']}>
                <WarehouseLayoutPage />
              </ProtectedRoute>
            ),
          },
          {
            path: 'zones-bins',
            element: (
              <ProtectedRoute requiredPermissions={['inventory.read']}>
                <ZoneBinManagementPage />
              </ProtectedRoute>
            ),
          },
          {
            path: 'location-stock',
            element: (
              <ProtectedRoute requiredPermissions={['inventory.read']}>
                <LocationStockPage />
              </ProtectedRoute>
            ),
          },
          {
            path: 'barcodes',
            element: (
              <ProtectedRoute requiredPermissions={['inventory.read']}>
                <BarcodeLabelsPage />
              </ProtectedRoute>
            ),
          },
          {
            path: 'scan',
            element: (
              <ProtectedRoute requiredPermissions={['inventory.read']}>
                <ScanOperationsPage />
              </ProtectedRoute>
            ),
          },
          {
            path: 'put-away',
            element: (
              <ProtectedRoute requiredPermissions={['inventory.transfer.create']}>
                <PutAwayPage />
              </ProtectedRoute>
            ),
          },
          {
            path: 'picking',
            element: (
              <ProtectedRoute requiredPermissions={['inventory.issue.create']}>
                <PickingPage />
              </ProtectedRoute>
            ),
          },
          {
            path: 'bin-transfers',
            element: (
              <ProtectedRoute requiredPermissions={['inventory.transfer.create']}>
                <BinTransfersPage />
              </ProtectedRoute>
            ),
          },
          {
            path: 'cycle-counts',
            element: (
              <ProtectedRoute requiredPermissions={['compliance.stock_audit.read']}>
                <CycleCountSchedulePage />
              </ProtectedRoute>
            ),
          },
          {
            path: 'analytics',
            element: (
              <ProtectedRoute requiredPermissions={['inventory.read']}>
                <WarehouseAnalyticsPage />
              </ProtectedRoute>
            ),
          },
          {
            path: 'receipts',
            element: (
              <ProtectedRoute requiredPermissions={['inventory.read']}>
                <InventoryReceiptsPage />
              </ProtectedRoute>
            ),
          },
          {
            path: 'issues',
            element: (
              <ProtectedRoute requiredPermissions={['inventory.read']}>
                <InventoryIssuesPage />
              </ProtectedRoute>
            ),
          },
          {
            path: 'transfers',
            element: (
              <ProtectedRoute requiredPermissions={['inventory.read']}>
                <WarehouseTransfersPage />
              </ProtectedRoute>
            ),
          },
          {
            path: 'adjustments',
            element: (
              <ProtectedRoute requiredPermissions={['inventory.read']}>
                <StockAdjustmentsPage />
              </ProtectedRoute>
            ),
          },
          {
            path: 'batches',
            element: (
              <ProtectedRoute requiredPermissions={['inventory.read']}>
                <BatchExpiryPage />
              </ProtectedRoute>
            ),
          },
          {
            path: 'valuation',
            element: (
              <ProtectedRoute requiredPermissions={['inventory.valuation.read']}>
                <InventoryValuationPage />
              </ProtectedRoute>
            ),
          },
          {
            path: 'transactions',
            element: (
              <ProtectedRoute requiredPermissions={['inventory.read']}>
                <InventoryTransactionsPage />
              </ProtectedRoute>
            ),
          },
        ],
      },
      {
        path: 'production',
        element: (
          <ProtectedRoute requiredRoles={['PRODUCTION', 'ADMIN', 'OWNER', 'AUDITOR']}>
            <ProductionLayout />
          </ProtectedRoute>
        ),
        children: [
          { index: true, element: <ModuleIndexRedirect basePath="/production" /> },
          {
            path: 'planning',
            element: (
              <ProtectedRoute requiredPermissions={['production.plans.read']}>
                <ProductionPlanningDashboardPage />
              </ProtectedRoute>
            ),
          },
          {
            path: 'demand',
            element: (
              <ProtectedRoute requiredPermissions={['production.demand.read']}>
                <ProductionDemandPage />
              </ProtectedRoute>
            ),
          },
          {
            path: 'plans',
            element: (
              <ProtectedRoute requiredPermissions={['production.plans.read']}>
                <ProductionPlansPage />
              </ProtectedRoute>
            ),
          },
          {
            path: 'plans/:id',
            element: (
              <ProtectedRoute requiredPermissions={['production.plans.read']}>
                <ProductionPlanDetailPage />
              </ProtectedRoute>
            ),
          },
          {
            path: 'plans/:planId/work-orders/new',
            element: (
              <ProtectedRoute requiredPermissions={['production.work_orders.create']}>
                <WorkOrderFormPage />
              </ProtectedRoute>
            ),
          },
          {
            path: 'work-orders/dashboard',
            element: (
              <ProtectedRoute requiredPermissions={['production.work_orders.read']}>
                <WorkOrdersDashboardPage />
              </ProtectedRoute>
            ),
          },
          {
            path: 'work-orders',
            element: (
              <ProtectedRoute requiredPermissions={['production.work_orders.read']}>
                <WorkOrdersPage />
              </ProtectedRoute>
            ),
          },
          {
            path: 'work-orders/:id',
            element: (
              <ProtectedRoute requiredPermissions={['production.work_orders.read']}>
                <WorkOrderDetailPage />
              </ProtectedRoute>
            ),
          },
          {
            path: 'execution',
            element: (
              <ProtectedRoute requiredPermissions={['production.batches.read']}>
                <ProductionExecutionDashboardPage />
              </ProtectedRoute>
            ),
          },
          {
            path: 'batches',
            element: (
              <ProtectedRoute requiredPermissions={['production.batches.read']}>
                <ProductionBatchesPage />
              </ProtectedRoute>
            ),
          },
          {
            path: 'batches/:id',
            element: (
              <ProtectedRoute requiredPermissions={['production.batches.read']}>
                <ProductionBatchDetailPage />
              </ProtectedRoute>
            ),
          },
          {
            path: 'reconciliation',
            element: (
              <ProtectedRoute requiredPermissions={['production.batches.read']}>
                <MaterialReconciliationPage />
              </ProtectedRoute>
            ),
          },
          {
            path: 'quality',
            element: (
              <ProtectedRoute requiredPermissions={['production.quality.read']}>
                <QualityInspectionsPage />
              </ProtectedRoute>
            ),
          },
          {
            path: 'traceability',
            element: (
              <ProtectedRoute requiredPermissions={['production.batches.read']}>
                <BatchTraceabilityPage />
              </ProtectedRoute>
            ),
          },
          {
            path: 'costing',
            element: (
              <ProtectedRoute requiredPermissions={['production.costing.read']}>
                <ProductionCostingDashboardPage />
              </ProtectedRoute>
            ),
          },
          {
            path: 'costing/batches/:batchId',
            element: (
              <ProtectedRoute requiredPermissions={['production.costing.read']}>
                <BatchCostingDetailPage />
              </ProtectedRoute>
            ),
          },
          {
            path: 'costing/variance-report',
            element: (
              <ProtectedRoute requiredPermissions={['production.costing.read']}>
                <CostVarianceReportPage />
              </ProtectedRoute>
            ),
          },
          {
            path: 'reports',
            element: (
              <ProtectedRoute requiredPermissions={['production.reports.read']}>
                <ProductionAnalyticsDashboardPage />
              </ProtectedRoute>
            ),
          },
          {
            path: 'reports/plan-vs-actual',
            element: (
              <ProtectedRoute requiredPermissions={['production.reports.read']}>
                <ProductionPlanVsActualPage />
              </ProtectedRoute>
            ),
          },
          {
            path: 'reports/work-order-performance',
            element: (
              <ProtectedRoute requiredPermissions={['production.reports.read']}>
                <WorkOrderPerformanceReportPage />
              </ProtectedRoute>
            ),
          },
          {
            path: 'reports/batch-yield',
            element: (
              <ProtectedRoute requiredPermissions={['production.reports.read']}>
                <BatchYieldReportPage />
              </ProtectedRoute>
            ),
          },
          {
            path: 'reports/material-consumption',
            element: (
              <ProtectedRoute requiredPermissions={['production.reports.read']}>
                <MaterialConsumptionReportPage />
              </ProtectedRoute>
            ),
          },
          {
            path: 'reports/quality',
            element: (
              <ProtectedRoute requiredPermissions={['production.reports.read']}>
                <ProductionQualityReportPage />
              </ProtectedRoute>
            ),
          },
          {
            path: 'reports/costing',
            element: (
              <ProtectedRoute requiredPermissions={['production.reports.costing.read']}>
                <ProductionCostAnalyticsPage />
              </ProtectedRoute>
            ),
          },
          {
            path: 'boms',
            element: (
              <ProtectedRoute requiredPermissions={['bom.read']}>
                <BomsPage />
              </ProtectedRoute>
            ),
          },
        ],
      },
      {
        path: 'reports',
        element: (
          <ProtectedRoute requiredRoles={['OWNER', 'ADMIN', 'AUDITOR', 'PRODUCTION', 'SALESMAN']}>
            <ReportsComplianceLayout />
          </ProtectedRoute>
        ),
        children: [
          { index: true, element: <ModuleIndexRedirect basePath="/reports" /> },
          {
            path: 'executive',
            element: (
              <ProtectedRoute requiredPermissions={['analytics.dashboard.read']}>
                <ExecutiveDashboardPage />
              </ProtectedRoute>
            ),
          },
          {
            path: 'bi',
            element: (
              <ProtectedRoute
                anyPermission={[
                  'analytics.sales.read',
                  'analytics.inventory.read',
                  'analytics.production.read',
                  'analytics.profitability.read',
                  'analytics.factory.read',
                ]}
              >
                <BusinessIntelligencePage />
              </ProtectedRoute>
            ),
          },
          {
            path: 'compliance',
            element: (
              <ProtectedRoute
                anyPermission={[
                  'compliance.tax.read',
                  'compliance.inventory.read',
                  'compliance.documents.read',
                ]}
              >
                <FinancialCompliancePage />
              </ProtectedRoute>
            ),
          },
          {
            path: 'stock-audit',
            element: (
              <ProtectedRoute requiredPermissions={['compliance.stock_audit.read']}>
                <StockAuditPage />
              </ProtectedRoute>
            ),
          },
        ],
      },
      {
        path: 'admin',
        element: (
          <ProtectedRoute requiredRoles={['ADMIN', 'OWNER', 'AUDITOR']}>
            <AdministrationLayout />
          </ProtectedRoute>
        ),
        children: [
          { index: true, element: <ModuleIndexRedirect basePath="/admin" /> },
          {
            path: 'organization',
            element: (
              <ProtectedRoute requiredPermissions={['administration.organization.read']}>
                <OrganizationPage />
              </ProtectedRoute>
            ),
          },
          {
            path: 'factories',
            element: (
              <ProtectedRoute requiredPermissions={['administration.factories.read']}>
                <FactoriesPage />
              </ProtectedRoute>
            ),
          },
          {
            path: 'users',
            element: (
              <ProtectedRoute anyPermission={['administration.users.read', 'users.read']}>
                <UsersAdminPage />
              </ProtectedRoute>
            ),
          },
          {
            path: 'roles',
            element: (
              <ProtectedRoute requiredPermissions={['administration.roles.read']}>
                <RolesPermissionsPage />
              </ProtectedRoute>
            ),
          },
          {
            path: 'warehouse-access',
            element: (
              <ProtectedRoute requiredPermissions={['administration.warehouse_access.read']}>
                <WarehouseAccessPage />
              </ProtectedRoute>
            ),
          },
          {
            path: 'settings',
            element: (
              <ProtectedRoute requiredPermissions={['administration.settings.read']}>
                <SystemSettingsPage />
              </ProtectedRoute>
            ),
          },
          {
            path: 'governance',
            element: (
              <ProtectedRoute requiredPermissions={['governance.audit.read']}>
                <AuditGovernancePage />
              </ProtectedRoute>
            ),
          },
          {
            path: 'health',
            element: (
              <ProtectedRoute requiredPermissions={['operations.health.read']}>
                <SystemHealthPage />
              </ProtectedRoute>
            ),
          },
          {
            path: 'backups',
            element: (
              <ProtectedRoute requiredPermissions={['operations.backup.read']}>
                <BackupRecoveryPage />
              </ProtectedRoute>
            ),
          },
          {
            path: 'maintenance',
            element: (
              <ProtectedRoute requiredPermissions={['operations.maintenance.manage']}>
                <MaintenancePage />
              </ProtectedRoute>
            ),
          },
        ],
      },
      {
        path: 'notifications',
        element: <NotificationsPage />,
      },
      {
        path: 'notifications/preferences',
        element: <NotificationPreferencesPage />,
      },
      {
        path: 'sync',
        element: <SyncCenterPage />,
      },
      {
        path: '*',
        element: <NotFoundPage />,
      },
    ],
  },
]);
