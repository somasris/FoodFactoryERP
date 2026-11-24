# FoodFactory ERP – Entity-Relationship (ER) Diagrams

This document contains the complete Entity-Relationship architecture for **FoodFactory ERP**. Due to the comprehensive scope of the manufacturing system, the model is presented as an integrated high-level domain map followed by modular ER diagrams with attributes, keys, and cardinalities.

---

## 1. High-Level Integrated Domain Map

```mermaid
erDiagram
    COMPANY ||--o{ FACTORY : operates
    FACTORY ||--o{ WAREHOUSE : maintains
    COMPANY ||--o{ USER : employs
    USER ||--o{ USER_ROLE : assigned
    ROLE ||--o{ USER_ROLE : defines

    RAW_MATERIAL ||--|| INVENTORY_ITEM : bridges
    PRODUCT_VARIANT ||--|| INVENTORY_ITEM : bridges

    SUPPLIER ||--o{ PURCHASE_ORDER : receives
    PURCHASE_ORDER ||--o{ GOODS_RECEIPT : fulfills
    GOODS_RECEIPT ||--o{ INVENTORY_TRANSACTION : generates

    WAREHOUSE ||--o{ INVENTORY_BALANCE : tracks
    INVENTORY_ITEM ||--o{ INVENTORY_BALANCE : held_as
    INVENTORY_TRANSACTION ||--o{ INVENTORY_TRANSACTION_LINE : contains
    INVENTORY_ITEM ||--o{ INVENTORY_TRANSACTION_LINE : movements

    PRODUCT_VARIANT ||--o{ BOM : defined_by
    BOM ||--o{ BOM_VERSION : versioned_as
    BOM_VERSION ||--o{ BOM_ITEM : requires

    BOM_VERSION ||--o{ PRODUCTION_ORDER : executes
    PRODUCTION_ORDER ||--o{ PRODUCTION_RUN : runs
    PRODUCTION_RUN ||--o{ MATERIAL_ISSUE : consumes
    PRODUCTION_RUN ||--o{ PRODUCTION_SCRAP : produces_waste
    PRODUCTION_RUN ||--o{ PRODUCTION_OUTPUT : yields_fg

    CUSTOMER ||--o{ SALES_ORDER : places
    SALES_ORDER ||--o{ SALES_INVOICE : billed_as
    SALES_INVOICE ||--o{ DISPATCH : ships_with
    DISPATCH ||--o{ INVENTORY_TRANSACTION : depletes_stock

    SALES_INVOICE ||--o{ PAYMENT_ALLOCATION : settled_by
    PAYMENT ||--o{ PAYMENT_ALLOCATION : allocates_to
```

---

## 2. Organization, Security & Master Data Domain

