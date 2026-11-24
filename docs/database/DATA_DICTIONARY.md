# FoodFactory ERP – Data Dictionary

This document details the relational tables, column specifications, integrity constraints, and business rules comprising all **67 models** in the **FoodFactory ERP** database architecture.

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

### 1.6 `permissions` & `role_permissions`

Granular permission actions mapped to roles.

| Table              | Column          | Data Type      | Constraint | Nullable | Description                                                         |
| :----------------- | :-------------- | :------------- | :--------- | :------- | :------------------------------------------------------------------ |
| `permissions`      | `id`            | `VARCHAR(36)`  | PK         | No       | Permission UUID                                                     |
| `permissions`      | `code`          | `VARCHAR(50)`  | UK         | No       | Unique permission key (e.g., `inventory.post`)                      |
| `permissions`      | `module`        | `VARCHAR(50)`  | -          | No       | Module domain name (e.g., `inventory`)                              |
| `permissions`      | `action`        | `VARCHAR(30)`  | -          | No       | `CREATE`, `READ`, `UPDATE`, `DELETE`, `APPROVE`, `POST`, `EXPORT`   |
| `permissions`      | `description`   | `VARCHAR(255)` | -          | Yes      | Human-readable action description                                   |
| `role_permissions` | `id`            | `VARCHAR(36)`  | PK         | No       | Role permission mapping UUID                                        |
| `role_permissions` | `role_id`       | `VARCHAR(36)`  | FK         | No       | FK to `roles.id`                                                    |
| `role_permissions` | `permission_id` | `VARCHAR(36)`  | FK         | No       | FK to `permissions.id` (Composite UK on `role_id`, `permission_id`) |
| `role_permissions` | `granted_at`    | `TIMESTAMP(3)` | -          | No       | Timestamp of grant                                                  |

### 1.7 `user_warehouse_access`

Scoping table restricting factory personnel to assigned warehouse locations.

| Column         | Data Type      | Constraint | Nullable | Default        | Description                                                                |
| :------------- | :------------- | :--------- | :------- | :------------- | :------------------------------------------------------------------------- |
| `id`           | `VARCHAR(36)`  | PK         | No       | `uuid()`       | Primary Key UUID                                                           |
| `user_id`      | `VARCHAR(36)`  | FK         | No       | -              | Foreign Key to `users.id`                                                  |
| `warehouse_id` | `VARCHAR(36)`  | FK         | No       | -              | Foreign Key to `warehouses.id` (Composite UK on `user_id`, `warehouse_id`) |
| `access_level` | `VARCHAR(20)`  | -          | No       | `'READ_WRITE'` | `'READ'`, `'READ_WRITE'`                                                   |
| `assigned_at`  | `TIMESTAMP(3)` | -          | No       | `now()`        | Timestamp assigned                                                         |

### 1.8 `audit_logs`

Immutable record of system state modifications.

| Column           | Data Type      | Constraint | Nullable | Default  | Description & Business Rules                              |
| :--------------- | :------------- | :--------- | :------- | :------- | :-------------------------------------------------------- |
| `id`             | `VARCHAR(36)`  | PK         | No       | `uuid()` | Primary Key UUID                                          |
| `user_id`        | `VARCHAR(36)`  | FK         | Yes      | -        | Nullable FK to `users.id` (null if system batch)          |
| `action`         | `ENUM`         | -          | No       | -        | `CREATE`, `UPDATE`, `DELETE`, `APPROVE`, `POST`, `CANCEL` |
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

### 2.2 `tax_rates` & `tax_configurations`

Indian GST tax slabs and HSN mapping configurations.

