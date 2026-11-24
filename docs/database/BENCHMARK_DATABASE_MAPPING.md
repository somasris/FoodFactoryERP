# FoodFactory ERP – Benchmark Scenario Database Mapping

This document provides a step-by-step mapping of the **Mandatory Benchmark Scenario** to the relational database tables, attributes, calculations, and balance states defined in Phase 1.2.

---

## 1. Benchmark Execution Walkthrough

```
[ Step 1: Opening Stock ] ───> [ Step 2: Flour Purchase & MWAC ] ───> [ Step 3: Murukku Batch Production ]
                                                                                   │
                                                                                   v
[ Step 5: Retailer A Payment ] <─── [ Step 4B: Distributor B Order Shortage ] <─── [ Step 4A: Retailer A Sale & Dispatch ]
```

---

## 2. Step 1: Opening Inventory Setup

### 2.1 Target Entities Populated

- `inventory_items`
- `inventory_balances`
- `inventory_transactions` (`transactionType: OPENING_BALANCE`)
- `inventory_transaction_lines`

### 2.2 Record Mapping & State

| Item Code       | Item Name     | Item Type        | Whse        | Opening Qty    | Opening Rate | Total Valuation | Target Table         |
| :-------------- | :------------ | :--------------- | :---------- | :------------- | :----------- | :-------------- | :------------------- |
| `RM-FLOUR-01`   | Raw Flour     | `RAW_MATERIAL`   | `WH-RM-01`  | `100.0000 KG`  | `₹42.0000`   | `₹4,200.0000`   | `inventory_balances` |
| `RM-OIL-01`     | Cooking Oil   | `RAW_MATERIAL`   | `WH-RM-01`  | `30.0000 LTR`  | `₹140.0000`  | `₹4,200.0000`   | `inventory_balances` |
| `RM-SPICE-01`   | Spice Mix     | `RAW_MATERIAL`   | `WH-RM-01`  | `5.0000 KG`    | `₹200.0000`  | `₹1,000.0000`   | `inventory_balances` |
| `PKG-POUCH-MUR` | 200g Pouch    | `PACKAGING`      | `WH-PKG-01` | `500.0000 PCS` | `₹2.5000`    | `₹1,250.0000`   | `inventory_balances` |
| `PKG-BOX-MST`   | Master Carton | `PACKAGING`      | `WH-PKG-01` | `30.0000 PCS`  | `₹15.0000`   | `₹450.0000`     | `inventory_balances` |
| `SKU-MUR-200G`  | Murukku 200g  | `FINISHED_GOODS` | `WH-FG-01`  | `50.0000 PKT`  | `₹32.0000`   | `₹1,600.0000`   | `inventory_balances` |

### 2.3 Ledger Transaction Representation

- **`inventory_transactions`**:
  - `id`: `txn-open-001`
  - `transactionNumber`: `TXN-OPEN-2026-001`
  - `transactionType`: `OPENING_BALANCE`
  - `sourceDocType`: `SystemOpeningBalance`
  - `sourceDocId`: `company-001`
  - `transactionDate`: `2026-11-01 00:00:00`
- **`inventory_transaction_lines`**:
  - 6 rows created with `movementType: IN`, `balanceBefore: 0.0000`, and `balanceAfter` matching opening quantities.

---

## 3. Step 2: Raw Material Purchase & MWAC Recalculation

### 3.1 Business Event

Purchase **60 kg Flour at ₹45/kg** from Supplier (Flour Mills Ltd, Tamil Nadu).

### 3.2 Target Entities

- `purchase_orders` & `purchase_order_items`
- `goods_receipts` & `goods_receipt_items`
- `supplier_invoices`
- `inventory_transactions` (`transactionType: PURCHASE_RECEIPT`)
- `inventory_transaction_lines`
- `inventory_balances` (updated)

### 3.3 MWAC Recalculation Formula & Audit Trace

$$\text{Previous Inventory Value} = 100.0000 \text{ kg} \times ₹42.0000 = ₹4,200.0000$$

$$\text{Received Inventory Value} = 60.0000 \text{ kg} \times ₹45.0000 = ₹2,700.0000$$

$$\text{New Total Quantity} = 100.0000 + 60.0000 = 160.0000 \text{ kg}$$

$$\text{New Total Value} = ₹4,200.0000 + ₹2,700.0000 = ₹6,900.0000$$

$$\text{New Moving Weighted Average Cost (MWAC)} = \frac{₹6,900.0000}{160.0000 \text{ kg}} = \mathbf{₹43.1250 / \text{kg}}$$

