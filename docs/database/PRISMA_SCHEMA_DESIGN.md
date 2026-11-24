# FoodFactory ERP – Prisma Schema Architectural Design

## 1. Overview & Objectives

This document explains the technical design of the proposed Prisma schema (`docs/database/prisma-schema-draft.prisma`).

The schema models the complete manufacturing, procurement, inventory ledger, batch costing, GST sales, and financial payment operations of **FoodFactory ERP** while preserving all working Phase 1.1 foundation elements (notably the `SystemConfig` table).

---

## 2. Technical Modeling Conventions

### 2.1 Prisma Model vs. Database Table Naming

To follow PostgreSQL and Prisma best practices:

- **Prisma Models**: PascalCase (e.g. `GoodsReceipt`, `InventoryTransactionLine`, `ProductionRun`).
- **PostgreSQL Tables**: Lowercase snake_case mapped explicitly via `@@map` (e.g. `@@map("goods_receipts")`, `@@map("inventory_transaction_lines")`).
- **PostgreSQL Columns**: Lowercase snake_case mapped explicitly via `@map` (e.g. `@map("unit_cost")`, `@map("quantity_on_hand")`).

### 2.2 Decimal Precision Architecture

Floating-point data types (`Float` in Prisma, `double precision` in SQL) are strictly banned for monetary and physical inventory balances. All quantities, prices, rates, and valuations use PostgreSQL `DECIMAL`/`NUMERIC`:

| Business Purpose                   | Prisma & Database Type       | Justification                                                                                 |
| :--------------------------------- | :--------------------------- | :-------------------------------------------------------------------------------------------- |
| **Inventory Quantities**           | `Decimal @db.Decimal(14, 4)` | Supports sub-gram or millilitre precision (e.g., 1.2000 kg spices, 10.5000 L oil).            |
| **Unit Valuations & MWAC**         | `Decimal @db.Decimal(18, 4)` | Prevents compounding truncation drift during moving average calculations (e.g., ₹43.1250/kg). |
| **Stock Balances & Ledger Values** | `Decimal @db.Decimal(18, 4)` | Guarantees exact ledger reconciliation down to four decimal places.                           |
| **Monetary Totals & Taxes**        | `Decimal @db.Decimal(14, 2)` | Standard currency representation (Paisa / Cents, e.g., ₹7,875.00).                            |
| **Tax & Variance Percentages**     | `Decimal @db.Decimal(5, 2)`  | Exact tax rates (2.50%, 5.00%, 18.00%) and variance ratios (-6.00%, +5.00%).                  |
| **Unit Conversion Multipliers**    | `Decimal @db.Decimal(18, 6)` | High precision for fractional unit conversions (e.g. 1 G = 0.001000 KG).                      |

---

## 3. Structural Domains & Model Breakdown

### 3.1 Organization & Security Domain

- `Company`: Holds legal identity, GSTIN, PAN, and state code.
- `Factory`: Operational site where production and warehousing are situated.
- `Warehouse`: Segregated storage nodes categorized by `WarehouseType` (`RAW_MATERIAL`, `PACKAGING`, `FINISHED_GOODS`, `GENERAL`, `SCRAP_DAMAGED`).
- `User`, `Role`, `UserRole`, `Permission`, `RolePermission`: Normalized RBAC structure. Supports the 5 required roles (`SALESMAN`, `ADMIN`, `PRODUCTION`, `OWNER`, `AUDITOR`).
- `UserWarehouseAccess`: Restricts storekeepers or factory staff to specific warehouses.
- `AuditLog`: Immutable, JSONB-backed audit trail recording user identity, action, entity type, and before/after state diffs.

### 3.2 Master Data Domain

- `UnitOfMeasure` & `UnitConversion`: Measurement catalog with base units and conversion multipliers.
- `RawMaterialCategory` & `RawMaterial`: Catalogs ingredients and packaging films with safety stock alerts.
- `ProductCategory`, `Product`, & `ProductVariant`: Multi-level finished goods catalog supporting packet sizes (e.g. Murukku 200 g with SKU `SKU-MUR-200G`).
- `TaxRate` & `TaxConfiguration`: Configurable tax slabs (GST 5%, 12%, 18%) with CGST, SGST, and IGST breakdowns.

### 3.3 Unified Inventory Bridge Pattern