| Table                | Column            | Data Type      | Constraint | Nullable | Description                                   |
| :------------------- | :---------------- | :------------- | :--------- | :------- | :-------------------------------------------- |
| `tax_rates`          | `id`              | `VARCHAR(36)`  | PK         | No       | Tax Rate UUID                                 |
| `tax_rates`          | `name`            | `VARCHAR(50)`  | -          | No       | e.g. "GST 5%", "GST 12%", "GST 18%", "GST 0%" |
| `tax_rates`          | `rate_percentage` | `DECIMAL(5,2)` | -          | No       | Total tax rate (e.g. `5.00`)                  |
| `tax_rates`          | `cgst_percentage` | `DECIMAL(5,2)` | -          | No       | Central GST portion (e.g. `2.50`)             |
| `tax_rates`          | `sgst_percentage` | `DECIMAL(5,2)` | -          | No       | State GST portion (e.g. `2.50`)               |
| `tax_rates`          | `igst_percentage` | `DECIMAL(5,2)` | -          | No       | Integrated GST portion (e.g. `5.00`)          |
| `tax_configurations` | `id`              | `VARCHAR(36)`  | PK         | No       | Config UUID                                   |
| `tax_configurations` | `hsn_code`        | `VARCHAR(10)`  | -          | No       | HSN Code                                      |
| `tax_configurations` | `tax_rate_id`     | `VARCHAR(36)`  | FK         | No       | FK to `tax_rates.id`                          |

### 2.3 `raw_material_categories`, `product_categories`, `raw_materials`, `products`, `product_variants`

Ingredients, packaging films, cartons, and finished packaged goods.

| Table                     | Column                  | Data Type       | Constraint | Nullable | Description                                                  |
| :------------------------ | :---------------------- | :-------------- | :--------- | :------- | :----------------------------------------------------------- |
| `raw_material_categories` | `id`                    | `VARCHAR(36)`   | PK         | No       | Category UUID                                                |
| `raw_material_categories` | `code`                  | `VARCHAR(20)`   | UK         | No       | Category code (e.g., `INGRED`, `PACKAGING`)                  |
| `raw_material_categories` | `name`                  | `VARCHAR(100)`  | -          | No       | Name                                                         |
| `product_categories`      | `id`                    | `VARCHAR(36)`   | PK         | No       | Product Category UUID                                        |
| `product_categories`      | `code`                  | `VARCHAR(20)`   | UK         | No       | Category code (e.g., `SNACKS`, `SWEETS`)                     |
| `raw_materials`           | `id`                    | `VARCHAR(36)`   | PK         | No       | Raw Material UUID                                            |
| `raw_materials`           | `code`                  | `VARCHAR(30)`   | UK         | No       | Material code (e.g. `RM-FLOUR-01`, `PKG-POUCH-MUR`)          |
| `raw_materials`           | `name`                  | `VARCHAR(100)`  | -          | No       | Description                                                  |
| `raw_materials`           | `material_type`         | `ENUM`          | -          | No       | `RAW_INGREDIENT`, `PACKAGING_PRIMARY`, `PACKAGING_SECONDARY` |
| `raw_materials`           | `uom_id`                | `VARCHAR(36)`   | FK         | No       | Stocking UOM                                                 |
| `raw_materials`           | `hsn_code`              | `VARCHAR(10)`   | -          | No       | HSN code                                                     |
| `raw_materials`           | `tax_rate_id`           | `VARCHAR(36)`   | FK         | No       | FK to `tax_rates.id`                                         |
| `raw_materials`           | `min_stock_alert`       | `DECIMAL(14,4)` | -          | No       | Reorder threshold                                            |
| `products`                | `id`                    | `VARCHAR(36)`   | PK         | No       | Product UUID                                                 |
| `products`                | `code`                  | `VARCHAR(30)`   | UK         | No       | Product code (e.g., `PRD-MURUKKU`)                           |
| `products`                | `name`                  | `VARCHAR(100)`  | -          | No       | Name                                                         |
| `product_variants`        | `id`                    | `VARCHAR(36)`   | PK         | No       | Variant UUID                                                 |
| `product_variants`        | `sku`                   | `VARCHAR(30)`   | UK         | No       | Unique SKU (e.g. `SKU-MUR-200G`)                             |
| `product_variants`        | `name`                  | `VARCHAR(100)`  | -          | No       | e.g. "Murukku 200 g"                                         |
| `product_variants`        | `net_weight_grams`      | `DECIMAL(10,2)` | -          | No       | Weight (e.g., `200.00`)                                      |
| `product_variants`        | `uom_id`                | `VARCHAR(36)`   | FK         | No       | Retail package unit (e.g., `PKT`)                            |
| `product_variants`        | `default_selling_price` | `DECIMAL(12,2)` | -          | No       | Retail price before tax (e.g., `50.00`)                      |

