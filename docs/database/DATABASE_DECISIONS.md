# FoodFactory ERP – Architectural Database Decisions

This document formally records the architectural decisions, trade-offs, evaluated alternatives, and downstream consequences governing the database design for **FoodFactory ERP**.

---

## Decision 1: Inventory Valuation Methodology for Raw & Packaging Materials (Moving Weighted Average Cost)

- **Decision**: Adopt the **Moving Weighted Average Cost (MWAC)** method for all raw materials and packaging materials. Recalculate average unit cost immediately upon the posting of each `GoodsReceipt`.
- **Reason**:
  - Small-to-medium food factories procure commodities (flour, edible oils, spices) with weekly or bi-weekly price volatility.
  - Unlike FIFO, which requires managing complex individual queue layers for bulk grain bins or oil tanks that physically blend together, MWAC accurately reflects the blended economic cost of liquid and bulk materials.
  - Formula:
    $$\text{New Average Cost} = \frac{\text{Previous Inventory Value} + \text{Received Inventory Value}}{\text{Previous Inventory Quantity} + \text{Received Quantity}}$$
- **Alternatives Considered**:
  - _FIFO (First-In, First-Out)_: Rejected for continuous bulk ingredients (e.g., oil poured into a shared holding tank) because physical and financial tracking diverge significantly, adding layer tracking overhead without corresponding business value for a small unit.
  - _Standard Costing_: Rejected because small food producers lack the predictive hedging capacity to maintain realistic annual standard prices without constant variance adjustments.
- **Impact**:
  - All outward material issues are priced at the active `averageCost` at the moment of issue.
  - `averageCost` is cached on `inventory_balances` and stamped on each `inventory_transaction_lines` row for permanent auditability.
- **Unresolved Question**: None. Benchmarked and fully validated.

---

## Decision 2: Finished Goods Valuation Approach (Batch Actual Costing)

- **Decision**: Finished goods are valued using **Batch Actual Costing** based on the real materials and overhead consumed during that specific `ProductionRun`.
- **Reason**:
  - Food manufacturing yields fluctuate due to moisture loss during frying/baking, dough stickage, and packaging machine jam scrap.
  - Stamping the finished product with its actual production cost guarantees that true yield variances (e.g., a batch producing 188 packets instead of 200) are accurately absorbed into the unit cost of that batch:
    $$\text{Unit Cost} = \frac{\text{Total Material Cost} + \text{Damaged Packaging Cost} + \text{Direct Labor} + \text{Direct Utilities}}{\text{Good Finished Output Quantity}}$$
- **Alternatives Considered**:
  - _Theoretical Standard Recipe Costing_: Rejected because it conceals shop-floor wastage, packaging losses, and yield degradation from executive margin reports.
  - _Weighted Average across All Historical Production Runs_: Rejected as a primary costing method, though finished goods arriving in the warehouse blend into warehouse finished goods inventory via MWAC.
- **Impact**: Each `ProductionRun` generates a discrete batch unit cost, which is stamped onto the resulting finished goods `InventoryTransactionLine` when goods enter the finished warehouse.
- **Unresolved Question**: None.

---

## Decision 3: Immutable Inventory Ledger Architecture

- **Decision**: Implement an **append-only, immutable inventory ledger** (`inventory_transactions` and `inventory_transaction_lines`). Do not allow direct SQL updates or deletions on posted stock transactions.
- **Reason**:
  - Guarantees complete audit traceability required by auditors and statutory authorities.
  - Ensures every inventory movement points to a valid source document (`GoodsReceipt`, `MaterialIssue`, `ProductionRun`, `Dispatch`, `StockAdjustment`, `StockTransfer`).
  - Balances can always be reconstructed or audited from the genesis transaction.
- **Alternatives Considered**:
  - _Mutable Inventory Balances Only (Simple CRUD)_: Rejected as unacceptable for an ERP system. Causes untraceable stock shrinkage and makes financial reconciliation impossible.
  - _Event Sourcing with No Read-Model Table_: Rejected because querying historical events for every stock availability check during sales order creation creates unacceptable query latency under high transaction volume.