```mermaid
erDiagram
    COMPANIES {
        string id PK
        string code UK
        string legal_name
        string trade_name
        string gstin UK
        string state
        string state_code
        boolean is_active
        datetime created_at
    }

    FACTORIES {
        string id PK
        string company_id FK
        string code UK
        string name
        string state
        string state_code
        string address
        boolean is_active
    }

    WAREHOUSES {
        string id PK
        string factory_id FK
        string code UK
        string name
        string warehouse_type
        boolean is_active
    }

    USERS {
        string id PK
        string email UK
        string username UK
        string full_name
        string phone
        boolean is_active
    }

    ROLES {
        string id PK
        string code UK
        string name
        string description
    }

    USER_ROLES {
        string id PK
        string user_id FK
        string role_id FK
        datetime assigned_at
    }

    PERMISSIONS {
        string id PK
        string code UK
        string module
        string action
        string description
    }

    ROLE_PERMISSIONS {
        string id PK
        string role_id FK
        string permission_id FK
    }

    USER_WAREHOUSE_ACCESS {
        string id PK
        string user_id FK
        string warehouse_id FK
        string access_level
    }

    UNITS_OF_MEASURE {
        string id PK
        string code UK
        string name
        string symbol
        boolean is_base_unit
        int decimal_places
    }

    UNIT_CONVERSIONS {
        string id PK
        string from_uom_id FK
        string to_uom_id FK
        decimal multiplier
    }

    RAW_MATERIAL_CATEGORIES {
        string id PK
        string code UK
        string name
    }

    PRODUCT_CATEGORIES {
        string id PK
        string code UK
        string name
    }

    RAW_MATERIALS {
        string id PK
        string category_id FK
        string code UK
        string name
        string material_type
        string uom_id FK
        string hsn_code
        string tax_rate_id FK
        decimal min_stock_alert
        boolean is_active
    }

    PRODUCTS {
        string id PK
        string category_id FK
        string code UK
        string name
        string base_uom_id FK
        string hsn_code
        string tax_rate_id FK
        boolean is_active
    }

    PRODUCT_VARIANTS {
        string id PK
        string product_id FK
        string sku UK
        string name
        decimal net_weight_grams
        string uom_id FK
        decimal default_selling_price
        boolean is_active
    }

    INVENTORY_ITEMS {
        string id PK
        string item_type
        string raw_material_id FK "nullable"
        string product_variant_id FK "nullable"
        string code UK
        string name
        string uom_id FK
        string valuation_method
        decimal moving_average_cost
        boolean is_active
    }

    COMPANIES ||--o{ FACTORIES : "has"
    FACTORIES ||--o{ WAREHOUSES : "contains"
    USERS ||--o{ USER_ROLES : "assigned"
    ROLES ||--o{ USER_ROLES : "defines"
    ROLES ||--o{ ROLE_PERMISSIONS : "grants"
    PERMISSIONS ||--o{ ROLE_PERMISSIONS : "included_in"
    USERS ||--o{ USER_WAREHOUSE_ACCESS : "scoped_to"
    WAREHOUSES ||--o{ USER_WAREHOUSE_ACCESS : "permits"

    UNITS_OF_MEASURE ||--o{ UNIT_CONVERSIONS : "from"
    UNITS_OF_MEASURE ||--o{ UNIT_CONVERSIONS : "to"

    RAW_MATERIAL_CATEGORIES ||--o{ RAW_MATERIALS : "groups"
    UNITS_OF_MEASURE ||--o{ RAW_MATERIALS : "measured_in"

    PRODUCT_CATEGORIES ||--o{ PRODUCTS : "groups"
    PRODUCTS ||--o{ PRODUCT_VARIANTS : "has_variants"
    UNITS_OF_MEASURE ||--o{ PRODUCT_VARIANTS : "sold_in"

    RAW_MATERIALS ||--o| INVENTORY_ITEMS : "bridges_to"
    PRODUCT_VARIANTS ||--o| INVENTORY_ITEMS : "bridges_to"
    UNITS_OF_MEASURE ||--o{ INVENTORY_ITEMS : "stock_uom"
```

---

## 3. Purchasing & Supplier Management Domain