### 2.4 `inventory_items`

Polymorphic unified bridge linking raw materials and finished goods to the ledger engine.

| Column                | Data Type       | Constraint | Nullable | Default  | Description & Business Rules                  |
| :-------------------- | :-------------- | :--------- | :------- | :------- | :-------------------------------------------- |
| `id`                  | `VARCHAR(36)`   | PK         | No       | `uuid()` | Primary Key UUID                              |
| `item_type`           | `ENUM`          | -          | No       | -        | `RAW_MATERIAL`, `PACKAGING`, `FINISHED_GOODS` |
| `raw_material_id`     | `VARCHAR(36)`   | FK         | Yes      | -        | 1:1 FK to `raw_materials.id`                  |
| `product_variant_id`  | `VARCHAR(36)`   | FK         | Yes      | -        | 1:1 FK to `product_variants.id`               |
| `code`                | `VARCHAR(30)`   | UK         | No       | -        | Mirror of item code or SKU                    |
| `name`                | `VARCHAR(100)`  | -          | No       | -        | Mirror of item name                           |
| `uom_id`              | `VARCHAR(36)`   | FK         | No       | -        | Authoritative stocking UOM                    |
| `valuation_method`    | `ENUM`          | -          | No       | `MWAC`   | `MWAC` or `BATCH_ACTUAL`                      |
| `moving_average_cost` | `DECIMAL(18,4)` | -          | No       | `0.0000` | Cached global average cost                    |
| `is_active`           | `BOOLEAN`       | -          | No       | `true`   | Active status flag                            |

---

## 3. Inventory Ledger & Valuation Tables

### 3.1 `inventory_balances`

Cached per-warehouse stock balances for fast transactional queries.

| Column               | Data Type       | Constraint   | Nullable | Default  | Description                                                   |
| :------------------- | :-------------- | :----------- | :------- | :------- | :------------------------------------------------------------ |
| `id`                 | `VARCHAR(36)`   | PK           | No       | `uuid()` | Primary Key UUID                                              |
| `inventory_item_id`  | `VARCHAR(36)`   | FK           | No       | -        | FK to `inventory_items.id` (Composite UK with `warehouse_id`) |
| `warehouse_id`       | `VARCHAR(36)`   | FK           | No       | -        | FK to `warehouses.id`                                         |
| `quantity_on_hand`   | `DECIMAL(18,4)` | CHECK `>= 0` | No       | `0.0000` | Total physical stock                                          |
| `allocated_quantity` | `DECIMAL(18,4)` | CHECK `>= 0` | No       | `0.0000` | Reserved for approved orders                                  |
| `average_cost`       | `DECIMAL(18,4)` | -            | No       | `0.0000` | Current warehouse MWAC                                        |
| `total_valuation`    | `DECIMAL(18,4)` | -            | No       | `0.0000` | `quantity_on_hand * average_cost`                             |
| `last_updated_at`    | `TIMESTAMP(3)`  | -            | No       | `now()`  | Timestamp                                                     |

### 3.2 `inventory_transactions` & `inventory_transaction_lines`

Immutable append-only ledger entries.