- **Impact**:
  - `InventoryBalance` acts as a high-performance cached snapshot table protected by database `CHECK (quantity_on_hand >= 0)` constraints.
  - In the event of discrepancy, `InventoryTransactionLine` is legally and architecturally authoritative.
- **Unresolved Question**: None.

---

## Decision 4: Unified Inventory Bridge Pattern (`InventoryItem`)

- **Decision**: Introduce a polymorphic `InventoryItem` table that bridges distinct business entities (`RawMaterial` vs. `ProductVariant`) to a single inventory ledger foreign key.
- **Reason**:
  - Food manufacturing involves fundamentally different master data for ingredients (e.g. storage temperature, supplier lead time, raw category) versus packaged retail items (e.g. net weight, packaging size, barcode, retail pricing).
  - Merging them into a single monolithic `items` table causes severe column sparseness and nullable foreign key bloat.
  - Keeping them in completely separate tables without a bridge forces `inventory_transaction_lines` to use awkward nullable dual foreign keys (`raw_material_id`, `product_variant_id`), risking referential integrity violations.
  - The bridge pattern provides 100% relational integrity and allows a single uniform stock query across the entire plant.
- **Alternatives Considered**:
  - _Single Monolithic Items Table_: Rejected due to high schema dilution and conflicting lifecycle fields.
  - _Dual Inventory Ledgers (RawLedger and FinishedLedger)_: Rejected because packaging materials, scrap, and internal transfers cross boundaries, creating code duplication.
- **Impact**: Every stock movement references `inventory_items.id`, while domain-specific attributes reside cleanly in `raw_materials` or `product_variants`.
- **Unresolved Question**: None.

---

## Decision 5: Recipe & BOM Versioning Strategy

- **Decision**: Separate recipe definitions into a mutable header (`boms`) and immutable version snapshots (`bom_versions` and `bom_items`).
- **Reason**:
  - Food recipes undergo seasonal adjustments (e.g. oil absorption variations between monsoon and summer, flour moisture adjustments, spice ratio tweaks).
  - When a `ProductionOrder` is issued, it binds to a specific `bomVersionId`.
  - Future edits to the recipe create a new `BOMVersion` with an incremental version number, leaving existing production orders and historical costing records permanently undisturbed.
- **Alternatives Considered**:
  - _Single Mutable BOM Table_: Catastrophic for historical reporting. Modifying a recipe today would silently corrupt the cost and material variance analysis of batches produced six months ago.
  - _Copying Complete BOM JSON to Every Production Order_: Violates relational normalization and makes cross-batch recipe comparison difficult to query via SQL.
- **Impact**: Clean version status transitions (`DRAFT` $\rightarrow$ `ACTIVE` $\rightarrow$ `OBSOLETE`). Zero historical data corruption.
- **Unresolved Question**: None.

---

## Decision 6: Treatment of Packaging Loss & Production Scrap

- **Decision**: Model `ProductionScrap` as an explicit first-class entity linked to `ProductionRun`, capturing `scrapType: DAMAGED_PACKAGING | INGREDIENT_WASTE | REJECTED_FINISHED_GOODS`.
- **Reason**:
  - In packaged food manufacturing, packaging waste (printed multi-layer film pouches bursting in sealing jaws, misprinted lot codes) is a major hidden operational cost.
  - Standard BOM models 200 pouches for 200 packets; if 6 pouches burst during machine sealing, those 6 pouches must be relieved from inventory and financially absorbed into the batch's total manufacturing cost.
- **Alternatives Considered**:
  - _Treating Packaging Loss as Generic Warehouse Shrinkage_: Rejected because it conceals machine calibration faults from production management and distorts warehouse accuracy.
  - _Ignoring Packaging Loss_: Causes severe physical stock discrepancies between warehouse physical counts and ERP system records.
- **Impact**: Packaging waste is accounted for down to the individual piece, and its cost is incorporated directly into the finished good's unit cost calculation.
- **Unresolved Question**: None.

