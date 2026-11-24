# FoodFactory ERP – Data Dictionary

This document details the relational tables, column specifications, integrity constraints, and business rules comprising the **FoodFactory ERP** database architecture.

---

## 1. Organization & Security Tables

### 1.1 `companies`

Represents the primary legal entity operating the food manufacturing enterprise.

| Column       | Data Type      | Constraint | Nullable | Default  | Description & Business Rules                      |
| :----------- | :------------- | :--------- | :------- | :------- | :------------------------------------------------ |
| `id`         | `VARCHAR(36)`  | PK         | No       | `uuid()` | Primary Key UUID                                  |
| `code`       | `VARCHAR(20)`  | UK         | No       | -        | Unique internal code (e.g. `COMP-01`)             |
| `legal_name` | `VARCHAR(150)` | -          | No       | -        | Registered enterprise legal name                  |
| `trade_name` | `VARCHAR(150)` | -          | Yes      | -        | Brand/trade name displayed on labels              |
| `gstin`      | `VARCHAR(15)`  | UK         | No       | -        | 15-character Indian Goods & Services Tax ID       |
| `pan`        | `VARCHAR(10)`  | -          | No       | -        | 10-character Permanent Account Number             |
| `state`      | `VARCHAR(50)`  | -          | No       | -        | Registered state (e.g., `Tamil Nadu`)             |
| `state_code` | `VARCHAR(2)`   | -          | No       | -        | 2-digit Indian GST State code (e.g., `33` for TN) |
| `email`      | `VARCHAR(100)` | -          | Yes      | -        | Official contact email                            |
| `phone`      | `VARCHAR(20)`  | -          | Yes      | -        | Official contact phone                            |
| `address`    | `TEXT`         | -          | No       | -        | Registered office physical address                |
| `is_active`  | `BOOLEAN`      | -          | No       | `true`   | Active status flag                                |
| `created_at` | `TIMESTAMP(3)` | -          | No       | `now()`  | Record creation timestamp                         |
| `updated_at` | `TIMESTAMP(3)` | -          | No       | `now()`  | Last modification timestamp                       |

### 1.2 `factories`

Manufacturing sites where food processing, frying, baking, and packaging operations occur.

| Column       | Data Type      | Constraint | Nullable | Default  | Description & Business Rules                 |
| :----------- | :------------- | :--------- | :------- | :------- | :------------------------------------------- |
| `id`         | `VARCHAR(36)`  | PK         | No       | `uuid()` | Primary Key UUID                             |
| `company_id` | `VARCHAR(36)`  | FK         | No       | -        | Foreign Key to `companies.id`                |
| `code`       | `VARCHAR(20)`  | UK         | No       | -        | Unique factory code (e.g. `FAC-TRICHY-01`)   |
| `name`       | `VARCHAR(100)` | -          | No       | -        | Factory name                                 |
| `state`      | `VARCHAR(50)`  | -          | No       | -        | Factory state location                       |
| `state_code` | `VARCHAR(2)`   | -          | No       | -        | GST State code (origin for tax calculations) |
| `address`    | `TEXT`         | -          | No       | -        | Factory physical premises address            |
| `is_active`  | `BOOLEAN`      | -          | No       | `true`   | Active status flag                           |
| `created_at` | `TIMESTAMP(3)` | -          | No       | `now()`  | Record creation timestamp                    |
| `updated_at` | `TIMESTAMP(3)` | -          | No       | `now()`  | Last modification timestamp                  |

### 1.3 `warehouses`

Storage facilities within or associated with a factory site.

| Column           | Data Type      | Constraint | Nullable | Default  | Description & Business Rules                                              |
| :--------------- | :------------- | :--------- | :------- | :------- | :------------------------------------------------------------------------ |
| `id`             | `VARCHAR(36)`  | PK         | No       | `uuid()` | Primary Key UUID                                                          |
| `factory_id`     | `VARCHAR(36)`  | FK         | No       | -        | Foreign Key to `factories.id`                                             |
| `code`           | `VARCHAR(20)`  | UK         | No       | -        | Warehouse code (e.g. `WH-RM-01`)                                          |
| `name`           | `VARCHAR(100)` | -          | No       | -        | Descriptive warehouse name                                                |
| `warehouse_type` | `ENUM`         | -          | No       | -        | `RAW_MATERIAL`, `PACKAGING`, `FINISHED_GOODS`, `GENERAL`, `SCRAP_DAMAGED` |
| `address`        | `TEXT`         | -          | Yes      | -        | Physical location within or outside plant                                 |
| `is_active`      | `BOOLEAN`      | -          | No       | `true`   | Active status flag                                                        |
| `created_at`     | `TIMESTAMP(3)` | -          | No       | `now()`  | Record creation timestamp                                                 |
| `updated_at`     | `TIMESTAMP(3)` | -          | No       | `now()`  | Last modification timestamp                                               |

### 1.4 `users`

System accounts for factory staff, salesmen, administrators, owners, and auditors.

| Column          | Data Type      | Constraint | Nullable | Default  | Description & Business Rules                    |
| :-------------- | :------------- | :--------- | :------- | :------- | :---------------------------------------------- |
| `id`            | `VARCHAR(36)`  | PK         | No       | `uuid()` | Primary Key UUID                                |
| `company_id`    | `VARCHAR(36)`  | FK         | No       | -        | Foreign Key to `companies.id`                   |
| `email`         | `VARCHAR(100)` | UK         | No       | -        | Unique login email address                      |
| `username`      | `VARCHAR(50)`  | UK         | No       | -        | Unique username identifier                      |
| `password_hash` | `VARCHAR(255)` | -          | No       | -        | Hashed credential (prepared for Phase 1.2 auth) |
| `full_name`     | `VARCHAR(100)` | -          | No       | -        | User display name                               |
| `phone`         | `VARCHAR(20)`  | -          | Yes      | -        | Mobile contact number                           |
| `is_active`     | `BOOLEAN`      | -          | No       | `true`   | Account active flag                             |
| `created_at`    | `TIMESTAMP(3)` | -          | No       | `now()`  | Record creation timestamp                       |
| `updated_at`    | `TIMESTAMP(3)` | -          | No       | `now()`  | Last modification timestamp                     |

### 1.5 `roles` & `user_roles`

Normalized roles defining access privileges across the ERP.

