# FoodFactory ERP – Relational Database Architecture

## Executive Summary

**FoodFactory ERP** is an integrated manufacturing Enterprise Resource Planning (ERP) platform designed for small-to-medium scale South Indian packaged food manufacturers (e.g., traditional snacks, namkeens, sweets, and spice mixes).

This document defines the complete production-grade relational database architecture for Phase 1.2. The architecture guarantees:

1. **Mathematical and Financial Accuracy**: Arbitrary precision `DECIMAL(18, 4)` and `DECIMAL(14, 2)` arithmetic for all quantities, currencies, and tax values, avoiding floating-point rounding errors.
2. **Immutable Inventory Ledger**: Double-entry style append-only movement logs with strict non-negative stock controls and source-document traceability.
3. **Moving Weighted Average Cost (MWAC)**: Transparent, automated valuation of raw ingredients and packaging materials upon each purchase receipt.
4. **Batch-Actual Production Costing**: Exact cost absorption incorporating raw materials, packaging, damaged packaging scrap, direct labor, and utility overheads.
5. **GST Dual-Architecture**: Native compliance for intra-state (CGST + SGST) and inter-state (IGST) tax operations with historical rate and amount snapshots.
6. **Multi-Role Governance**: Access matrix supporting `SALESMAN`, `ADMIN`, `PRODUCTION`, `OWNER`, and read-only `AUDITOR` workflows with comprehensive entity audit trails.

---

## 1. Architectural Principles

### 1.1 Source-Document Traceability

Every financial and inventory event must originate from an authoritative business document (`GoodsReceipt`, `MaterialIssue`, `ProductionRun`, `SalesInvoice`, `Dispatch`, `StockAdjustment`, `Payment`). No stock or ledger balance may ever be adjusted directly via ad-hoc mutation.

### 1.2 Immutability of Posted Transactions

Once a business document transitions to the `POSTED` status:

- Its header, line items, prices, and tax rates become strictly immutable.
- Physical adjustments or commercial corrections require explicit reversal documents (`SalesReturn`, `CreditNote`, `PurchaseReturn`, `StockAdjustment`).

### 1.3 Strict Non-Negative Stock Policy

By default, inventory balances cannot drop below zero. Out-of-stock validation occurs at sales order reservation and dispatch stages. Stock shortages are raised as actionable procurement or production demands.

### 1.4 Single Source of Truth

Inventory balances (`InventoryBalance`) function as a cached read-model for rapid transactional checks, backed by the immutable append-only ledger (`InventoryTransactionLine`). In the event of audit or discrepancy, the ledger is authoritative.

---

## 2. Business Module Boundaries & Domains

The database is partitioned into eight cohesive, decoupled domains:

```
+-----------------------------------------------------------------------------------+
|                            ORGANIZATION & SECURITY                                |
|  Company, Factory, Warehouse, User, Role, Permission, UserWarehouseAccess, Audit  |
+-----------------------------------------------------------------------------------+
                                         |
                                         v
+-----------------------------------------------------------------------------------+
|                                  MASTER DATA                                      |
|  Product, ProductVariant, RawMaterial, InventoryItem, UOM, Conversion, TaxConfig  |
+-----------------------------------------------------------------------------------+
             |                                             |
             v                                             v
+-----------------------------+               +-------------------------------------+
|     PURCHASING & VENDORS    |               |          SALES & CUSTOMERS          |
|  Supplier, PO, GRN, Invoices|               |  Customer, SalesOrder, Dispatch,    |
|  PurchaseReturn, Payments   |               |  SalesInvoice, Returns, CreditNotes |
+-----------------------------+               +-------------------------------------+
             \                                             /
              \                                           /
               v                                         v
+-----------------------------------------------------------------------------------+
|                        IMMUTABLE INVENTORY LEDGER & MWAC                          |
|  InventoryItem, InventoryBalance, InventoryTransaction, Line, ValuationLayer, Adj |
+-----------------------------------------------------------------------------------+
                                         ^
                                         |
+-----------------------------------------------------------------------------------+
|                            BOM & PRODUCTION COSTING                               |
|  BOM, BOMVersion, BOMItem, ProductionOrder, ProductionRun, MaterialIssue, Output  |
|  ProductionScrap, ProductionOverhead, ProductionCost, ProductionVariance          |
+-----------------------------------------------------------------------------------+
                                         |
                                         v
+-----------------------------------------------------------------------------------+
|                         GST COMPLIANCE & FINANCIAL LEDGERS                        |
|  TaxRate, InvoiceTaxBreakdown, Payment, PaymentAllocation, Expense, AuditLog      |
+-----------------------------------------------------------------------------------+
```