Rather than maintaining separate, incompatible inventory tables for ingredients, packaging, and finished goods, the schema introduces the **`InventoryItem`** bridge:

- Has a 1:1 relation to `RawMaterial` (for ingredients and packaging).
- Has a 1:1 relation to `ProductVariant` (for finished packaged goods).
- Serves as the single target foreign key (`inventoryItemId`) across:
  - `InventoryBalance`
  - `InventoryTransactionLine`
  - `BOMItem`
  - `PurchaseOrderItem`
  - `GoodsReceiptItem`
  - `MaterialIssueItem`
  - `ProductionScrap`
  - `SalesOrderItem`
  - `DispatchItem`

This guarantees complete referential integrity and allows a single unified inventory ledger query to track any stock movement in the factory.

### 3.4 Purchasing Domain

- `Supplier` & `SupplierAddress`: Vendor directory with credit terms and GSTIN.
- `PurchaseOrder` & `PurchaseOrderItem`: Commercial purchasing agreements.
- `GoodsReceipt` & `GoodsReceiptItem`: Gate entry and quality inspection. Triggers `InventoryTransaction` posting.
- `SupplierInvoice`: Accounts payable billing.
- `PurchaseReturn` & `PurchaseReturnItem`: Vendor return management.

### 3.5 Bill of Materials & Production Domain

- `BOM`, `BOMVersion`, `BOMItem`: Recipe formulations with active/obsolete version status. Historical production orders link to `bomVersionId`, ensuring past manufacturing runs remain permanently auditable regardless of future recipe modifications.
- `ProductionOrder`: Factory schedule authorization.
- `ProductionRun`: Floor execution tracking planned vs. good output.
- `MaterialIssue` & `MaterialIssueItem`: Raw ingredient and packaging issues from warehouse to production kitchen.
- `ProductionScrap`: Explicit tracking of packaging damage (e.g., burst pouches) and ingredient losses.
- `ProductionOverhead`: Captures direct batch overheads (e.g. ₹1,200 labor, ₹600 gas/power).
- `ProductionVariance`: Records yield variance % and usage variance %.

### 3.6 Sales & Order Management Domain

- `Customer` & `CustomerAddress`: Retailer and distributor accounts.
- `SalesOrder` & `SalesOrderItem`: Order booking by sales representatives. Captures backordered quantities when stock is deficient.
- `SalesInvoice` & `SalesInvoiceItem`: Commercial tax document with immutable tax and rate snapshots.
- `InvoiceTaxBreakdown`: GSTR-1 compliant tax rate and HSN summary.
- `Dispatch` & `DispatchItem`: Physical goods shipment from finished goods warehouse to customer.
- `SalesReturn` & `SalesReturnItem`: Customer product returns with restockable flags.
- `CreditNote`: Financial credit adjustment for returned or damaged goods.

### 3.7 Payments & Financial Accounting

- `PaymentMethod`: Payment modes (`CASH`, `BANK_TRANSFER`, `UPI`, `CHEQUE`).
- `Payment`: Cash/bank inflows and outflows.
- `PaymentAllocation`: Many-to-many allocation between payments and invoices, maintaining:
  $$\text{outstandingAmount} = \text{totalAmount} - \sum \text{allocatedAmount}$$
- `ExpenseCategory` & `Expense`: Factory operational expenses and overheads.

### 3.8 Preserved Foundation Component

- `SystemConfig`: Unmodified from Phase 1.1, guaranteeing that system parameters and metadata remain intact.

---

## 4. Indexing Strategy & Performance Considerations

1. **Foreign Key Indexes**: Every relation field (`factoryId`, `warehouseId`, `customerId`, `supplierId`, `inventoryItemId`) is indexed to ensure fast join queries.
2. **Business Key Lookups**: All unique document identifiers (`poNumber`, `grnNumber`, `orderNumber`, `invoiceNumber`, `batchNumber`, `sku`) are backed by unique b-tree indexes.
3. **Compound Indexes**:
   - `inventory_balances`: `@@unique([inventoryItemId, warehouseId])` for O(1) balance retrieval during sales stock checks.
   - `inventory_transaction_lines`: `@@index([inventoryItemId, warehouseId])` for rapid ledger rollups and reconciliation.
   - `audit_logs`: `@@index([entityType, entityId])` for audit timeline reconstruction.