| Table        | Column        | Data Type      | Constraint | Nullable | Description                                                 |
| :----------- | :------------ | :------------- | :--------- | :------- | :---------------------------------------------------------- |
| `roles`      | `id`          | `VARCHAR(36)`  | PK         | No       | Role UUID                                                   |
| `roles`      | `code`        | `VARCHAR(30)`  | UK         | No       | `SALESMAN`, `ADMIN`, `PRODUCTION`, `OWNER`, `AUDITOR`       |
| `roles`      | `name`        | `VARCHAR(50)`  | -          | No       | Human-readable role title                                   |
| `roles`      | `description` | `VARCHAR(255)` | -          | Yes      | Operational scope description                               |
| `user_roles` | `id`          | `VARCHAR(36)`  | PK         | No       | Assignment UUID                                             |
| `user_roles` | `user_id`     | `VARCHAR(36)`  | FK         | No       | FK to `users.id`                                            |
| `user_roles` | `role_id`     | `VARCHAR(36)`  | FK         | No       | FK to `roles.id`                                            |
| `user_roles` | `assigned_at` | `TIMESTAMP(3)` | -          | No       | Assignment timestamp (Composite UK on `user_id`, `role_id`) |

### 1.6 `audit_logs`

Immutable record of system state modifications.

| Column           | Data Type      | Constraint | Nullable | Default  | Description & Business Rules                              |
| :--------------- | :------------- | :--------- | :------- | :------- | :-------------------------------------------------------- |
| `id`             | `VARCHAR(36)`  | PK         | No       | `uuid()` | Primary Key UUID                                          |
| `user_id`        | `VARCHAR(36)`  | FK         | Yes      | -        | Nullable FK to `users.id` (null if system batch)          |
| `action`         | `VARCHAR(50)`  | -          | No       | -        | `CREATE`, `UPDATE`, `DELETE`, `APPROVE`, `POST`, `CANCEL` |
| `entity_type`    | `VARCHAR(50)`  | -          | No       | -        | Table name (e.g. `SalesInvoice`, `InventoryBalance`)      |
| `entity_id`      | `VARCHAR(36)`  | -          | No       | -        | UUID of the entity modified                               |
| `previous_state` | `JSONB`        | -          | Yes      | -        | Snapshot of attributes before change                      |
| `new_state`      | `JSONB`        | -          | Yes      | -        | Snapshot of attributes after change                       |
| `ip_address`     | `VARCHAR(45)`  | -          | Yes      | -        | IPv4 / IPv6 client network address                        |
| `user_agent`     | `TEXT`         | -          | Yes      | -        | Browser / client identification string                    |
| `remarks`        | `TEXT`         | -          | Yes      | -        | Mandatory justification for cancellations & adjustments   |
| `created_at`     | `TIMESTAMP(3)` | -          | No       | `now()`  | Tamper-evident timestamp                                  |

---

## 2. Master Data & Inventory Bridge Tables

### 2.1 `units_of_measure` & `unit_conversions`

Physical measurement standards and mathematical conversion factors.

| Table              | Column           | Data Type       | Constraint | Nullable | Description                                      |
| :----------------- | :--------------- | :-------------- | :--------- | :------- | :----------------------------------------------- |
| `units_of_measure` | `id`             | `VARCHAR(36)`   | PK         | No       | UOM UUID                                         |
| `units_of_measure` | `code`           | `VARCHAR(10)`   | UK         | No       | `KG`, `LTR`, `PCS`, `PKT`, `G`, `ML`, `BOX`      |
| `units_of_measure` | `name`           | `VARCHAR(50)`   | -          | No       | Full name (e.g. Kilogram, Litre, Packet)         |
| `units_of_measure` | `symbol`         | `VARCHAR(10)`   | -          | No       | Short symbol                                     |
| `units_of_measure` | `is_base_unit`   | `BOOLEAN`       | -          | No       | Base standard flag                               |
| `units_of_measure` | `decimal_places` | `INT`           | -          | No       | Rounding scale (e.g., 4 for KG/L, 0 for PKT/BOX) |
| `unit_conversions` | `id`             | `VARCHAR(36)`   | PK         | No       | Conversion UUID                                  |
| `unit_conversions` | `from_uom_id`    | `VARCHAR(36)`   | FK         | No       | FK to `units_of_measure.id`                      |
| `unit_conversions` | `to_uom_id`      | `VARCHAR(36)`   | FK         | No       | FK to `units_of_measure.id`                      |
| `unit_conversions` | `multiplier`     | `DECIMAL(18,6)` | -          | No       | Factor to multiply `from_uom` to yield `to_uom`  |

### 2.2 `raw_materials`

Master catalog of food ingredients (flour, oil, spices) and packaging materials (pouches, cartons).

| Column             | Data Type       | Constraint | Nullable | Default  | Description & Business Rules                                 |
| :----------------- | :-------------- | :--------- | :------- | :------- | :----------------------------------------------------------- |
| `id`               | `VARCHAR(36)`   | PK         | No       | `uuid()` | Primary Key UUID                                             |
| `category_id`      | `VARCHAR(36)`   | FK         | No       | -        | FK to `raw_material_categories.id`                           |
| `code`             | `VARCHAR(30)`   | UK         | No       | -        | Unique SKU/code (e.g. `RM-FLOUR-01`, `PKG-POUCH-MUR`)        |
| `name`             | `VARCHAR(100)`  | -          | No       | -        | Material name (e.g., "Gram Flour", "Oil", "200g Pouch")      |
| `material_type`    | `ENUM`          | -          | No       | -        | `RAW_INGREDIENT`, `PACKAGING_PRIMARY`, `PACKAGING_SECONDARY` |
| `uom_id`           | `VARCHAR(36)`   | FK         | No       | -        | Standard stocking UOM                                        |
| `hsn_code`         | `VARCHAR(10)`   | -          | No       | -        | 4-to-8 digit Harmonized System of Nomenclature code          |
| `tax_rate_id`      | `VARCHAR(36)`   | FK         | No       | -        | FK to applicable `tax_rates.id`                              |
| `min_stock_alert`  | `DECIMAL(14,4)` | -          | No       | `0.0000` | Safety stock threshold triggering reorder warnings           |
| `reorder_quantity` | `DECIMAL(14,4)` | -          | Yes      | -        | Recommended minimum procurement batch size                   |
| `is_active`        | `BOOLEAN`       | -          | No       | `true`   | Active status flag                                           |

### 2.3 `products` & `product_variants`

Manufactured packaged food products and retail packaging sizes.

