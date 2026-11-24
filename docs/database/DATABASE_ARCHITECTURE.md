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

#### 3.4.4 Finished Goods Valuation (Batch Actual Costing to Warehouse MWAC)

Finished packaged food products do not use purchasing MWAC. Instead, valuation follows an integrated two-tier model:

1. **Tier 1: Production Run Actual Costing**:
   Each completed `ProductionRun` computes the exact **Actual Batch Cost**:
   $$\text{Total Batch Cost} = \sum (\text{Material Issues}) - \sum (\text{Material Returns}) + \text{Direct Labor} + \text{Direct Utilities}$$
   $$\text{Finished Goods Batch Unit Cost} = \frac{\text{Total Batch Cost}}{\text{Good Finished Output Quantity}}$$
   _Scrap Accounting_: Damaged packaging pouches (e.g., 6 pieces) are already part of the total material issue (194 pieces). They are documented in `production_scrap` for loss tracking and yield reporting, but are **not** added again to the batch cost.

2. **Tier 2: Warehouse Finished Goods Blended MWAC**:
   When good packets are posted into the finished goods warehouse (`WH-FG-01`) via a `PRODUCTION_RECEIPT` inventory transaction, they blend into the warehouse's finished goods stock using Moving Weighted Average Cost:
   $$\text{New Warehouse FG Average Cost} = \frac{(\text{Previous FG Qty} \times \text{Current FG Avg Cost}) + (\text{Batch Good Output} \times \text{Batch Unit Cost})}{\text{Previous FG Qty} + \text{Batch Good Output}}$$
   - **Opening Finished Goods Stock**: Stored at historical opening cost (e.g., 50 packets @ ₹32.00 = ₹1,600.00).
   - **Batch Intake**: 188 packets @ ₹31.1436 = ₹5,855.00.
   - **Blended Warehouse Closing Cost**: $(₹1,600.00 + ₹5,855.00) / 238 \text{ packets} = \mathbf{₹31.3235 / \text{packet}}$.

3. **Partial Production Batches**:
   If an order for 1,000 packets is fulfilled through discrete production runs, each run records its own actual consumption and good output. Each completed run generates an independent `PRODUCTION_RECEIPT` posting with its specific batch unit cost, updating warehouse inventory iteratively.

4. **Finished Goods Dispatches & Cost of Goods Sold (COGS)**:
   Customer dispatches relieve finished goods stock at the **current warehouse blended MWAC** (e.g. ₹31.3235/packet). Gross profit per packet on sales invoices is computed as:
   $$\text{Gross Profit} = \text{Selling Price (₹50.00)} - \text{Relief Unit Cost (₹31.3235)} = \mathbf{₹18.6765 / \text{packet}} \quad (37.35\%)$$

5. **Production Returns and Reversals**:
   If a finished goods receipt was posted erroneously, a reversal transaction (`movementType: OUT`) removes the batch quantity and value, restoring the warehouse balance and recalculating the average cost without modifying historical records.

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

#### 3.8.3 Payment Allocation Model & Invariant Enforcements

- **`Payment`**: Records physical receipt of cash, cheque, UPI, or NEFT/RTGS funds from customers.
- **`PaymentAllocation`**: Normalized table mapping payments to one or more `SalesInvoice` records. Supports partial payments, multi-invoice settlements, and customer advance credits.
- **Transactional Consistency Invariants**:
  1. $\sum \text{allocated\_amount for a payment} \le \text{payment.amount}$
  2. $\text{payment.unallocated\_amount} = \text{payment.amount} - \sum \text{allocated\_amount} \ge 0$
  3. $\sum \text{allocated\_amount for an invoice} \le \text{invoice.total\_amount}$
  4. $\text{invoice.paid\_amount} = \sum \text{allocated\_amount}$
  5. $\text{invoice.outstanding\_amount} = \text{invoice.total\_amount} - \text{invoice.paid\_amount} \ge 0$
- **Concurrency & Locking Rule for Payments**:
  When applying an allocation, the transaction executes:
  ```sql
  SELECT id, amount, unallocated_amount FROM payments WHERE id = $1 FOR UPDATE;
  SELECT id, total_amount, paid_amount, outstanding_amount FROM sales_invoices WHERE id = $2 FOR UPDATE;
  ```
  Validating available unallocated funds and outstanding balance under exclusive row locks prevents concurrent double-allocations.

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