| Table                         | Column               | Data Type       | Constraint | Nullable | Description                                                                                                                                                                             |
| :---------------------------- | :------------------- | :-------------- | :--------- | :------- | :-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `inventory_transactions`      | `id`                 | `VARCHAR(36)`   | PK         | No       | Transaction UUID                                                                                                                                                                        |
| `inventory_transactions`      | `transaction_number` | `VARCHAR(30)`   | UK         | No       | Sequential ID (e.g. `TXN-2026-0001`)                                                                                                                                                    |
| `inventory_transactions`      | `transaction_type`   | `ENUM`          | -          | No       | `OPENING_BALANCE`, `PURCHASE_RECEIPT`, `PRODUCTION_ISSUE`, `PRODUCTION_RECEIPT`, `SALES_DISPATCH`, `SALES_RETURN`, `PURCHASE_RETURN`, `STOCK_ADJUSTMENT`, `TRANSFER_IN`, `TRANSFER_OUT` |
| `inventory_transactions`      | `source_doc_type`    | `VARCHAR(50)`   | -          | No       | Source document name (e.g. `GoodsReceipt`)                                                                                                                                              |
| `inventory_transactions`      | `source_doc_id`      | `VARCHAR(36)`   | -          | No       | Source document UUID                                                                                                                                                                    |
| `inventory_transaction_lines` | `id`                 | `VARCHAR(36)`   | PK         | No       | Line UUID                                                                                                                                                                               |
| `inventory_transaction_lines` | `transaction_id`     | `VARCHAR(36)`   | FK         | No       | FK to `inventory_transactions.id`                                                                                                                                                       |
| `inventory_transaction_lines` | `inventory_item_id`  | `VARCHAR(36)`   | FK         | No       | Item moved                                                                                                                                                                              |
| `inventory_transaction_lines` | `movement_type`      | `ENUM`          | -          | No       | `IN` or `OUT`                                                                                                                                                                           |
| `inventory_transaction_lines` | `quantity`           | `DECIMAL(14,4)` | -          | No       | Quantity                                                                                                                                                                                |
| `inventory_transaction_lines` | `unit_cost`          | `DECIMAL(18,4)` | -          | No       | Applied valuation rate                                                                                                                                                                  |
| `inventory_transaction_lines` | `balance_before`     | `DECIMAL(18,4)` | -          | No       | Balance prior to posting                                                                                                                                                                |
| `inventory_transaction_lines` | `balance_after`      | `DECIMAL(18,4)` | -          | No       | Balance post posting                                                                                                                                                                    |

### 3.3 `inventory_valuation_layers`, `stock_adjustments`, `stock_adjustment_items`, `stock_transfers`, `stock_transfer_items`

FIFO valuation audit layers, physical stock-take adjustments, and warehouse-to-warehouse transfers.