| Table              | Column                  | Data Type       | Constraint | Nullable | Description                                       |
| :----------------- | :---------------------- | :-------------- | :--------- | :------- | :------------------------------------------------ |
| `products`         | `id`                    | `VARCHAR(36)`   | PK         | No       | Product UUID                                      |
| `products`         | `category_id`           | `VARCHAR(36)`   | FK         | No       | FK to `product_categories.id`                     |
| `products`         | `code`                  | `VARCHAR(30)`   | UK         | No       | Product line code (e.g., `PRD-MURUKKU`)           |
| `products`         | `name`                  | `VARCHAR(100)`  | -          | No       | Base product line (e.g., "Handmade Murukku")      |
| `products`         | `base_uom_id`           | `VARCHAR(36)`   | FK         | No       | Base stocking unit (e.g., `KG`)                   |
| `products`         | `hsn_code`              | `VARCHAR(10)`   | -          | No       | GST HSN code (e.g., `21069099`)                   |
| `products`         | `tax_rate_id`           | `VARCHAR(36)`   | FK         | No       | Standard tax rate (e.g., 5% GST)                  |
| `product_variants` | `id`                    | `VARCHAR(36)`   | PK         | No       | Variant UUID                                      |
| `product_variants` | `product_id`            | `VARCHAR(36)`   | FK         | No       | FK to `products.id`                               |
| `product_variants` | `sku`                   | `VARCHAR(30)`   | UK         | No       | Unique Stock Keeping Unit (e.g., `SKU-MUR-200G`)  |
| `product_variants` | `name`                  | `VARCHAR(100)`  | -          | No       | Commercial variant name (e.g., "Murukku 200 g")   |
| `product_variants` | `net_weight_grams`      | `DECIMAL(10,2)` | -          | No       | Net weight in grams (e.g., `200.00`)              |
| `product_variants` | `uom_id`                | `VARCHAR(36)`   | FK         | No       | Retail package UOM (e.g., `PKT`)                  |
| `product_variants` | `default_selling_price` | `DECIMAL(12,2)` | -          | No       | Baseline selling price before tax (e.g., `50.00`) |
| `product_variants` | `barcode`               | `VARCHAR(50)`   | UK         | Yes      | EAN-13 / UPC barcode                              |

### 2.4 `inventory_items`

Unified polymorphic bridge linking `raw_materials` and `product_variants` to the inventory engine.

| Column                | Data Type       | Constraint | Nullable | Default  | Description & Business Rules                         |
| :-------------------- | :-------------- | :--------- | :------- | :------- | :--------------------------------------------------- |
| `id`                  | `VARCHAR(36)`   | PK         | No       | `uuid()` | Primary Key UUID                                     |
| `item_type`           | `ENUM`          | -          | No       | -        | `RAW_MATERIAL`, `PACKAGING`, `FINISHED_GOODS`        |
| `raw_material_id`     | `VARCHAR(36)`   | FK         | Yes      | -        | 1:1 FK to `raw_materials.id` (null if finished good) |
| `product_variant_id`  | `VARCHAR(36)`   | FK         | Yes      | -        | 1:1 FK to `product_variants.id` (null if raw/pkg)    |
| `code`                | `VARCHAR(30)`   | UK         | No       | -        | Mirror of material code or product SKU               |
| `name`                | `VARCHAR(100)`  | -          | No       | -        | Mirror of item name                                  |
| `uom_id`              | `VARCHAR(36)`   | FK         | No       | -        | Authoritative stocking UOM                           |
| `valuation_method`    | `ENUM`          | -          | No       | -        | `MWAC` (Moving Weighted Average) or `BATCH_ACTUAL`   |
| `moving_average_cost` | `DECIMAL(18,4)` | -          | No       | `0.0000` | Global cached average unit cost                      |
| `is_active`           | `BOOLEAN`       | -          | No       | `true`   | Active status flag                                   |

---

## 3. Purchasing & Supplier Management Tables

### 3.1 `suppliers` & `supplier_addresses`

Vendor profiles for ingredients and packaging film converters.

| Table                | Column               | Data Type      | Constraint | Nullable | Description                               |
| :------------------- | :------------------- | :------------- | :--------- | :------- | :---------------------------------------- |
| `suppliers`          | `id`                 | `VARCHAR(36)`  | PK         | No       | Supplier UUID                             |
| `suppliers`          | `code`               | `VARCHAR(20)`  | UK         | No       | Unique vendor code (e.g., `SUP-FLOUR-01`) |
| `suppliers`          | `legal_name`         | `VARCHAR(150)` | -          | No       | Registered business name                  |
| `suppliers`          | `trade_name`         | `VARCHAR(150)` | -          | Yes      | Trade/brand name                          |
| `suppliers`          | `gstin`              | `VARCHAR(15)`  | UK         | Yes      | Supplier GSTIN                            |
| `suppliers`          | `pan`                | `VARCHAR(10)`  | -          | Yes      | Supplier PAN                              |
| `suppliers`          | `payment_terms_days` | `INT`          | -          | No       | Credit period in days (e.g., 30)          |
| `supplier_addresses` | `id`                 | `VARCHAR(36)`  | PK         | No       | Address UUID                              |
| `supplier_addresses` | `supplier_id`        | `VARCHAR(36)`  | FK         | No       | FK to `suppliers.id`                      |
| `supplier_addresses` | `state`              | `VARCHAR(50)`  | -          | No       | State name                                |
| `supplier_addresses` | `state_code`         | `VARCHAR(2)`   | -          | No       | 2-digit GST state code                    |

### 3.2 `purchase_orders` & `purchase_order_items`

Procurement contracts for raw materials and packaging.

| Table                  | Column              | Data Type       | Constraint | Nullable | Description                                                           |
| :--------------------- | :------------------ | :-------------- | :--------- | :------- | :-------------------------------------------------------------------- |
| `purchase_orders`      | `id`                | `VARCHAR(36)`   | PK         | No       | PO UUID                                                               |
| `purchase_orders`      | `po_number`         | `VARCHAR(30)`   | UK         | No       | Sequential PO number (e.g., `PO-2026-001`)                            |
| `purchase_orders`      | `supplier_id`       | `VARCHAR(36)`   | FK         | No       | FK to `suppliers.id`                                                  |
| `purchase_orders`      | `factory_id`        | `VARCHAR(36)`   | FK         | No       | FK to `factories.id`                                                  |
| `purchase_orders`      | `warehouse_id`      | `VARCHAR(36)`   | FK         | No       | Destination warehouse                                                 |
| `purchase_orders`      | `order_date`        | `DATE`          | -          | No       | PO issue date                                                         |
| `purchase_orders`      | `status`            | `ENUM`          | -          | No       | `DRAFT`, `SUBMITTED`, `APPROVED`, `PARTIAL`, `COMPLETED`, `CANCELLED` |
| `purchase_orders`      | `total_amount`      | `DECIMAL(14,2)` | -          | No       | Total PO gross value                                                  |
| `purchase_order_items` | `id`                | `VARCHAR(36)`   | PK         | No       | Item UUID                                                             |
| `purchase_order_items` | `purchase_order_id` | `VARCHAR(36)`   | FK         | No       | FK to `purchase_orders.id`                                            |
| `purchase_order_items` | `inventory_item_id` | `VARCHAR(36)`   | FK         | No       | FK to `inventory_items.id`                                            |
| `purchase_order_items` | `ordered_quantity`  | `DECIMAL(14,4)` | -          | No       | Quantity contracted                                                   |
| `purchase_order_items` | `unit_price`        | `DECIMAL(14,4)` | -          | No       | Negotiated rate before tax                                            |
| `purchase_order_items` | `taxable_amount`    | `DECIMAL(14,2)` | -          | No       | `ordered_quantity * unit_price`                                       |
| `purchase_order_items` | `total_amount`      | `DECIMAL(14,2)` | -          | No       | Line total inclusive of GST                                           |
| `purchase_order_items` | `received_quantity` | `DECIMAL(14,4)` | -          | No       | Cumulative quantity received                                          |