---

## 3. Detailed Domain Architecture

### 3.1 Organization & Security Architecture

- **Company**: Legal entity holding GSTIN, PAN, registered office, state code (e.g., 33 for Tamil Nadu).
- **Factory**: Manufacturing plant site where processing, mixing, and baking take place.
- **Warehouse**: Physical or logical storage locations categorized by inventory type:
  - `RAW_MATERIAL`: Flours, pulses, oils, spices, food additives.
  - `PACKAGING`: Nitrogen-barrier printed pouches, labels, tape, corrugated master cartons.
  - `FINISHED_GOODS`: Packaged, sealed consumer goods ready for distribution.
  - `SCRAP_DAMAGED`: Quarantined expired ingredients or damaged packaging films.
- **Role-Based Access Control (RBAC)**:
  - Roles: `SALESMAN`, `ADMIN`, `PRODUCTION`, `OWNER`, `AUDITOR`.
  - Granular permissions mapped per entity and action (`CREATE`, `READ`, `UPDATE`, `DELETE`, `APPROVE`, `POST`, `EXPORT`).
  - `AUDITOR` role granted exclusively `READ` and `EXPORT` permissions.
- **UserWarehouseAccess**: Scopes production workers, salesmen, or storekeepers to authorized physical facilities.

### 3.2 Master Data & Unified Inventory Registry

Food manufacturing requires clear segregation between raw ingredients, packaging, and finished packaged goods, while unifying inventory accounting:

- **`RawMaterial`**: Master record for ingredients and packaging with HSN codes, storage specifications, and reorder levels.
- **`Product` & `ProductVariant`**: Master record for retail packaged goods (e.g., `Product: Murukku`, `ProductVariant: Murukku 200 g` with SKU `SKU-MUR-200G`).
- **`InventoryItem` (Unified Inventory Bridge)**:
  - Acts as the central anchor for inventory ledger transactions.
  - Has a 1:1 polymorphic relationship to either `RawMaterial` or `ProductVariant`.
  - Holds cached valuation attributes: `itemType` (`RAW_MATERIAL`, `PACKAGING`, `FINISHED_GOODS`), `valuationMethod` (`MWAC` or `BATCH_ACTUAL`), and current weighted average cost.
- **`UnitOfMeasure` & `UnitConversion`**: Defines base units (KG, LTR, PCS, PKT) and fractional conversions (e.g., 1 KG = 1000 G, 1 LTR = 1000 ML, 1 Master Carton = 20 Packets).

### 3.3 Purchasing & Supplier Management

- **`PurchaseOrder`**: Contractual document issued to raw material and packaging vendors specifying quantities and negotiated prices.
- **`GoodsReceipt` (GRN)**:
  - Issued when goods physically arrive at the factory gate.
  - Captures supplier challan number, batch number, and expiry date.
  - Upon posting:
    1. Creates immutable `InventoryTransaction` lines (`movementType: IN`).
    2. Recalculates the Moving Weighted Average Cost (MWAC) for that material.
    3. Increases `InventoryBalance.quantityOnHand` and updates `InventoryBalance.averageCost`.
- **`SupplierInvoice`**: Accounts payable document generated against accepted GRN quantities.
- **`PurchaseReturn`**: Reversal document relieving stock and generating supplier debit.

### 3.4 Immutable Inventory Ledger & Valuation Engine

#### 3.4.1 Moving Weighted Average Cost (MWAC) Formula