| Table                        | Column                | Data Type       | Constraint | Nullable | Description                    |
| :--------------------------- | :-------------------- | :-------------- | :--------- | :------- | :----------------------------- |
| `inventory_valuation_layers` | `id`                  | `VARCHAR(36)`   | PK         | No       | Layer UUID                     |
| `inventory_valuation_layers` | `inventory_item_id`   | `VARCHAR(36)`   | FK         | No       | Item                           |
| `inventory_valuation_layers` | `warehouse_id`        | `VARCHAR(36)`   | -          | No       | Location                       |
| `inventory_valuation_layers` | `initial_quantity`    | `DECIMAL(14,4)` | -          | No       | Layer intake quantity          |
| `inventory_valuation_layers` | `remaining_quantity`  | `DECIMAL(14,4)` | -          | No       | Unexhausted quantity           |
| `inventory_valuation_layers` | `unit_cost`           | `DECIMAL(18,4)` | -          | No       | Intake cost                    |
| `stock_adjustments`          | `id`                  | `VARCHAR(36)`   | PK         | No       | Adjustment UUID                |
| `stock_adjustments`          | `adjustment_number`   | `VARCHAR(30)`   | UK         | No       | Unique document number         |
| `stock_adjustments`          | `warehouse_id`        | `VARCHAR(36)`   | FK         | No       | Warehouse                      |
| `stock_adjustments`          | `status`              | `ENUM`          | -          | No       | `DRAFT`, `POSTED`, `CANCELLED` |
| `stock_adjustment_items`     | `id`                  | `VARCHAR(36)`   | PK         | No       | Adjustment Item UUID           |
| `stock_adjustment_items`     | `stock_adjustment_id` | `VARCHAR(36)`   | FK         | No       | FK to `stock_adjustments.id`   |
| `stock_adjustment_items`     | `system_quantity`     | `DECIMAL(14,4)` | -          | No       | System book stock              |
| `stock_adjustment_items`     | `physical_quantity`   | `DECIMAL(14,4)` | -          | No       | Counted stock                  |
| `stock_adjustment_items`     | `variance_quantity`   | `DECIMAL(14,4)` | -          | No       | `physical - system`            |
| `stock_transfers`            | `id`                  | `VARCHAR(36)`   | PK         | No       | Transfer UUID                  |
| `stock_transfers`            | `transfer_number`     | `VARCHAR(30)`   | UK         | No       | Sequential transfer number     |
| `stock_transfers`            | `from_warehouse_id`   | `VARCHAR(36)`   | FK         | No       | Dispatch warehouse             |
| `stock_transfers`            | `to_warehouse_id`     | `VARCHAR(36)`   | FK         | No       | Receiving warehouse            |
| `stock_transfer_items`       | `id`                  | `VARCHAR(36)`   | PK         | No       | Transfer Item UUID             |
| `stock_transfer_items`       | `stock_transfer_id`   | `VARCHAR(36)`   | FK         | No       | FK to `stock_transfers.id`     |
| `stock_transfer_items`       | `quantity`            | `DECIMAL(14,4)` | -          | No       | Transferred quantity           |

---

## 4. Bill of Materials (BOM) & Production Tables

### 4.1 `boms`, `bom_versions`, `bom_items`

Standard product formulations.

| Table          | Column                 | Data Type       | Constraint | Nullable | Description                             |
| :------------- | :--------------------- | :-------------- | :--------- | :------- | :-------------------------------------- |
| `boms`         | `id`                   | `VARCHAR(36)`   | PK         | No       | Recipe UUID                             |
| `boms`         | `code`                 | `VARCHAR(30)`   | UK         | No       | Recipe code (e.g. `BOM-MUR-200G`)       |
| `boms`         | `base_output_quantity` | `DECIMAL(14,4)` | -          | No       | Standard batch output (e.g. `200.0000`) |
| `bom_versions` | `id`                   | `VARCHAR(36)`   | PK         | No       | Version UUID                            |
| `bom_versions` | `version_number`       | `INT`           | -          | No       | Incremental version number              |
| `bom_versions` | `status`               | `ENUM`          | -          | No       | `DRAFT`, `ACTIVE`, `OBSOLETE`           |
| `bom_items`    | `id`                   | `VARCHAR(36)`   | PK         | No       | Item UUID                               |
| `bom_items`    | `inventory_item_id`    | `VARCHAR(36)`   | FK         | No       | Raw material or packaging               |
| `bom_items`    | `standard_quantity`    | `DECIMAL(14,4)` | -          | No       | Expected consumption                    |

### 4.2 `production_orders`, `production_runs`, `material_issues`, `material_issue_items`, `material_returns`, `material_return_items`, `production_scraps`, `production_overheads`, `production_variances`

Floor manufacturing, scrap logging, and batch costing.