### 3.3 `goods_receipts` & `goods_receipt_items`

Physical receipt and inspection records triggering inventory ledger postings.

| Table                 | Column                | Data Type       | Constraint | Nullable | Description                                  |
| :-------------------- | :-------------------- | :-------------- | :--------- | :------- | :------------------------------------------- |
| `goods_receipts`      | `id`                  | `VARCHAR(36)`   | PK         | No       | GRN UUID                                     |
| `goods_receipts`      | `grn_number`          | `VARCHAR(30)`   | UK         | No       | Sequential GRN number (e.g., `GRN-2026-001`) |
| `goods_receipts`      | `purchase_order_id`   | `VARCHAR(36)`   | FK         | Yes      | Nullable FK to `purchase_orders.id`          |
| `goods_receipts`      | `supplier_id`         | `VARCHAR(36)`   | FK         | No       | FK to `suppliers.id`                         |
| `goods_receipts`      | `warehouse_id`        | `VARCHAR(36)`   | FK         | No       | Receiving warehouse                          |
| `goods_receipts`      | `receipt_date`        | `TIMESTAMP(3)`  | -          | No       | Physical gate delivery timestamp             |
| `goods_receipts`      | `supplier_invoice_no` | `VARCHAR(50)`   | -          | Yes      | Vendor challan or bill reference             |
| `goods_receipts`      | `status`              | `ENUM`          | -          | No       | `DRAFT`, `POSTED`, `CANCELLED`               |
| `goods_receipts`      | `posted_by_id`        | `VARCHAR(36)`   | FK         | Yes      | User who posted GRN into ledger              |
| `goods_receipts`      | `posted_at`           | `TIMESTAMP(3)`  | -          | Yes      | Timestamp of ledger posting                  |
| `goods_receipt_items` | `id`                  | `VARCHAR(36)`   | PK         | No       | GRN Item UUID                                |
| `goods_receipt_items` | `goods_receipt_id`    | `VARCHAR(36)`   | FK         | No       | FK to `goods_receipts.id`                    |
| `goods_receipt_items` | `inventory_item_id`   | `VARCHAR(36)`   | FK         | No       | Item received                                |
| `goods_receipt_items` | `received_quantity`   | `DECIMAL(14,4)` | -          | No       | Physical quantity offloaded                  |
| `goods_receipt_items` | `accepted_quantity`   | `DECIMAL(14,4)` | -          | No       | Quality-cleared quantity (credited to stock) |
| `goods_receipt_items` | `rejected_quantity`   | `DECIMAL(14,4)` | -          | No       | Defective quantity rejected at gate          |
| `goods_receipt_items` | `unit_cost`           | `DECIMAL(14,4)` | -          | No       | Purchase price per unit                      |
| `goods_receipt_items` | `total_cost`          | `DECIMAL(14,2)` | -          | No       | Total value entering stock                   |
| `goods_receipt_items` | `batch_number`        | `VARCHAR(50)`   | -          | Yes      | Supplier lot number                          |
| `goods_receipt_items` | `expiry_date`         | `DATE`          | -          | Yes      | Expiration date of raw material lot          |

---

## 4. Immutable Inventory Ledger Tables

### 4.1 `inventory_balances`

Cached per-warehouse balance state for high-concurrency availability checks.

| Column               | Data Type       | Constraint   | Nullable | Default  | Description & Business Rules             |
| :------------------- | :-------------- | :----------- | :------- | :------- | :--------------------------------------- |
| `id`                 | `VARCHAR(36)`   | PK           | No       | `uuid()` | Primary Key UUID                         |
| `inventory_item_id`  | `VARCHAR(36)`   | FK           | No       | -        | Foreign Key to `inventory_items.id`      |
| `warehouse_id`       | `VARCHAR(36)`   | FK           | No       | -        | Foreign Key to `warehouses.id`           |
| `quantity_on_hand`   | `DECIMAL(18,4)` | CHECK `>= 0` | No       | `0.0000` | Total physical stock in warehouse        |
| `allocated_quantity` | `DECIMAL(18,4)` | CHECK `>= 0` | No       | `0.0000` | Stock reserved for approved sales orders |
| `average_cost`       | `DECIMAL(18,4)` | -            | No       | `0.0000` | Current Moving Weighted Average Cost     |
| `total_valuation`    | `DECIMAL(18,4)` | -            | No       | `0.0000` | `quantity_on_hand * average_cost`        |
| `last_updated_at`    | `TIMESTAMP(3)`  | -            | No       | `now()`  | Timestamp of last ledger update          |

_Integrity Rule_: Unique composite constraint on `(inventory_item_id, warehouse_id)`.

### 4.2 `inventory_transactions` & `inventory_transaction_lines`

Authoritative, immutable append-only ledger of every physical stock movement.

