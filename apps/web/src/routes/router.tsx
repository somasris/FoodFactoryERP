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
          <ProtectedRoute requiredRoles={['SALESMAN', 'ADMIN', 'OWNER']}>
            <ModulePlaceholder
              moduleName="Sales & Customer Order Management"
              phase="Phase 2 Implementation"
              summary="Manages customer distribution networks, price books, GST sales invoicing, and customer payment collections."
              scopePoints={[
                'Customer master registry with GSTIN and billing/shipping addresses',
                'Sales order intake, approval workflows, and status tracking',
                'GST-compliant tax invoices with HSN/SAC codes and CGST/SGST/IGST breakdown',
                'Customer payment receipts, outstanding balances, and aging ledgers',
              ]}
            />
          </ProtectedRoute>
        ),
      },
      {
        path: 'inventory',
        element: (
          <ProtectedRoute requiredRoles={['ADMIN', 'PRODUCTION', 'OWNER', 'AUDITOR']}>
            <ModulePlaceholder
              moduleName="Inventory & Procurement Management"
              phase="Phase 2 Implementation"
              summary="Manages raw food materials, specialized packaging films and cartons, purchase orders, and stock batch tracking."
              scopePoints={[
                'Raw material catalog with minimum safety stock and reorder levels',
                'Packaging materials (pouches, jars, master cartons, labels)',
                'Purchase orders (PO), Goods Receipt Notes (GRN), and supplier invoicing',
                'Batch inventory tracking with manufacturing and expiry date monitoring',
              ]}
            />
          </ProtectedRoute>
        ),
      },
      {
        path: 'production',
        element: (
          <ProtectedRoute requiredRoles={['PRODUCTION', 'ADMIN', 'OWNER']}>
            <ModulePlaceholder
              moduleName="BOM & Production Processing"
              phase="Phase 3 Implementation"
              summary="Standardized recipes, batch mixing/baking/frying conversions, machine yield tracking, and finished food batch packaging."
              scopePoints={[
                'Multi-ingredient Bill of Materials (BOM) with precise weight tolerances',
                'Production batch planning and work order issuance',
                'Processing stages (Mixing, Processing, Quality Check, Packaging)',
                'Scrap, wastage, and yield variance tracking against standard recipes',
              ]}
            />
          </ProtectedRoute>
        ),
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
