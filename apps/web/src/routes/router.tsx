import { createBrowserRouter, Navigate } from 'react-router-dom';
import { AppShell } from '../components/layout/AppShell';
import { ProtectedRoute } from '../components/auth/ProtectedRoute';
import { LoginPage } from './LoginPage';
import { UnauthorizedPage } from './UnauthorizedPage';
import { DashboardPlaceholder } from './DashboardPlaceholder';
import { ModulePlaceholder } from './ModulePlaceholder';
import { NotFoundPage } from './NotFoundPage';
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

export const router = createBrowserRouter([
  {
    path: '/login',
    element: <LoginPage />,
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
        element: <DashboardPlaceholder />,
      },
      {
        path: 'master-data',
        element: <MasterDataLayout />,
        children: [
          { index: true, element: <Navigate to="/master-data/products" replace /> },
          { path: 'products', element: <ProductsPage /> },
          { path: 'product-variants', element: <ProductVariantsPage /> },
          { path: 'product-categories', element: <CategoryMasterPage kind="product" /> },
          { path: 'raw-materials', element: <RawMaterialsPage /> },
          { path: 'raw-material-categories', element: <CategoryMasterPage kind="rawMaterial" /> },
          { path: 'suppliers', element: <SuppliersPage /> },
          { path: 'customers', element: <CustomersPage /> },
          { path: 'uoms', element: <UomsPage /> },
          { path: 'unit-conversions', element: <UnitConversionsPage /> },
          { path: 'tax', element: <TaxPage /> },
          { path: 'warehouses', element: <WarehousesPage /> },
          { path: 'boms', element: <BomsPage /> },
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
          { index: true, element: <Navigate to="/sales/dashboard" replace /> },
          { path: 'dashboard', element: <SalesDashboardPage /> },
          { path: 'orders', element: <SalesOrdersPage /> },
          { path: 'orders/new', element: <SalesOrderFormPage /> },
          { path: 'orders/:id', element: <SalesOrderDetailPage /> },
          { path: 'orders/:id/edit', element: <SalesOrderFormPage /> },
          { path: 'approvals', element: <PendingApprovalsPage /> },
          { path: 'fulfillment', element: <OrderFulfillmentPage /> },
          { path: 'invoices', element: <SalesInvoicesPage /> },
          { path: 'invoices/:id', element: <SalesInvoiceDetailPage /> },
          { path: 'invoices/:id/edit', element: <SalesInvoiceFormPage /> },
          { path: 'orders/:orderId/invoices/new', element: <SalesInvoiceFormPage /> },
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
          { index: true, element: <Navigate to="/inventory/dashboard" replace /> },
          { path: 'dashboard', element: <InventoryDashboardPage /> },
          { path: 'balances', element: <StockBalancesPage /> },
          { path: 'receipts', element: <InventoryReceiptsPage /> },
          { path: 'issues', element: <InventoryIssuesPage /> },
          { path: 'transfers', element: <WarehouseTransfersPage /> },
          { path: 'adjustments', element: <StockAdjustmentsPage /> },
          { path: 'batches', element: <BatchExpiryPage /> },
          { path: 'valuation', element: <InventoryValuationPage /> },
          { path: 'transactions', element: <InventoryTransactionsPage /> },
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
          { index: true, element: <Navigate to="/production/planning" replace /> },
          { path: 'planning', element: <ProductionPlanningDashboardPage /> },
          { path: 'demand', element: <ProductionDemandPage /> },
          { path: 'plans', element: <ProductionPlansPage /> },
          { path: 'plans/:id', element: <ProductionPlanDetailPage /> },
          { path: 'plans/:planId/work-orders/new', element: <WorkOrderFormPage /> },
          { path: 'work-orders/dashboard', element: <WorkOrdersDashboardPage /> },
          { path: 'work-orders', element: <WorkOrdersPage /> },
          { path: 'work-orders/:id', element: <WorkOrderDetailPage /> },
          { path: 'execution', element: <ProductionExecutionDashboardPage /> },
          { path: 'batches', element: <ProductionBatchesPage /> },
          { path: 'batches/:id', element: <ProductionBatchDetailPage /> },
          { path: 'reconciliation', element: <MaterialReconciliationPage /> },
          { path: 'quality', element: <QualityInspectionsPage /> },
          { path: 'traceability', element: <BatchTraceabilityPage /> },
          { path: 'costing', element: <ProductionCostingDashboardPage /> },
          { path: 'costing/batches/:batchId', element: <BatchCostingDetailPage /> },
          { path: 'costing/variance-report', element: <CostVarianceReportPage /> },
          { path: 'reports', element: <ProductionAnalyticsDashboardPage /> },
          { path: 'reports/plan-vs-actual', element: <ProductionPlanVsActualPage /> },
          { path: 'reports/work-order-performance', element: <WorkOrderPerformanceReportPage /> },
          { path: 'reports/batch-yield', element: <BatchYieldReportPage /> },
          { path: 'reports/material-consumption', element: <MaterialConsumptionReportPage /> },
          { path: 'reports/quality', element: <ProductionQualityReportPage /> },
          { path: 'reports/costing', element: <ProductionCostAnalyticsPage /> },
          { path: 'boms', element: <BomsPage /> },
        ],
      },
      {
        path: 'reports',
        element: (
          <ProtectedRoute requiredRoles={['OWNER', 'ADMIN', 'AUDITOR']}>
            <ModulePlaceholder
              moduleName="Costing & Audit Reports"
              phase="Phase 3 Implementation"
              summary="Comprehensive unit economics, overhead absorption, GST reconciliation summaries, and financial audit reports."
              scopePoints={[
                'True unit cost of finished goods (Raw Material + Packaging + Overhead)',
                'Gross profit and contribution margin analysis per SKU',
                'Monthly GSTR-1 and GSTR-3B audit-ready transaction ledgers',
                'Stock valuation and inventory movement audit reports',
              ]}
            />
          </ProtectedRoute>
        ),
      },
      {
        path: 'admin',
        element: (
          <ProtectedRoute requiredRoles={['ADMIN', 'OWNER']}>
            <ModulePlaceholder
              moduleName="System Administration & Security"
              phase="Phase 1.3 Certified Foundation"
              summary="Role-based access control, user account provisioning, audit logging, and system configurations."
              scopePoints={[
                'User account management and role-based access control (RBAC)',
                'Role matrix: SALESMAN, ADMIN, PRODUCTION, OWNER, AUDITOR',
                'Comprehensive immutable security and operational audit logs',
                'System backups and environment parameter configuration',
              ]}
            />
          </ProtectedRoute>
        ),
      },
      {
        path: '*',
        element: <NotFoundPage />,
      },
    ],
  },
]);