| Table                         | Column               | Data Type       | Constraint | Nullable | Description                                                                                                                                                                             |
| :---------------------------- | :------------------- | :-------------- | :--------- | :------- | :-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `inventory_transactions`      | `id`                 | `VARCHAR(36)`   | PK         | No       | Transaction UUID                                                                                                                                                                        |
| `inventory_transactions`      | `transaction_number` | `VARCHAR(30)`   | UK         | No       | Sequential ID (e.g. `TXN-2026-0001`)                                                                                                                                                    |
| `inventory_transactions`      | `transaction_type`   | `ENUM`          | -          | No       | `OPENING_BALANCE`, `PURCHASE_RECEIPT`, `PRODUCTION_ISSUE`, `PRODUCTION_RECEIPT`, `SALES_DISPATCH`, `SALES_RETURN`, `PURCHASE_RETURN`, `STOCK_ADJUSTMENT`, `TRANSFER_IN`, `TRANSFER_OUT` |
| `inventory_transactions`      | `source_doc_type`    | `VARCHAR(50)`   | -          | No       | Source entity name (e.g., `GoodsReceipt`)                                                                                                                                               |
| `inventory_transactions`      | `source_doc_id`      | `VARCHAR(36)`   | -          | No       | UUID of the source document                                                                                                                                                             |
| `inventory_transactions`      | `warehouse_id`       | `VARCHAR(36)`   | FK         | No       | Warehouse where movement occurred                                                                                                                                                       |
| `inventory_transactions`      | `transaction_date`   | `TIMESTAMP(3)`  | -          | No       | Document transaction timestamp                                                                                                                                                          |
| `inventory_transactions`      | `posted_by_id`       | `VARCHAR(36)`   | FK         | No       | User posting the movement                                                                                                                                                               |
| `inventory_transactions`      | `posted_at`          | `TIMESTAMP(3)`  | -          | No       | Database posting timestamp                                                                                                                                                              |
| `inventory_transaction_lines` | `id`                 | `VARCHAR(36)`   | PK         | No       | Line UUID                                                                                                                                                                               |
| `inventory_transaction_lines` | `transaction_id`     | `VARCHAR(36)`   | FK         | No       | FK to `inventory_transactions.id`                                                                                                                                                       |
| `inventory_transaction_lines` | `inventory_item_id`  | `VARCHAR(36)`   | FK         | No       | Item moved                                                                                                                                                                              |
| `inventory_transaction_lines` | `warehouse_id`       | `VARCHAR(36)`   | FK         | No       | Warehouse location                                                                                                                                                                      |
| `inventory_transaction_lines` | `movement_type`      | `ENUM`          | -          | No       | `IN` (Credit) or `OUT` (Debit)                                                                                                                                                          |
| `inventory_transaction_lines` | `quantity`           | `DECIMAL(14,4)` | -          | No       | Absolute movement quantity                                                                                                                                                              |
| `inventory_transaction_lines` | `unit_cost`          | `DECIMAL(18,4)` | -          | No       | Valuation rate applied to movement                                                                                                                                                      |
| `inventory_transaction_lines` | `total_value`        | `DECIMAL(18,4)` | -          | No       | `quantity * unit_cost`                                                                                                                                                                  |
| `inventory_transaction_lines` | `balance_before`     | `DECIMAL(18,4)` | -          | No       | `quantity_on_hand` prior to posting                                                                                                                                                     |
| `inventory_transaction_lines` | `balance_after`      | `DECIMAL(18,4)` | -          | No       | `quantity_on_hand` following posting                                                                                                                                                    |
| `inventory_transaction_lines` | `avg_cost_before`    | `DECIMAL(18,4)` | -          | No       | `average_cost` prior to posting                                                                                                                                                         |
| `inventory_transaction_lines` | `avg_cost_after`     | `DECIMAL(18,4)` | -          | No       | `average_cost` following posting                                                                                                                                                        |
| `inventory_transaction_lines` | `batch_number`       | `VARCHAR(50)`   | -          | Yes      | Lot / batch identifier                                                                                                                                                                  |

---

## 5. Bill of Materials (BOM) & Production Tables

### 5.1 `boms`, `bom_versions`, & `bom_items`

Standard product formulations and packaging recipes.

| Table          | Column                    | Data Type       | Constraint | Nullable | Description                                |
| :------------- | :------------------------ | :-------------- | :--------- | :------- | :----------------------------------------- |
| `boms`         | `id`                      | `VARCHAR(36)`   | PK         | No       | Recipe UUID                                |
| `boms`         | `product_variant_id`      | `VARCHAR(36)`   | FK         | No       | FK to `product_variants.id`                |
| `boms`         | `code`                    | `VARCHAR(30)`   | UK         | No       | Recipe code (e.g., `BOM-MUR-200G`)         |
| `boms`         | `name`                    | `VARCHAR(100)`  | -          | No       | Descriptive name                           |
| `boms`         | `base_output_quantity`    | `DECIMAL(14,4)` | -          | No       | Standard batch quantity (e.g., `200.0000`) |
| `boms`         | `output_uom_id`           | `VARCHAR(36)`   | FK         | No       | Finished good UOM (e.g. `PKT`)             |
| `bom_versions` | `id`                      | `VARCHAR(36)`   | PK         | No       | Version UUID                               |
| `bom_versions` | `bom_id`                  | `VARCHAR(36)`   | FK         | No       | FK to `boms.id`                            |
| `bom_versions` | `version_number`          | `INT`           | -          | No       | Incremental version index (`1, 2, ...`)    |
| `bom_versions` | `status`                  | `ENUM`          | -          | No       | `DRAFT`, `ACTIVE`, `OBSOLETE`              |
| `bom_versions` | `effective_from`          | `DATE`          | -          | No       | Date version becomes operational           |
| `bom_versions` | `effective_to`            | `DATE`          | -          | Yes      | Sunset date (null if active)               |
| `bom_versions` | `expected_good_output`    | `DECIMAL(14,4)` | -          | No       | Standard yield output (e.g. `200.0000`)    |
| `bom_versions` | `approved_by_id`          | `VARCHAR(36)`   | FK         | Yes      | User who authorized the recipe             |
| `bom_items`    | `id`                      | `VARCHAR(36)`   | PK         | No       | Item UUID                                  |
| `bom_items`    | `bom_version_id`          | `VARCHAR(36)`   | FK         | No       | FK to `bom_versions.id`                    |
| `bom_items`    | `inventory_item_id`       | `VARCHAR(36)`   | FK         | No       | Ingredient or packaging item               |
| `bom_items`    | `item_type`               | `ENUM`          | -          | No       | `RAW_MATERIAL`, `PACKAGING`                |
| `bom_items`    | `standard_quantity`       | `DECIMAL(14,4)` | -          | No       | Expected quantity for base output          |
| `bom_items`    | `uom_id`                  | `VARCHAR(36)`   | FK         | No       | Ingredient UOM (KG, LTR, PCS)              |
| `bom_items`    | `scrap_tolerance_percent` | `DECIMAL(5,2)`  | -          | No       | Standard allowable shrinkage %             |

### 5.2 `production_orders` & `production_runs`

Shop-floor work orders, execution batches, and variance tracking.