### 3.4 Database Updates

- **`goods_receipt_items`**:
  - `inventoryItemId`: `item-rm-flour-01`
  - `receivedQuantity`: `60.0000`
  - `acceptedQuantity`: `60.0000`
  - `unitCost`: `45.0000`
  - `totalCost`: `2700.00`
- **`inventory_transaction_lines`**:
  - `movementType`: `IN`
  - `quantity`: `60.0000`
  - `unitCost`: `45.0000`
  - `balanceBefore`: `100.0000`
  - `balanceAfter`: `160.0000`
  - `avgCostBefore`: `42.0000`
  - `avgCostAfter`: `43.1250`
- **`inventory_balances`**:
  - `quantityOnHand`: `160.0000`
  - `averageCost`: `43.1250`
  - `totalValuation`: `6900.0000`

---

## 4. Step 3: Production of Murukku 200 g & Batch Cost Absorption

### 4.1 Standard BOM Specification (`bom_versions` & `bom_items`)

- Base Target Output: **200 packets** of Murukku 200 g.

| Item                           | Standard BOM Qty | Stock Unit |
| :----------------------------- | :--------------- | :--------- |
| Flour (`RM-FLOUR-01`)          | `40.0000`        | `KG`       |
| Oil (`RM-OIL-01`)              | `10.0000`        | `LTR`      |
| Spice Mix (`RM-SPICE-01`)      | `1.2000`         | `KG`       |
| Pouches (`PKG-POUCH-MUR`)      | `200.0000`       | `PCS`      |
| Master Cartons (`PKG-BOX-MST`) | `10.0000`        | `PCS`      |

### 4.2 Actual Production Execution (`production_runs`)

- Batch Number: `BATCH-MUR-2026-001`
- Planned Output: `200.0000` packets
- Good Output: **188.0000 packets**

#### A. Material Issues & Scrap Consumption

1. **Flour**:
   - Actual Consumed: `40.0000 KG` @ active MWAC `₹43.1250` = **₹1,725.00**
   - Stock before: `160.0000 KG` $\rightarrow$ Stock after: **120.0000 KG**
2. **Oil**:
   - Actual Consumed: `10.5000 LTR` @ active MWAC `₹140.0000` = **₹1,470.00**
   - Standard: `10.0000 LTR` $\rightarrow$ Excess: `+0.5000 LTR`
   - Oil Usage Variance: $\frac{10.5 - 10.0}{10.0} = \mathbf{+5.00\%}$
   - Stock before: `30.0000 LTR` $\rightarrow$ Stock after: **19.5000 LTR**
3. **Spice Mix**:
   - Actual Consumed: `1.2000 KG` @ active MWAC `₹200.0000` = **₹240.00**
   - Stock before: `5.0000 KG` $\rightarrow$ Stock after: **3.8000 KG**
4. **Pouches**:
   - Finished goods packaging: `188.0000 PCS` (for 188 good packets)
   - Damaged / burst pouches (`production_scrap`): `6.0000 PCS`
   - Total Pouch Consumption = $188 + 6 = \mathbf{194.0000 \text{ PCS}}$
   - Valuation: $194.0000 \times ₹2.5000 = \mathbf{₹485.00}$
   - Stock before: `500.0000 PCS` $\rightarrow$ Stock after: **306.0000 PCS** ($500 - 194 = 306$)
5. **Master Cartons**:
   - Actual Consumed: `9.0000 PCS` @ active MWAC `₹15.0000` = **₹135.00**
   - Stock before: `30.0000 PCS` $\rightarrow$ Stock after: **21.0000 PCS**

#### B. Direct Production Overheads (`production_overheads`)

- Labour Overhead: **₹1,200.00** (`costType: LABOUR`)
- Gas and Power Overhead: **₹600.00** (`costType: UTILITY`)
- Total Overheads = $₹1,200.00 + ₹600.00 = \mathbf{₹1,800.00}$

#### C. Total Batch Costing & Unit Cost Derivation

$$\text{Total Material Cost} = ₹1,725.00 + ₹1,470.00 + ₹240.00 + ₹485.00 + ₹135.00 = \mathbf{₹4,055.00}$$

$$\text{Total Production Cost} = \text{Material Cost } (₹4,055.00) + \text{Overhead Cost } (₹1,800.00) = \mathbf{₹5,855.00}$$

$$\text{Unit Cost per Good Packet} = \frac{₹5,855.00}{188 \text{ packets}} = \mathbf{₹31.1436 / \text{packet}} \quad (\approx \mathbf{₹31.14})$$