Raw ingredients and packaging materials use the Moving Weighted Average Cost method. Whenever a `GoodsReceipt` is posted:

$$\text{New Average Cost} = \frac{\text{Previous Inventory Value} + \text{Received Inventory Value}}{\text{Previous Inventory Quantity} + \text{Received Quantity}}$$

Where:

- $\text{Previous Inventory Value} = \text{Previous QuantityOnHand} \times \text{Current AverageCost}$
- $\text{Received Inventory Value} = \text{Accepted ReceivedQuantity} \times \text{Purchase UnitCost}$

#### 3.4.2 Handling of Outward Movements & Issues

Outward stock movements (Material Issues to Production, Dispatches to Customers) consume stock strictly at the **current weighted average cost** at the timestamp of posting. They do not alter the unit average cost; they only reduce total inventory quantity and value.

#### 3.4.3 Handling of Returns & Adjustments

- **Sales Return (Restockable)**: Re-enters inventory at the original dispatch cost or standard valuation, adjusting total stock value proportionally.
- **Purchase Return**: Decreases inventory quantity and value at the supplier's invoiced cost. Any variance against current MWAC is recorded as an inventory adjustment variance.
- **Stock Adjustment**: Relieves or credits stock following physical stock takes; unit valuation is pegged to the active average cost.

#### 3.4.4 Finished Goods Valuation (Batch Actual Costing)

Finished packaged food products do not use purchasing MWAC. Instead, each production run calculates the **Actual Batch Cost**:

$$\text{Total Batch Cost} = \text{Raw Material Cost} + \text{Packaging Cost} + \text{Direct Labor} + \text{Utility Overhead}$$

$$\text{Finished Goods Unit Cost} = \frac{\text{Total Batch Cost}}{\text{Good Finished Output Quantity}}$$

Finished goods inventory receipts are logged at this exact batch unit cost. When finished packets enter the warehouse, the warehouse's finished goods average valuation updates accordingly.

### 3.5 Bill of Materials (BOM) & Recipe Management

- **`BOM`**: Product recipe header specifying base output (e.g., Murukku 200 g, standard batch base: 200 packets).
- **`BOMVersion`**:
  - Enforces version history (`versionNumber: 1, 2, ...`, `status: ACTIVE, OBSOLETE`).
  - Historical production runs lock in the specific `bomVersionId` under which they were manufactured, guaranteeing that future recipe or spice tweaks never alter past production audit records.
- **`BOMItem`**: Itemized ingredients and packaging:
  - Raw material requirements (e.g., 40 kg Flour, 10 L Oil, 1.2 kg Spice Mix).
  - Primary packaging (e.g., 200 printed pouches).
  - Secondary packaging (e.g., 10 corrugated cartons).
  - Standard scrap and tolerance allowances.

### 3.6 Production Execution & Variance Tracking

- **`ProductionOrder`**: Authorization to manufacture a specified quantity of finished packets against an active BOM version.
- **`ProductionRun`**: The actual physical batch run on the factory floor:
  - Tracks actual start and completion timestamps.
  - Links to `MaterialIssue` (materials moved from raw stores to the factory kitchen).
  - Captures actual good output (e.g., 188 packets vs. planned 200).
- **`ProductionScrap`**:
  - Explicitly segregates food waste (burnt dough, test batches) from **damaged packaging** (burst pouches, machine calibration scrap).
  - Ensures packaging losses are financially absorbed into production cost rather than disappearing as inventory shrinkage.
- **`ProductionOverhead`**: Captures direct factory costs attributed to the run:
  - Labor overhead (wages paid for batch frying/packing).
  - Utilities (commercial LPG cylinders, electricity).
- **`ProductionVariance`**: Automatically computes and stores:
  - **Yield Variance %**: $\frac{\text{Actual Good Output} - \text{Planned Standard Output}}{\text{Planned Standard Output}} \times 100$
  - **Material Usage Variance %**: $\frac{\text{Actual Consumed} - \text{Standard Expected}}{\text{Standard Expected}} \times 100$