| Table               | Column                   | Data Type       | Constraint | Nullable | Description                                                  |
| :------------------ | :----------------------- | :-------------- | :--------- | :------- | :----------------------------------------------------------- |
| `production_orders` | `id`                     | `VARCHAR(36)`   | PK         | No       | Order UUID                                                   |
| `production_orders` | `order_number`           | `VARCHAR(30)`   | UK         | No       | Sequential ID (e.g. `PRD-ORD-2026-001`)                      |
| `production_orders` | `factory_id`             | `VARCHAR(36)`   | FK         | No       | FK to `factories.id`                                         |
| `production_orders` | `product_variant_id`     | `VARCHAR(36)`   | FK         | No       | Target product to produce                                    |
| `production_orders` | `bom_version_id`         | `VARCHAR(36)`   | FK         | No       | Locked recipe version                                        |
| `production_orders` | `planned_quantity`       | `DECIMAL(14,4)` | -          | No       | Target packets to manufacture (e.g. `200`)                   |
| `production_orders` | `status`                 | `ENUM`          | -          | No       | `DRAFT`, `RELEASED`, `IN_PROGRESS`, `COMPLETED`, `CANCELLED` |
| `production_runs`   | `id`                     | `VARCHAR(36)`   | PK         | No       | Run UUID                                                     |
| `production_runs`   | `run_number`             | `VARCHAR(30)`   | UK         | No       | Sequential run ID (e.g. `RUN-2026-001`)                      |
| `production_runs`   | `production_order_id`    | `VARCHAR(36)`   | FK         | No       | FK to `production_orders.id`                                 |
| `production_runs`   | `batch_number`           | `VARCHAR(50)`   | UK         | No       | Physical manufacturing batch code                            |
| `production_runs`   | `status`                 | `ENUM`          | -          | No       | `STARTED`, `COMPLETED`, `CANCELLED`                          |
| `production_runs`   | `planned_quantity`       | `DECIMAL(14,4)` | -          | No       | Planned output (e.g., `200.0000`)                            |
| `production_runs`   | `actual_good_output`     | `DECIMAL(14,4)` | -          | No       | Actual good packets produced (e.g. `188`)                    |
| `production_runs`   | `total_material_cost`    | `DECIMAL(14,2)` | -          | No       | Sum of ingredient & packaging consumption                    |
| `production_runs`   | `total_overhead_cost`    | `DECIMAL(14,2)` | -          | No       | Sum of labor and utility costs                               |
| `production_runs`   | `total_production_cost`  | `DECIMAL(14,2)` | -          | No       | `material_cost + overhead_cost`                              |
| `production_runs`   | `unit_cost_per_item`     | `DECIMAL(18,4)` | -          | No       | `total_production_cost / actual_good_output`                 |
| `production_runs`   | `yield_variance_percent` | `DECIMAL(5,2)`  | -          | No       | Output yield percentage delta (e.g., `-6.00%`)               |

### 5.3 `material_issues`, `production_scrap`, & `production_overheads`

Detailed breakdown of costs and wastes absorbed by each batch.

| Table                  | Column                   | Data Type       | Constraint | Nullable | Description                                                        |
| :--------------------- | :----------------------- | :-------------- | :--------- | :------- | :----------------------------------------------------------------- |
| `material_issues`      | `id`                     | `VARCHAR(36)`   | PK         | No       | Issue UUID                                                         |
| `material_issues`      | `issue_number`           | `VARCHAR(30)`   | UK         | No       | Issue document reference                                           |
| `material_issues`      | `production_run_id`      | `VARCHAR(36)`   | FK         | No       | FK to `production_runs.id`                                         |
| `material_issue_items` | `id`                     | `VARCHAR(36)`   | PK         | No       | Issue Item UUID                                                    |
| `material_issue_items` | `material_issue_id`      | `VARCHAR(36)`   | FK         | No       | FK to `material_issues.id`                                         |
| `material_issue_items` | `inventory_item_id`      | `VARCHAR(36)`   | FK         | No       | Raw material or packaging issued                                   |
| `material_issue_items` | `planned_quantity`       | `DECIMAL(14,4)` | -          | No       | Standard BOM expected quantity                                     |
| `material_issue_items` | `actual_quantity`        | `DECIMAL(14,4)` | -          | No       | Actual quantity consumed                                           |
| `material_issue_items` | `unit_cost`              | `DECIMAL(18,4)` | -          | No       | MWAC rate at time of issue                                         |
| `material_issue_items` | `total_cost`             | `DECIMAL(14,2)` | -          | No       | Value debited to production                                        |
| `material_issue_items` | `usage_variance_percent` | `DECIMAL(5,2)`  | -          | No       | Usage variance % (e.g., `+5.00%` for oil)                          |
| `production_scrap`     | `id`                     | `VARCHAR(36)`   | PK         | No       | Scrap UUID                                                         |
| `production_scrap`     | `production_run_id`      | `VARCHAR(36)`   | FK         | No       | FK to `production_runs.id`                                         |
| `production_scrap`     | `inventory_item_id`      | `VARCHAR(36)`   | FK         | No       | Wasted item (e.g., damaged pouches)                                |
| `production_scrap`     | `scrap_type`             | `ENUM`          | -          | No       | `DAMAGED_PACKAGING`, `INGREDIENT_WASTE`, `REJECTED_FINISHED_GOODS` |
| `production_scrap`     | `quantity`               | `DECIMAL(14,4)` | -          | No       | Damaged quantity (e.g., `6` pouches)                               |
| `production_scrap`     | `unit_cost`              | `DECIMAL(18,4)` | -          | No       | Cost per unit absorbed into batch cost                             |
| `production_overheads` | `id`                     | `VARCHAR(36)`   | PK         | No       | Overhead UUID                                                      |
| `production_overheads` | `production_run_id`      | `VARCHAR(36)`   | FK         | No       | FK to `production_runs.id`                                         |
| `production_overheads` | `description`            | `VARCHAR(150)`  | -          | No       | e.g., "Labour overhead", "Gas and power"                           |
| `production_overheads` | `cost_type`              | `ENUM`          | -          | No       | `LABOUR`, `UTILITY`, `MACHINE_DEPRECIATION`                        |
| `production_overheads` | `amount`                 | `DECIMAL(12,2)` | -          | No       | Cost allocated to batch (e.g., `1200.00`, `600.00`)                |

---

## 6. Sales, GST, Invoicing & Payment Tables

### 6.1 `customers` & `customer_addresses`

Commercial client profiles for retail stores and regional distributors.

| Table                | Column               | Data Type       | Constraint | Nullable | Description                                           |
| :------------------- | :------------------- | :-------------- | :--------- | :------- | :---------------------------------------------------- |
| `customers`          | `id`                 | `VARCHAR(36)`   | PK         | No       | Customer UUID                                         |
| `customers`          | `code`               | `VARCHAR(20)`   | UK         | No       | Customer code (e.g., `CUST-RET-A`, `CUST-DIST-B`)     |
| `customers`          | `legal_name`         | `VARCHAR(150)`  | -          | No       | Registered business name                              |
| `customers`          | `trade_name`         | `VARCHAR(150)`  | -          | Yes      | Retail shop or distributor banner name                |
| `customers`          | `customer_type`      | `ENUM`          | -          | No       | `RETAILER`, `DISTRIBUTOR`, `WHOLESALER`, `DIRECT`     |
| `customers`          | `gstin`              | `VARCHAR(15)`   | UK         | Yes      | Customer GSTIN                                        |
| `customers`          | `credit_period_days` | `INT`           | -          | No       | Approved credit terms in days                         |
| `customers`          | `credit_limit`       | `DECIMAL(14,2)` | -          | No       | Maximum outstanding credit ceiling                    |
| `customer_addresses` | `id`                 | `VARCHAR(36)`   | PK         | No       | Address UUID                                          |
| `customer_addresses` | `customer_id`        | `VARCHAR(36)`   | FK         | No       | FK to `customers.id`                                  |
| `customer_addresses` | `address_type`       | `ENUM`          | -          | No       | `BILLING`, `SHIPPING`                                 |
| `customer_addresses` | `state`              | `VARCHAR(50)`   | -          | No       | Destination state name                                |
| `customer_addresses` | `state_code`         | `VARCHAR(2)`    | -          | No       | 2-digit GST state code (determines CGST+SGST vs IGST) |