---

## Decision 7: GST Architecture & Historical Snapshotting

- **Decision**: Enforce an automated dual-GST engine based on State Code comparison, and persist historical tax snapshots directly onto `SalesInvoiceItem` and `InvoiceTaxBreakdown`.
- **Reason**:
  - Comparing `Factory.stateCode` with `CustomerAddress.stateCode` deterministically assigns CGST + SGST (intra-state) or IGST (inter-state).
  - Master tax rates (`tax_rates`) can be amended by government notifications at any time. Invoices are legal tax instruments that must remain immutable for five-to-eight years under Indian statutory audit rules.
- **Alternatives Considered**:
  - _Dynamic Join to TaxRate Table for Invoicing Reports_: Fatal flaw. Any future change in the master tax rate would retroactively distort past GSTR-1 filings and financial statements.
- **Impact**: `sales_invoice_items` permanently preserves `hsnCode`, `cgstRate`, `cgstAmount`, `sgstRate`, `sgstAmount`, `igstRate`, `igstAmount`, and `taxableAmount`.
- **Unresolved Question**: None.

---

## Decision 8: Normalized Payment Allocation Model

- **Decision**: Split payment processing into `payments` (the financial inflow/outflow instrument) and `payment_allocations` (the reconciliation mapping to invoices).
- **Reason**:
  - Retailers and distributors frequently make lump-sum payments (e.g. ₹10,000 against three smaller invoices) or partial payments (e.g. paying ₹4,000 against a ₹7,875 invoice).
  - Storing a single `paidAmount` directly on the invoice prevents partial payment tracking, credit management, and audit reconciliation.
  - The allocation table maintains the invariant:
    $$\text{Invoice.outstandingAmount} = \text{Invoice.totalAmount} - \sum \text{AllocatedAmount}$$
    $$\text{Payment.unallocatedAmount} = \text{Payment.amount} - \sum \text{AllocatedAmount}$$
- **Alternatives Considered**:
  - _One-to-One Payment to Invoice_: Unrealistic in Indian FMCG distribution; leads to constant reconciliation failures.
- **Impact**: Full support for partial payments, advance payments, and multi-invoice settlement.
- **Unresolved Question**: None.

---

## Decision 9: Document Lifecycle & State Machine Transitions

- **Decision**: Implement explicit lifecycle statuses on all commercial and manufacturing documents (`DRAFT` $\rightarrow$ `SUBMITTED` $\rightarrow$ `APPROVED` $\rightarrow$ `POSTED` $\rightarrow$ `CANCELLED`).
- **Reason**:
  - Prevents premature stock movements or financial posting while an order or receipt is being entered or revised.
  - Physical inventory is impacted **only** when a document transitions to `POSTED`.
- **Alternatives Considered**:
  - _Auto-Posting on Creation_: Unsuitable for multi-user environments where salesmen enter draft orders requiring credit approval before warehouse dispatch.
- **Impact**: Strict separation between draft editing and posted execution. Posted documents cannot be modified; they must be reversed via credit notes, debit notes, or stock adjustments.
- **Unresolved Question**: None.

---

## Decision 10: Multi-Warehouse & Multi-Factory Readiness

- **Decision**: Scope all inventory balances and transactions to specific `warehouseId` foreign keys, and associate warehouses with parent `factoryId`.
- **Reason**:
  - While initial operations focus on a single manufacturing unit (e.g. Trichy plant), the architecture must not require a complete rewrite when a secondary packaging depot or branch warehouse is established.
  - Multi-warehouse support allows the factory to maintain separate physical stores: Raw Ingredient Store, Packaging Foil Store, Finished Goods Dispatch Store, and Scrap Quarantine.
- **Alternatives Considered**:
  - _Global Flat Inventory without Warehouses_: Unusable in physical factory operations where ingredient contamination, packaging humidity control, and finished goods require segregated physical rooms.
- **Impact**: Clean warehouse segregation with built-in support for `StockTransfer` between stores.
- **Unresolved Question**: None.