```mermaid
erDiagram
    SUPPLIERS {
        string id PK
        string code UK
        string legal_name
        string trade_name
        string gstin UK
        string pan
        int payment_terms_days
        boolean is_active
    }

    SUPPLIER_ADDRESSES {
        string id PK
        string supplier_id FK
        string address_type
        string address_line1
        string city
        string state
        string state_code
        string pincode
        boolean is_default
    }

    PURCHASE_ORDERS {
        string id PK
        string po_number UK
        string supplier_id FK
        string factory_id FK
        string warehouse_id FK
        date order_date
        date expected_delivery_date
        string status
        decimal total_taxable_amount
        decimal total_tax_amount
        decimal total_amount
        string created_by_id FK
    }

    PURCHASE_ORDER_ITEMS {
        string id PK
        string purchase_order_id FK
        string inventory_item_id FK
        decimal ordered_quantity
        string uom_id FK
        decimal unit_price
        decimal tax_percentage
        decimal taxable_amount
        decimal tax_amount
        decimal total_amount
        decimal received_quantity
    }

    GOODS_RECEIPTS {
        string id PK
        string grn_number UK
        string purchase_order_id FK "nullable"
        string supplier_id FK
        string warehouse_id FK
        datetime receipt_date
        string supplier_invoice_no
        string status
        decimal total_amount
        string received_by_id FK
        string posted_by_id FK
        datetime posted_at
    }

    GOODS_RECEIPT_ITEMS {
        string id PK
        string goods_receipt_id FK
        string po_item_id FK "nullable"
        string inventory_item_id FK
        decimal received_quantity
        decimal accepted_quantity
        decimal rejected_quantity
        string uom_id FK
        decimal unit_cost
        decimal total_cost
        string batch_number
        date expiry_date
    }

    SUPPLIER_INVOICES {
        string id PK
        string invoice_number UK
        string supplier_id FK
        string goods_receipt_id FK
        date invoice_date
        date due_date
        decimal taxable_amount
        decimal cgst_amount
        decimal sgst_amount
        decimal igst_amount
        decimal total_amount
        decimal paid_amount
        decimal outstanding_amount
        string status
    }

    PURCHASE_RETURNS {
        string id PK
        string return_number UK
        string supplier_id FK
        string goods_receipt_id FK
        string warehouse_id FK
        date return_date
        string reason
        string status
        decimal total_amount
    }

    PURCHASE_RETURN_ITEMS {
        string id PK
        string purchase_return_id FK
        string inventory_item_id FK
        decimal returned_quantity
        string uom_id FK
        decimal unit_cost
        decimal total_cost
    }

    SUPPLIERS ||--o{ SUPPLIER_ADDRESSES : "has"
    SUPPLIERS ||--o{ PURCHASE_ORDERS : "receives"
    PURCHASE_ORDERS ||--o{ PURCHASE_ORDER_ITEMS : "contains"
    PURCHASE_ORDERS ||--o{ GOODS_RECEIPTS : "fulfilled_by"
    GOODS_RECEIPTS ||--o{ GOODS_RECEIPT_ITEMS : "details"
    PURCHASE_ORDER_ITEMS ||--o{ GOODS_RECEIPT_ITEMS : "tracks"
    GOODS_RECEIPTS ||--o{ SUPPLIER_INVOICES : "billed_by"
    SUPPLIERS ||--o{ SUPPLIER_INVOICES : "issues"
    GOODS_RECEIPTS ||--o{ PURCHASE_RETURNS : "returned_via"
    PURCHASE_RETURNS ||--o{ PURCHASE_RETURN_ITEMS : "contains"
```

---

## 4. Immutable Inventory Ledger & Valuation Domain

```mermaid
erDiagram
    INVENTORY_ITEMS {
        string id PK
        string code UK
        string name
        string item_type
        string uom_id FK
        string valuation_method
        decimal moving_average_cost
    }

    INVENTORY_BALANCES {
        string id PK
        string inventory_item_id FK
        string warehouse_id FK
        decimal quantity_on_hand
        decimal allocated_quantity
        decimal average_cost
        decimal total_valuation
        datetime last_updated_at
    }

    INVENTORY_TRANSACTIONS {
        string id PK
        string transaction_number UK
        string transaction_type
        string source_doc_type
        string source_doc_id
        string warehouse_id FK
        datetime transaction_date
        string posted_by_id FK
        datetime posted_at
        string remarks
    }

    INVENTORY_TRANSACTION_LINES {
        string id PK
        string transaction_id FK
        string inventory_item_id FK
        string warehouse_id FK
        string movement_type
        decimal quantity
        string uom_id FK
        decimal unit_cost
        decimal total_value
        decimal balance_before
        decimal balance_after
        decimal avg_cost_before
        decimal avg_cost_after
        string batch_number
    }

    INVENTORY_VALUATION_LAYERS {
        string id PK
        string inventory_item_id FK
        string warehouse_id FK
        datetime layer_date
        string source_doc_type
        string source_doc_id
        decimal initial_quantity
        decimal remaining_quantity
        decimal unit_cost
        decimal total_cost
        boolean is_exhausted
    }

    STOCK_ADJUSTMENTS {
        string id PK
        string adjustment_number UK
        string warehouse_id FK
        date adjustment_date
        string reason
        string status
        string posted_by_id FK
        datetime posted_at
    }

    STOCK_ADJUSTMENT_ITEMS {
        string id PK
        string stock_adjustment_id FK
        string inventory_item_id FK
        decimal system_quantity
        decimal physical_quantity
        decimal variance_quantity
        string uom_id FK
        decimal unit_cost
        decimal variance_value
    }

    STOCK_TRANSFERS {
        string id PK
        string transfer_number UK
        string from_warehouse_id FK
        string to_warehouse_id FK
        date transfer_date
        string status
    }

    STOCK_TRANSFER_ITEMS {
        string id PK
        string stock_transfer_id FK
        string inventory_item_id FK
        decimal quantity
        string uom_id FK
        decimal unit_cost
    }

    INVENTORY_ITEMS ||--o{ INVENTORY_BALANCES : "held_at"
    INVENTORY_ITEMS ||--o{ INVENTORY_TRANSACTION_LINES : "moved"
    INVENTORY_ITEMS ||--o{ INVENTORY_VALUATION_LAYERS : "layers"
    INVENTORY_TRANSACTIONS ||--o{ INVENTORY_TRANSACTION_LINES : "records"
    STOCK_ADJUSTMENTS ||--o{ STOCK_ADJUSTMENT_ITEMS : "specifies"
    STOCK_TRANSFERS ||--o{ STOCK_TRANSFER_ITEMS : "transfers"
```