### 6.2 `sales_orders` & `sales_order_items`

Customer order bookings by sales representatives.

| Table               | Column                 | Data Type       | Constraint | Nullable | Description                                                            |
| :------------------ | :--------------------- | :-------------- | :--------- | :------- | :--------------------------------------------------------------------- |
| `sales_orders`      | `id`                   | `VARCHAR(36)`   | PK         | No       | Order UUID                                                             |
| `sales_orders`      | `order_number`         | `VARCHAR(30)`   | UK         | No       | Sequential SO code (e.g., `SO-2026-001`)                               |
| `sales_orders`      | `customer_id`          | `VARCHAR(36)`   | FK         | No       | FK to `customers.id`                                                   |
| `sales_orders`      | `salesman_id`          | `VARCHAR(36)`   | FK         | Yes      | Sales representative taking the order                                  |
| `sales_orders`      | `factory_id`           | `VARCHAR(36)`   | FK         | No       | Supplying factory                                                      |
| `sales_orders`      | `warehouse_id`         | `VARCHAR(36)`   | FK         | No       | Finished goods dispatch warehouse                                      |
| `sales_orders`      | `order_date`           | `DATE`          | -          | No       | Booking date                                                           |
| `sales_orders`      | `status`               | `ENUM`          | -          | No       | `DRAFT`, `SUBMITTED`, `APPROVED`, `PARTIAL`, `DISPATCHED`, `CANCELLED` |
| `sales_orders`      | `subtotal`             | `DECIMAL(14,2)` | -          | No       | Taxable order subtotal                                                 |
| `sales_orders`      | `tax_amount`           | `DECIMAL(14,2)` | -          | No       | Total estimated GST                                                    |
| `sales_orders`      | `total_amount`         | `DECIMAL(14,2)` | -          | No       | Gross order value                                                      |
| `sales_order_items` | `id`                   | `VARCHAR(36)`   | PK         | No       | Item UUID                                                              |
| `sales_order_items` | `sales_order_id`       | `VARCHAR(36)`   | FK         | No       | FK to `sales_orders.id`                                                |
| `sales_order_items` | `product_variant_id`   | `VARCHAR(36)`   | FK         | No       | Packaged food variant ordered                                          |
| `sales_order_items` | `inventory_item_id`    | `VARCHAR(36)`   | FK         | No       | FK to `inventory_items.id`                                             |
| `sales_order_items` | `ordered_quantity`     | `DECIMAL(14,4)` | -          | No       | Packets booked (e.g., `150`, `120`)                                    |
| `sales_order_items` | `unit_price`           | `DECIMAL(12,2)` | -          | No       | Agreed price per packet before tax (e.g., `50.00`)                     |
| `sales_order_items` | `taxable_amount`       | `DECIMAL(14,2)` | -          | No       | `ordered_quantity * unit_price`                                        |
| `sales_order_items` | `total_amount`         | `DECIMAL(14,2)` | -          | No       | Total inclusive of GST                                                 |
| `sales_order_items` | `dispatched_quantity`  | `DECIMAL(14,4)` | -          | No       | Quantity shipped to date                                               |
| `sales_order_items` | `backordered_quantity` | `DECIMAL(14,4)` | -          | No       | Shortage flagged quantity                                              |

### 6.3 `sales_invoices` & `sales_invoice_items`

Legally binding GST tax invoices.

| Table                 | Column               | Data Type       | Constraint | Nullable | Description                                                |
| :-------------------- | :------------------- | :-------------- | :--------- | :------- | :--------------------------------------------------------- |
| `sales_invoices`      | `id`                 | `VARCHAR(36)`   | PK         | No       | Invoice UUID                                               |
| `sales_invoices`      | `invoice_number`     | `VARCHAR(30)`   | UK         | No       | Sequential GST invoice (e.g. `INV-2026-001`)               |
| `sales_invoices`      | `sales_order_id`     | `VARCHAR(36)`   | FK         | Yes      | Nullable link to `sales_orders.id`                         |
| `sales_invoices`      | `customer_id`        | `VARCHAR(36)`   | FK         | No       | FK to `customers.id`                                       |
| `sales_invoices`      | `factory_id`         | `VARCHAR(36)`   | FK         | No       | Selling factory site                                       |
| `sales_invoices`      | `invoice_date`       | `DATE`          | -          | No       | Tax invoice date                                           |
| `sales_invoices`      | `due_date`           | `DATE`          | -          | No       | Payment maturity date                                      |
| `sales_invoices`      | `is_inter_state`     | `BOOLEAN`       | -          | No       | `false` $\rightarrow$ CGST+SGST, `true` $\rightarrow$ IGST |
| `sales_invoices`      | `subtotal`           | `DECIMAL(14,2)` | -          | No       | Total taxable value                                        |
| `sales_invoices`      | `total_cgst`         | `DECIMAL(14,2)` | -          | No       | Total Central GST (intra-state)                            |
| `sales_invoices`      | `total_sgst`         | `DECIMAL(14,2)` | -          | No       | Total State GST (intra-state)                              |
| `sales_invoices`      | `total_igst`         | `DECIMAL(14,2)` | -          | No       | Total Integrated GST (inter-state)                         |
| `sales_invoices`      | `total_tax_amount`   | `DECIMAL(14,2)` | -          | No       | Cumulative tax amount                                      |
| `sales_invoices`      | `total_amount`       | `DECIMAL(14,2)` | -          | No       | Gross invoice receivable (e.g., `7875.00`)                 |
| `sales_invoices`      | `paid_amount`        | `DECIMAL(14,2)` | -          | No       | Total payments allocated to date                           |
| `sales_invoices`      | `outstanding_amount` | `DECIMAL(14,2)` | -          | No       | Remaining uncollected balance (e.g. `3875.00`)             |
| `sales_invoices`      | `status`             | `ENUM`          | -          | No       | `DRAFT`, `POSTED`, `PARTIAL`, `PAID`, `CANCELLED`          |
| `sales_invoice_items` | `id`                 | `VARCHAR(36)`   | PK         | No       | Invoice Line UUID                                          |
| `sales_invoice_items` | `sales_invoice_id`   | `VARCHAR(36)`   | FK         | No       | FK to `sales_invoices.id`                                  |
| `sales_invoice_items` | `product_variant_id` | `VARCHAR(36)`   | FK         | No       | Item invoiced                                              |
| `sales_invoice_items` | `invoiced_quantity`  | `DECIMAL(14,4)` | -          | No       | Packets billed (e.g., `150`)                               |
| `sales_invoice_items` | `unit_price`         | `DECIMAL(12,2)` | -          | No       | Price snapshot (e.g., `50.00`)                             |
| `sales_invoice_items` | `taxable_amount`     | `DECIMAL(14,2)` | -          | No       | `150 * 50.00 = 7500.00`                                    |
| `sales_invoice_items` | `hsn_code`           | `VARCHAR(10)`   | -          | No       | Historical HSN snapshot                                    |
| `sales_invoice_items` | `cgst_rate`          | `DECIMAL(5,2)`  | -          | No       | CGST snapshot rate (e.g., `2.50%`)                         |
| `sales_invoice_items` | `cgst_amount`        | `DECIMAL(14,2)` | -          | No       | CGST tax value (e.g., `187.50`)                            |
| `sales_invoice_items` | `sgst_rate`          | `DECIMAL(5,2)`  | -          | No       | SGST snapshot rate (e.g., `2.50%`)                         |
| `sales_invoice_items` | `sgst_amount`        | `DECIMAL(14,2)` | -          | No       | SGST tax value (e.g., `187.50`)                            |
| `sales_invoice_items` | `igst_rate`          | `DECIMAL(5,2)`  | -          | No       | IGST snapshot rate (e.g., `5.00%` or `0.00%`)              |
| `sales_invoice_items` | `igst_amount`        | `DECIMAL(14,2)` | -          | No       | IGST tax value                                             |
| `sales_invoice_items` | `total_amount`       | `DECIMAL(14,2)` | -          | No       | Total line gross amount                                    |