### 3.7 Sales, Invoicing & Order Management

- **`SalesOrder`**: Created by salesmen for retailers or distributors. Captures promised delivery dates and customer price schedules.
- **`SalesOrderItem`**: Captures ordered quantities, unit selling price, and applicable GST rate.
- **Stock Availability Verification**: System validates whether `quantityOnHand - allocatedQuantity >= orderedQuantity`. If finished goods are insufficient, the order line is flagged with a shortage status and backordered quantity.
- **`SalesInvoice`**: Commercial tax document generated upon order approval and dispatch preparation.
- **`Dispatch`**: Physical gate-pass document recording transport vehicle, carrier, and item quantities shipped from the warehouse. Updates inventory ledger (`movementType: OUT`).

### 3.8 GST Compliance & Financial Architecture

#### 3.8.1 Dual GST Engine (Intra-state vs. Inter-state)

GST calculation is derived deterministically by comparing the **Factory State Code** with the **Customer Shipping State Code**:

| Destination     | Condition                                                               | Tax Type    | Applied Breakdown                   |
| :-------------- | :---------------------------------------------------------------------- | :---------- | :---------------------------------- |
| **Intra-state** | `Factory.stateCode == CustomerAddress.stateCode` (e.g., 33 TN to 33 TN) | CGST + SGST | Rate / 2 as CGST + Rate / 2 as SGST |
| **Inter-state** | `Factory.stateCode != CustomerAddress.stateCode` (e.g., 33 TN to 29 KA) | IGST        | Full Rate as IGST                   |

#### 3.8.2 Historical Snapshotting

`SalesInvoiceItem` and `InvoiceTaxBreakdown` persist immutable copies of:

- `hsnCode`
- `taxRatePercentage`
- `cgstRate`, `cgstAmount`
- `sgstRate`, `sgstAmount`
- `igstRate`, `igstAmount`
- `taxableAmount` and `totalAmount`

Future changes to master tax rates in `TaxRate` will never recalculate historical invoices.

#### 3.8.3 Payment Allocation Model

- **`Payment`**: Records physical receipt of cash, cheque, UPI, or NEFT/RTGS funds from customers.
- **`PaymentAllocation`**: Normalized table mapping payments to one or more `SalesInvoice` records. Supports partial payments and multi-invoice settlement.
- **Calculated Invariant**:
  $$\text{Invoice.outstandingAmount} = \text{Invoice.totalAmount} - \sum \text{AllocatedPayments}$$
  $$\text{Payment.unallocatedAmount} = \text{Payment.amount} - \sum \text{Allocations}$$

### 3.9 Audit Trail Architecture

- **`AuditLog`**: Centralized, immutable table recording every write, state transition, approval, and cancellation.
- Tracks:
  - `userId`: Author of the change.
  - `action`: `CREATE`, `UPDATE`, `DELETE`, `APPROVE`, `POST`, `CANCEL`.
  - `entityType` & `entityId`: Target table and record UUID.
  - `previousState` & `newState`: PostgreSQL JSONB payloads capturing field deltas.
  - `remarks`: Mandatory reason for sensitive operations (e.g., stock write-offs or invoice cancellations).

---

## 4. Concurrency Control & Transaction Safety

To prevent race conditions, duplicate posting, and negative stock:

1. **Database Row Locks (`SELECT ... FOR UPDATE`)**: Applied during inventory posting to serialize concurrent updates to the same `InventoryBalance` row.
2. **Atomic Prisma Transactions (`prisma.$transaction`)**: All multi-table postings (e.g., `GoodsReceipt` $\rightarrow$ `InventoryTransaction` $\rightarrow$ `InventoryBalance` $\rightarrow$ `MWAC recalculation`) run inside strict atomic database transactions. If any step fails, the entire operation rolls back.
3. **Database Constraints (`CHECK` constraints)**:
   - `quantity_on_hand >= 0` on `inventory_balances`.
   - `paid_amount <= total_amount` on `sales_invoices`.
   - `allocated_amount <= amount` on `payments`.