> **Costing Representation Note on Damaged Packaging**:
> The 6 damaged pouches ($6 \times ₹2.50 = ₹15.00$) are included within the 194 issued pouches ($194 \times ₹2.50 = ₹485.00$). The `production_scrap` table logs the 6 damaged pouches for loss auditing, quality tracking, and packaging variance reporting, but does **not** add an additional ₹15.00 debit to total production cost, avoiding double-counting.

#### D. Production Variances Recorded (`production_variances`)

- **Yield Variance**:
  $$\text{Variance \%} = \frac{188 - 200}{200} \times 100 = \mathbf{-6.00\%}$$
  - `varianceType`: `OUTPUT_YIELD`, `standardValue`: `200.0000`, `actualValue`: `188.0000`, `variancePercentage`: `-6.00%`.
- **Oil Usage Variance**:
  $$\text{Variance \%} = \frac{10.5 - 10.0}{10.0} \times 100 = \mathbf{+5.00\%}$$
  - `varianceType`: `MATERIAL_USAGE`, `standardValue`: `10.0000`, `actualValue`: `10.5000`, `variancePercentage`: `+5.00%`.

#### E. Finished Goods Stock Update & Warehouse Valuation Blending

- Receipt into `WH-FG-01`:
  - Quantity Produced: `188.0000 PKT`
  - Unit Production Cost: `₹31.1436`
  - Value: `₹5,855.00`
- Opening stock in `WH-FG-01`: `50.0000 PKT` @ `₹32.0000` = `₹1,600.00`
- **Finished goods closing stock after production**: $50 + 188 = \mathbf{238.0000 \text{ packets}}$.
- **Warehouse Finished Goods Blended MWAC**:
  $$\text{New FG Warehouse Average Cost} = \frac{₹1,600.00 + ₹5,855.00}{50 + 188} = \frac{₹7,455.00}{238} = \mathbf{₹31.3235 / \text{packet}}$$

---

## 5. Step 4A: Sales Order & Invoice for Retailer A (Tamil Nadu)

### 5.1 Customer Details

- Code: `CUST-RET-A` (Retailer A)
- State: `Tamil Nadu` (`stateCode: 33`)
- Factory Origin: `Tamil Nadu` (`stateCode: 33`)
- Tax Regime: **Intra-state $\rightarrow$ CGST (2.5%) + SGST (2.5%)**

### 5.2 Order Booking (`sales_orders`)

- Ordered Quantity: `150.0000 PKT`
- Unit Selling Price: `₹50.00`
- Stock Check: Available `238.0000 PKT` $\ge$ `150.0000 PKT` $\rightarrow$ **Sufficient Stock Verified**.
- Stock Allocation: `InventoryBalance.allocatedQuantity` becomes `150.0000 PKT`.

### 5.3 Invoice Generation (`sales_invoices` & `sales_invoice_items`)

- Taxable Value: $150 \times ₹50.00 = \mathbf{₹7,500.00}$
- CGST (2.5%): $\mathbf{₹187.50}$
- SGST (2.5%): $\mathbf{₹187.50}$
- IGST: $\mathbf{₹0.00}$
- Total Tax Amount: $₹187.50 + ₹187.50 = \mathbf{₹375.00}$
- **Gross Invoice Amount**: $₹7,500.00 + ₹375.00 = \mathbf{₹7,875.00}$
- `sales_invoices.outstandingAmount`: `₹7,875.00`

### 5.4 Physical Dispatch (`dispatches` & `inventory_transactions`)

- Dispatch posted for 150 packets from `WH-FG-01`.
- `inventory_transaction_lines`:
  - `movementType`: `OUT`
  - `quantity`: `150.0000 PKT`
  - `balanceBefore`: `238.0000 PKT`
  - `balanceAfter`: **88.0000 PKT**
- **Finished goods balance after dispatch**: $\mathbf{88.0000 \text{ packets}}$.

---

## 6. Step 4B: Sales Order for Distributor B (Karnataka) & Shortage Flagging

### 6.1 Customer Details

- Code: `CUST-DIST-B` (Distributor B)
- State: `Karnataka` (`stateCode: 29`)
- Factory Origin: `Tamil Nadu` (`stateCode: 33`)
- Tax Regime: **Inter-state $\rightarrow$ IGST (5.0%)**

### 6.2 Order Booking & Shortage Detection (`sales_orders` & `sales_order_items`)

- Ordered Quantity: `120.0000 PKT`
- Available Unallocated Finished Stock: $\mathbf{88.0000 \text{ PKT}}$
- **Shortage Detected**:
  $$\text{Shortage} = 120.0000 - 88.0000 = \mathbf{32.0000 \text{ packets}}$$