### 6.4 `payments` & `payment_allocations`

Customer receipts, supplier disbursements, and multi-invoice settlement allocations.

| Table                 | Column                | Data Type       | Constraint | Nullable | Description                                 |
| :-------------------- | :-------------------- | :-------------- | :--------- | :------- | :------------------------------------------ |
| `payments`            | `id`                  | `VARCHAR(36)`   | PK         | No       | Payment UUID                                |
| `payments`            | `payment_number`      | `VARCHAR(30)`   | UK         | No       | Sequential voucher ID (e.g. `PAY-2026-001`) |
| `payments`            | `payment_type`        | `ENUM`          | -          | No       | `CUSTOMER_RECEIPT`, `SUPPLIER_DISBURSEMENT` |
| `payments`            | `customer_id`         | `VARCHAR(36)`   | FK         | Yes      | Nullable FK to `customers.id`               |
| `payments`            | `supplier_id`         | `VARCHAR(36)`   | FK         | Yes      | Nullable FK to `suppliers.id`               |
| `payments`            | `payment_date`        | `TIMESTAMP(3)`  | -          | No       | Remittance date                             |
| `payments`            | `payment_method_id`   | `VARCHAR(36)`   | FK         | No       | `CASH`, `BANK_TRANSFER`, `UPI`, `CHEQUE`    |
| `payments`            | `amount`              | `DECIMAL(14,2)` | -          | No       | Total amount received (e.g. `4000.00`)      |
| `payments`            | `unallocated_amount`  | `DECIMAL(14,2)` | -          | No       | Remaining unapplied credit balance          |
| `payments`            | `reference_number`    | `VARCHAR(100)`  | -          | Yes      | Cheque / UTR / Transaction reference number |
| `payments`            | `status`              | `ENUM`          | -          | No       | `DRAFT`, `POSTED`, `CANCELLED`              |
| `payment_allocations` | `id`                  | `VARCHAR(36)`   | PK         | No       | Allocation UUID                             |
| `payment_allocations` | `payment_id`          | `VARCHAR(36)`   | FK         | No       | FK to `payments.id`                         |
| `payment_allocations` | `sales_invoice_id`    | `VARCHAR(36)`   | FK         | Yes      | Invoice settled by payment                  |
| `payment_allocations` | `supplier_invoice_id` | `VARCHAR(36)`   | FK         | Yes      | Supplier bill settled by payment            |
| `payment_allocations` | `allocated_amount`    | `DECIMAL(14,2)` | -          | No       | Portion applied (e.g., `4000.00`)           |
| `payment_allocations` | `allocation_date`     | `TIMESTAMP(3)`  | -          | No       | Timestamp of allocation                     |

---

## 7. Configuration & System Tables

### 7.1 `tax_rates` & `tax_configurations`

Statutory Indian GST tax slabs and HSN mapping rules.

| Table       | Column            | Data Type      | Constraint | Nullable | Description                                   |
| :---------- | :---------------- | :------------- | :--------- | :------- | :-------------------------------------------- |
| `tax_rates` | `id`              | `VARCHAR(36)`  | PK         | No       | Tax Rate UUID                                 |
| `tax_rates` | `name`            | `VARCHAR(50)`  | -          | No       | e.g. "GST 5%", "GST 12%", "GST 18%", "GST 0%" |
| `tax_rates` | `rate_percentage` | `DECIMAL(5,2)` | -          | No       | Total combined tax rate (e.g. `5.00`)         |
| `tax_rates` | `cgst_percentage` | `DECIMAL(5,2)` | -          | No       | Central GST portion (e.g. `2.50`)             |
| `tax_rates` | `sgst_percentage` | `DECIMAL(5,2)` | -          | No       | State GST portion (e.g. `2.50`)               |
| `tax_rates` | `igst_percentage` | `DECIMAL(5,2)` | -          | No       | Integrated GST portion (e.g. `5.00`)          |
| `tax_rates` | `is_active`       | `BOOLEAN`      | -          | No       | Active status flag                            |

### 7.2 `system_configs` (Preserved from Phase 1.1)

System-wide environment key-value pairs.

| Column        | Data Type      | Constraint | Nullable | Default  | Description                 |
| :------------ | :------------- | :--------- | :------- | :------- | :-------------------------- |
| `id`          | `TEXT`         | PK         | No       | `uuid()` | Primary Key UUID            |
| `key`         | `TEXT`         | UK         | No       | -        | Unique system parameter key |
| `value`       | `TEXT`         | -          | No       | -        | Parameter value             |
| `description` | `TEXT`         | -          | Yes      | -        | Purpose explanation         |
| `createdAt`   | `TIMESTAMP(3)` | -          | No       | `now()`  | Record creation timestamp   |
| `updatedAt`   | `TIMESTAMP(3)` | -          | No       | `now()`  | Last modification timestamp |