| Table                   | Column                  | Data Type       | Constraint | Nullable | Description                              |
| :---------------------- | :---------------------- | :-------------- | :--------- | :------- | :--------------------------------------- |
| `production_orders`     | `id`                    | `VARCHAR(36)`   | PK         | No       | Order UUID                               |
| `production_orders`     | `order_number`          | `VARCHAR(30)`   | UK         | No       | e.g. `PRD-ORD-2026-001`                  |
| `production_runs`       | `id`                    | `VARCHAR(36)`   | PK         | No       | Run UUID                                 |
| `production_runs`       | `run_number`            | `VARCHAR(30)`   | UK         | No       | e.g. `RUN-2026-001`                      |
| `production_runs`       | `batch_number`          | `VARCHAR(50)`   | UK         | No       | Unique batch code                        |
| `production_runs`       | `actual_good_output`    | `DECIMAL(14,4)` | -          | No       | Good finished packets (e.g. `188`)       |
| `production_runs`       | `total_material_cost`   | `DECIMAL(14,2)` | -          | No       | Material costs (e.g. `4055.00`)          |
| `production_runs`       | `total_overhead_cost`   | `DECIMAL(14,2)` | -          | No       | Overheads (e.g. `1800.00`)               |
| `production_runs`       | `total_production_cost` | `DECIMAL(14,2)` | -          | No       | Total batch cost (e.g. `5855.00`)        |
| `production_runs`       | `unit_cost_per_item`    | `DECIMAL(18,4)` | -          | No       | Batch unit cost (e.g. `31.1436`)         |
| `material_issues`       | `id`                    | `VARCHAR(36)`   | PK         | No       | Issue UUID                               |
| `material_issue_items`  | `id`                    | `VARCHAR(36)`   | PK         | No       | Issue Item UUID                          |
| `material_issue_items`  | `actual_quantity`       | `DECIMAL(14,4)` | -          | No       | Quantity issued (e.g. 194 pouches)       |
| `material_returns`      | `id`                    | `VARCHAR(36)`   | PK         | No       | Return UUID                              |
| `material_return_items` | `id`                    | `VARCHAR(36)`   | PK         | No       | Return Item UUID                         |
| `production_scraps`     | `id`                    | `VARCHAR(36)`   | PK         | No       | Scrap UUID                               |
| `production_scraps`     | `scrap_type`            | `ENUM`          | -          | No       | `DAMAGED_PACKAGING`, `INGREDIENT_WASTE`  |
| `production_scraps`     | `quantity`              | `DECIMAL(14,4)` | -          | No       | e.g. `6.0000` pouches (analytical log)   |
| `production_overheads`  | `id`                    | `VARCHAR(36)`   | PK         | No       | Overhead UUID                            |
| `production_overheads`  | `amount`                | `DECIMAL(12,2)` | -          | No       | Cost absorbed (e.g. `1200.00`, `600.00`) |
| `production_variances`  | `id`                    | `VARCHAR(36)`   | PK         | No       | Variance UUID                            |
| `production_variances`  | `variance_percentage`   | `DECIMAL(5,2)`  | -          | No       | Yield (-6%) or oil usage (+5%)           |

---

## 5. Purchasing, Sales & Accounting Tables

### 5.1 Purchasing & Suppliers

`suppliers`, `supplier_addresses`, `purchase_orders`, `purchase_order_items`, `goods_receipts`, `goods_receipt_items`, `supplier_invoices`, `purchase_returns`, `purchase_return_items`.

### 5.2 Sales, Customers & GST Invoicing

`customers`, `customer_addresses`, `sales_orders`, `sales_order_items`, `sales_invoices`, `sales_invoice_items`, `invoice_tax_breakdowns`, `dispatches`, `dispatch_items`, `sales_returns`, `sales_return_items`, `credit_notes`.

### 5.3 Payments, Expenses & System Config

`payment_methods`, `payments`, `payment_allocations`, `expense_categories`, `expenses`, `system_configs`.

_(Every table maintains full foreign key integrity, non-null timestamps, and strict Decimal types as specified in `prisma-schema-draft.prisma`)_.