---

## 5. Bill of Materials (BOM) & Production Costing Domain

```mermaid
erDiagram
    BOMS {
        string id PK
        string product_variant_id FK
        string code UK
        string name
        decimal base_output_quantity
        string output_uom_id FK
        boolean is_active
    }

    BOM_VERSIONS {
        string id PK
        string bom_id FK
        int version_number
        string status
        date effective_from
        date effective_to
        decimal expected_good_output
        string output_uom_id FK
        string approved_by_id FK
        datetime approved_at
    }

    BOM_ITEMS {
        string id PK
        string bom_version_id FK
        string inventory_item_id FK
        string item_type
        decimal standard_quantity
        string uom_id FK
        decimal scrap_tolerance_percent
    }

    PRODUCTION_ORDERS {
        string id PK
        string order_number UK
        string factory_id FK
        string product_variant_id FK
        string bom_version_id FK
        decimal planned_quantity
        string output_uom_id FK
        date scheduled_start_date
        string status
        string created_by_id FK
    }

    PRODUCTION_RUNS {
        string id PK
        string run_number UK
        string production_order_id FK
        string batch_number UK
        date run_date
        string status
        decimal planned_quantity
        decimal actual_good_output
        string output_uom_id FK
        decimal total_material_cost
        decimal total_overhead_cost
        decimal total_production_cost
        decimal unit_cost_per_item
        decimal yield_variance_percent
        datetime started_at
        datetime completed_at
    }

    MATERIAL_ISSUES {
        string id PK
        string issue_number UK
        string production_run_id FK
        string warehouse_id FK
        datetime issue_date
        string status
        string posted_by_id FK
    }

    MATERIAL_ISSUE_ITEMS {
        string id PK
        string material_issue_id FK
        string inventory_item_id FK
        decimal planned_quantity
        decimal actual_quantity
        string uom_id FK
        decimal unit_cost
        decimal total_cost
        decimal variance_quantity
        decimal usage_variance_percent
    }

    PRODUCTION_SCRAP {
        string id PK
        string production_run_id FK
        string inventory_item_id FK
        string scrap_type
        decimal quantity
        string uom_id FK
        decimal unit_cost
        decimal total_cost
        string reason
    }

    PRODUCTION_OVERHEADS {
        string id PK
        string production_run_id FK
        string expense_category_id FK
        string description
        string cost_type
        decimal amount
    }

    PRODUCTION_VARIANCES {
        string id PK
        string production_run_id FK
        string inventory_item_id FK "nullable"
        string variance_type
        decimal standard_value
        decimal actual_value
        decimal variance_value
        decimal variance_percentage
    }

    BOMS ||--o{ BOM_VERSIONS : "versioned"
    BOM_VERSIONS ||--o{ BOM_ITEMS : "composed_of"
    BOM_VERSIONS ||--o{ PRODUCTION_ORDERS : "basis_for"
    PRODUCTION_ORDERS ||--o{ PRODUCTION_RUNS : "executed_in"
    PRODUCTION_RUNS ||--o{ MATERIAL_ISSUES : "issued"
    MATERIAL_ISSUES ||--o{ MATERIAL_ISSUE_ITEMS : "details"
    PRODUCTION_RUNS ||--o{ PRODUCTION_SCRAP : "logs_waste"
    PRODUCTION_RUNS ||--o{ PRODUCTION_OVERHEADS : "absorbs"
    PRODUCTION_RUNS ||--o{ PRODUCTION_VARIANCES : "analyzes"
```