### 4.1 Why a `CHECK (quantity_on_hand >= 0)` Constraint Alone is Insufficient

While `inventory_balances` enforces a database `CHECK (quantity_on_hand >= 0)` constraint, **a CHECK constraint alone cannot guarantee concurrency safety in a multi-user ERP**:

1. **Lost Updates Under Application Logic**:
   Suppose the warehouse currently holds 10 packets of Murukku (`quantity_on_hand = 10`). Two concurrent salesmen submit orders:
   - Transaction A (T1) orders 8 packets. It reads `quantity_on_hand = 10` in memory, computes $10 - 8 = 2$, and prepares `UPDATE inventory_balances SET quantity_on_hand = 2`.
   - Transaction B (T2) orders 7 packets concurrently. Under standard `READ COMMITTED` isolation, T2 also reads `quantity_on_hand = 10`, computes $10 - 7 = 3$, and prepares `UPDATE inventory_balances SET quantity_on_hand = 3`.
   - If T1 commits, then T2 commits, T2 **overwrites** T1's update (`Lost Update Anomaly`). The database now records 3 packets on hand when in reality 15 packets were dispatched from 10 packets. The `CHECK` constraint never fired because neither update wrote a negative number!
2. **Abrupt Application Crashes & Deadlocks**:
   Even if code uses atomic decrements (`SET quantity_on_hand = quantity_on_hand - 7`), when two transactions race for the last remaining stock, the losing transaction triggers an unhandled PostgreSQL constraint violation (`error 23514 check_violation`). This results in 500 server crashes, prevents clean backorder creation, and cannot generate friendly business shortage alerts (e.g., "Available 88 pkts, Shortage 32 pkts").

### 4.2 Reliable Concurrency Architecture: Pessimistic Row Locking (`SELECT ... FOR UPDATE`)

To ensure absolute mathematical consistency and clean business handling, every stock-mutating transaction follows a strict three-phase protocol inside `prisma.$transaction`:

```sql
-- Phase 1: Acquire exclusive row lock on the specific item and warehouse
SELECT id, quantity_on_hand, allocated_quantity, average_cost
FROM inventory_balances
WHERE inventory_item_id = $1 AND warehouse_id = $2
FOR UPDATE;

-- Phase 2: Application evaluates locked state
-- IF (quantity_on_hand - allocated_quantity < requested_quantity)
-- THEN clean rejection or record backorder (e.g., 32 packets shortage for Distributor B)
-- ELSE continue to Phase 3

-- Phase 3: Execute atomic balance update and append immutable ledger line
UPDATE inventory_balances
SET quantity_on_hand = quantity_on_hand - $requested_quantity,
    last_updated_at = NOW()
WHERE id = $balance_id;

INSERT INTO inventory_transaction_lines (
  transaction_id, inventory_item_id, warehouse_id, movement_type,
  quantity, unit_cost, total_value, balance_before, balance_after
) VALUES (
  $txn_id, $item_id, $warehouse_id, 'OUT',
  $requested_quantity, $current_avg_cost, $total_val, $locked_qty, $locked_qty - $requested_quantity
);
```

### 4.3 Summary of Transaction Safety Guarantees

| Mechanism                        | Scope                                                  | Purpose                                                                                                                |
| :------------------------------- | :----------------------------------------------------- | :--------------------------------------------------------------------------------------------------------------------- |
| **`SELECT ... FOR UPDATE`**      | `inventory_balances`, `payments`, `sales_invoices`     | Serializes concurrent writers per item/document; eliminates lost updates and race conditions.                          |
| **`prisma.$transaction`**        | Multi-table postings                                   | Atomically binds document status transition, ledger line insertion, and balance updates (all succeed or all rollback). |
| **Database `CHECK` Constraints** | `quantity_on_hand >= 0`, `paid_amount <= total_amount` | Defense-in-depth safety barrier preventing corrupted data from ever writing to disk.                                   |
| **Append-Only Immutability**     | `inventory_transaction_lines`, `audit_logs`            | Guarantees audit permanence. Historical balances can be reconstructed by replaying ledger lines.                       |

- `paid_amount <= total_amount` on `sales_invoices`.
- `allocated_amount <= amount` on `payments`.