- **Database Representation**:
  - `sales_order_items.orderedQuantity`: `120.0000`
  - `sales_order_items.backorderedQuantity`: `32.0000`
  - `sales_orders.status`: `PARTIALLY_PROCESSED` (flagged with insufficient stock alert)
- **Tax Calculation if Invoiced (Full vs. Partial)**:
  - If invoiced upon subsequent manufacturing:
    - Taxable Value: $120 \times ₹50.00 = ₹6,000.00$
    - IGST (5%): $\mathbf{₹300.00}$
    - Total Invoice: $\mathbf{₹6,300.00}$
  - If partial invoice for available 88 packets:
    - Taxable Value: $88 \times ₹50.00 = ₹4,400.00$
    - IGST (5%): $\mathbf{₹220.00}$
    - Total Invoice: $\mathbf{₹4,620.00}$

---

## 7. Step 5: Retailer A Payment & Ledger Allocation

### 7.1 Business Event

Retailer A remits **₹4,000.00** via Bank Transfer against Invoice Total **₹7,875.00**.

### 7.2 Database Operations

- **`payments`**:
  - `id`: `pay-001`
  - `paymentNumber`: `PAY-2026-001`
  - `paymentType`: `CUSTOMER_RECEIPT`
  - `customerId`: `cust-ret-a`
  - `amount`: `4000.00`
  - `unallocatedAmount`: `0.00`
  - `status`: `POSTED`
- **`payment_allocations`**:
  - `paymentId`: `pay-001`
  - `salesInvoiceId`: `inv-ret-a-001`
  - `allocatedAmount`: `4000.00`
  - `allocationDate`: `2026-11-24`
- **`sales_invoices` (Updated)**:
  - `paidAmount`: `4000.00`
  - `outstandingAmount`: $₹7,875.00 - ₹4,000.00 = \mathbf{₹3,875.00}$
  - `status`: `PARTIALLY_PROCESSED`

---

## 8. Summary of Final Benchmark Verification

| Metric / Account               | Expected Benchmark Value | Database Schema Calculated Value  | Status          |
| :----------------------------- | :----------------------- | :-------------------------------- | :-------------- |
| **Flour Closing Stock**        | `120.0000 KG`            | `120.0000 KG`                     | **EXACT MATCH** |
| **Flour MWAC Valuation Rate**  | `₹43.1250 / KG`          | `₹43.1250 / KG`                   | **EXACT MATCH** |
| **Cooking Oil Closing Stock**  | `19.5000 LTR`            | `19.5000 LTR`                     | **EXACT MATCH** |
| **Pouch Packaging Stock**      | `306.0000 PCS`           | `306.0000 PCS`                    | **EXACT MATCH** |
| **Master Carton Stock**        | `21.0000 PCS`            | `21.0000 PCS`                     | **EXACT MATCH** |
| **Production Good Output**     | `188.0000 PKT`           | `188.0000 PKT`                    | **EXACT MATCH** |
| **Yield Variance %**           | `-6.00%`                 | `-6.00%`                          | **EXACT MATCH** |
| **Oil Usage Variance %**       | `+5.00%`                 | `+5.00%`                          | **EXACT MATCH** |
| **Batch Unit Cost**            | `₹31.1436 / PKT`         | `₹31.1436 / PKT (approx. ₹31.14)` | **EXACT MATCH** |
| **FG Stock After Production**  | `238.0000 PKT`           | `238.0000 PKT`                    | **EXACT MATCH** |
| **Retailer A Invoice Taxable** | `₹7,500.00`              | `₹7,500.00`                       | **EXACT MATCH** |
| **Retailer A CGST (2.5%)**     | `₹187.50`                | `₹187.50`                         | **EXACT MATCH** |
| **Retailer A SGST (2.5%)**     | `₹187.50`                | `₹187.50`                         | **EXACT MATCH** |
| **Retailer A Invoice Total**   | `₹7,875.00`              | `₹7,875.00`                       | **EXACT MATCH** |
| **FG Stock After Dispatch**    | `88.0000 PKT`            | `88.0000 PKT`                     | **EXACT MATCH** |
| **Distributor B Shortage**     | `32.0000 PKT`            | `32.0000 PKT` (Flagged)           | **EXACT MATCH** |
| **Retailer A Payment**         | `₹4,000.00`              | `₹4,000.00`                       | **EXACT MATCH** |
| **Retailer A Outstanding**     | `₹3,875.00`              | `₹3,875.00`                       | **EXACT MATCH** |