---

## 6. Sales, GST, Invoicing & Payments Domain

```mermaid
erDiagram
    CUSTOMERS {
        string id PK
        string code UK
        string legal_name
        string trade_name
        string customer_type
        string gstin UK
        int credit_period_days
        decimal credit_limit
        boolean is_active
    }

    CUSTOMER_ADDRESSES {
        string id PK
        string customer_id FK
        string address_type
        string address_line1
        string city
        string state
        string state_code
        string pincode
        boolean is_default
    }

    TAX_RATES {
        string id PK
        string name
        decimal rate_percentage
        decimal cgst_percentage
        decimal sgst_percentage
        decimal igst_percentage
        boolean is_active
    }

    SALES_ORDERS {
        string id PK
        string order_number UK
        string customer_id FK
        string salesman_id FK
        string factory_id FK
        string warehouse_id FK
        date order_date
        string status
        decimal subtotal
        decimal tax_amount
        decimal total_amount
    }

    SALES_ORDER_ITEMS {
        string id PK
        string sales_order_id FK
        string product_variant_id FK
        string inventory_item_id FK
        decimal ordered_quantity
        string uom_id FK
        decimal unit_price
        decimal tax_percentage
        decimal taxable_amount
        decimal total_amount
        decimal dispatched_quantity
        decimal backordered_quantity
    }

    SALES_INVOICES {
        string id PK
        string invoice_number UK
        string sales_order_id FK
        string customer_id FK
        string factory_id FK
        date invoice_date
        date due_date
        boolean is_inter_state
        decimal subtotal
        decimal total_cgst
        decimal total_sgst
        decimal total_igst
        decimal total_tax_amount
        decimal total_amount
        decimal paid_amount
        decimal outstanding_amount
        string status
    }

    SALES_INVOICE_ITEMS {
        string id PK
        string sales_invoice_id FK
        string sales_order_item_id FK
        string product_variant_id FK
        decimal invoiced_quantity
        decimal unit_price
        decimal taxable_amount
        string hsn_code
        decimal cgst_rate
        decimal sgst_rate
        decimal igst_rate
        decimal cgst_amount
        decimal sgst_amount
        decimal igst_amount
        decimal total_amount
    }

    DISPATCHES {
        string id PK
        string dispatch_number UK
        string sales_order_id FK
        string sales_invoice_id FK
        string warehouse_id FK
        datetime dispatch_date
        string vehicle_number
        string status
    }

    DISPATCH_ITEMS {
        string id PK
        string dispatch_id FK
        string sales_order_item_id FK
        string inventory_item_id FK
        decimal dispatched_quantity
        string uom_id FK
    }

    PAYMENTS {
        string id PK
        string payment_number UK
        string payment_type
        string customer_id FK "nullable"
        string supplier_id FK "nullable"
        datetime payment_date
        string payment_method_id FK
        decimal amount
        decimal unallocated_amount
        string reference_number
        string status
    }

    PAYMENT_ALLOCATIONS {
        string id PK
        string payment_id FK
        string sales_invoice_id FK "nullable"
        string supplier_invoice_id FK "nullable"
        decimal allocated_amount
        datetime allocation_date
    }

    AUDIT_LOGS {
        string id PK
        string user_id FK "nullable"
        string action
        string entity_type
        string entity_id
        jsonb previous_state
        jsonb new_state
        string remarks
        datetime created_at
    }

    CUSTOMERS ||--o{ CUSTOMER_ADDRESSES : "has"
    CUSTOMERS ||--o{ SALES_ORDERS : "places"
    SALES_ORDERS ||--o{ SALES_ORDER_ITEMS : "details"
    SALES_ORDERS ||--o{ SALES_INVOICES : "billed_by"
    SALES_INVOICES ||--o{ SALES_INVOICE_ITEMS : "contains"
    SALES_INVOICES ||--o{ DISPATCHES : "shipped_under"
    DISPATCHES ||--o{ DISPATCH_ITEMS : "lines"
    CUSTOMERS ||--o{ PAYMENTS : "remits"
    PAYMENTS ||--o{ PAYMENT_ALLOCATIONS : "allocates"
    SALES_INVOICES ||--o{ PAYMENT_ALLOCATIONS : "settled_by"
```
