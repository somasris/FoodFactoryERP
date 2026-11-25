-- CreateEnum
CREATE TYPE "SalesOrderStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'APPROVED', 'REJECTED', 'CONFIRMED', 'PARTIALLY_FULFILLED', 'FULFILLED', 'CANCELLED');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "AuditAction" ADD VALUE 'SUBMIT';
ALTER TYPE "AuditAction" ADD VALUE 'REJECT';
ALTER TYPE "AuditAction" ADD VALUE 'CONFIRM';
ALTER TYPE "AuditAction" ADD VALUE 'RESERVE';
ALTER TYPE "AuditAction" ADD VALUE 'RELEASE';
ALTER TYPE "AuditAction" ADD VALUE 'FULFILL';

-- CreateTable
CREATE TABLE "sales_orders" (
    "id" TEXT NOT NULL,
    "order_number" VARCHAR(40) NOT NULL,
    "customer_id" TEXT NOT NULL,
    "shipping_address_id" TEXT,
    "warehouse_id" TEXT NOT NULL,
    "salesman_id" TEXT,
    "order_date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expected_delivery_date" DATE,
    "status" "SalesOrderStatus" NOT NULL DEFAULT 'DRAFT',
    "subtotal" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "discount_amount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "tax_amount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "total_amount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "notes" TEXT,
    "delivery_instructions" TEXT,
    "idempotency_key" VARCHAR(100),
    "created_by_id" TEXT NOT NULL,
    "submitted_by_id" TEXT,
    "submitted_at" TIMESTAMP(3),
    "approved_by_id" TEXT,
    "approved_at" TIMESTAMP(3),
    "rejected_by_id" TEXT,
    "rejected_at" TIMESTAMP(3),
    "rejection_reason" TEXT,
    "confirmed_by_id" TEXT,
    "confirmed_at" TIMESTAMP(3),
    "cancelled_by_id" TEXT,
    "cancelled_at" TIMESTAMP(3),
    "cancellation_reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sales_orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sales_order_lines" (
    "id" TEXT NOT NULL,
    "sales_order_id" TEXT NOT NULL,
    "line_number" INTEGER NOT NULL,
    "product_variant_id" TEXT NOT NULL,
    "inventory_item_id" TEXT NOT NULL,
    "uom_id" TEXT NOT NULL,
    "ordered_quantity" DECIMAL(14,4) NOT NULL,
    "base_quantity" DECIMAL(14,4) NOT NULL,
    "reserved_base_quantity" DECIMAL(14,4) NOT NULL DEFAULT 0,
    "fulfilled_base_quantity" DECIMAL(14,4) NOT NULL DEFAULT 0,
    "unit_price" DECIMAL(12,2) NOT NULL,
    "discount_percent" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "tax_rate_id" TEXT NOT NULL,
    "tax_percentage" DECIMAL(5,2) NOT NULL,
    "taxable_amount" DECIMAL(14,2) NOT NULL,
    "tax_amount" DECIMAL(14,2) NOT NULL,
    "line_total" DECIMAL(14,2) NOT NULL,
    "notes" TEXT,

    CONSTRAINT "sales_order_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sales_order_status_history" (
    "id" TEXT NOT NULL,
    "sales_order_id" TEXT NOT NULL,
    "from_status" "SalesOrderStatus",
    "to_status" "SalesOrderStatus" NOT NULL,
    "changed_by_id" TEXT NOT NULL,
    "reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sales_order_status_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sales_order_fulfillments" (
    "id" TEXT NOT NULL,
    "fulfillment_number" VARCHAR(40) NOT NULL,
    "sales_order_id" TEXT NOT NULL,
    "inventory_issue_id" TEXT NOT NULL,
    "idempotency_key" VARCHAR(100) NOT NULL,
    "fulfilled_by_id" TEXT NOT NULL,
    "fulfilled_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sales_order_fulfillments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "sales_orders_order_number_key" ON "sales_orders"("order_number");

-- CreateIndex
CREATE UNIQUE INDEX "sales_orders_idempotency_key_key" ON "sales_orders"("idempotency_key");

-- CreateIndex
CREATE INDEX "sales_orders_customer_id_idx" ON "sales_orders"("customer_id");

-- CreateIndex
CREATE INDEX "sales_orders_warehouse_id_idx" ON "sales_orders"("warehouse_id");

-- CreateIndex
CREATE INDEX "sales_orders_salesman_id_idx" ON "sales_orders"("salesman_id");

-- CreateIndex
CREATE INDEX "sales_orders_status_idx" ON "sales_orders"("status");

-- CreateIndex
CREATE INDEX "sales_orders_order_date_idx" ON "sales_orders"("order_date");

-- CreateIndex
CREATE INDEX "sales_order_lines_product_variant_id_idx" ON "sales_order_lines"("product_variant_id");

-- CreateIndex
CREATE INDEX "sales_order_lines_inventory_item_id_idx" ON "sales_order_lines"("inventory_item_id");

-- CreateIndex
CREATE UNIQUE INDEX "sales_order_lines_sales_order_id_line_number_key" ON "sales_order_lines"("sales_order_id", "line_number");

-- CreateIndex
CREATE INDEX "sales_order_status_history_sales_order_id_idx" ON "sales_order_status_history"("sales_order_id");

-- CreateIndex
CREATE UNIQUE INDEX "sales_order_fulfillments_fulfillment_number_key" ON "sales_order_fulfillments"("fulfillment_number");

-- CreateIndex
CREATE UNIQUE INDEX "sales_order_fulfillments_inventory_issue_id_key" ON "sales_order_fulfillments"("inventory_issue_id");

-- CreateIndex
CREATE UNIQUE INDEX "sales_order_fulfillments_idempotency_key_key" ON "sales_order_fulfillments"("idempotency_key");

-- CreateIndex
CREATE INDEX "sales_order_fulfillments_sales_order_id_idx" ON "sales_order_fulfillments"("sales_order_id");

-- AddForeignKey
ALTER TABLE "sales_orders" ADD CONSTRAINT "sales_orders_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_orders" ADD CONSTRAINT "sales_orders_shipping_address_id_fkey" FOREIGN KEY ("shipping_address_id") REFERENCES "customer_addresses"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_orders" ADD CONSTRAINT "sales_orders_warehouse_id_fkey" FOREIGN KEY ("warehouse_id") REFERENCES "warehouses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_orders" ADD CONSTRAINT "sales_orders_salesman_id_fkey" FOREIGN KEY ("salesman_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_order_lines" ADD CONSTRAINT "sales_order_lines_sales_order_id_fkey" FOREIGN KEY ("sales_order_id") REFERENCES "sales_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_order_lines" ADD CONSTRAINT "sales_order_lines_product_variant_id_fkey" FOREIGN KEY ("product_variant_id") REFERENCES "product_variants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_order_lines" ADD CONSTRAINT "sales_order_lines_inventory_item_id_fkey" FOREIGN KEY ("inventory_item_id") REFERENCES "inventory_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_order_lines" ADD CONSTRAINT "sales_order_lines_uom_id_fkey" FOREIGN KEY ("uom_id") REFERENCES "units_of_measure"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_order_lines" ADD CONSTRAINT "sales_order_lines_tax_rate_id_fkey" FOREIGN KEY ("tax_rate_id") REFERENCES "tax_rates"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_order_status_history" ADD CONSTRAINT "sales_order_status_history_sales_order_id_fkey" FOREIGN KEY ("sales_order_id") REFERENCES "sales_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_order_status_history" ADD CONSTRAINT "sales_order_status_history_changed_by_id_fkey" FOREIGN KEY ("changed_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_order_fulfillments" ADD CONSTRAINT "sales_order_fulfillments_sales_order_id_fkey" FOREIGN KEY ("sales_order_id") REFERENCES "sales_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Phase 2 Sales & Orders Database-Level Invariants
ALTER TABLE "sales_order_lines" ADD CONSTRAINT "chk_sales_order_lines_ordered_qty_pos" CHECK ("ordered_quantity" > 0);
ALTER TABLE "sales_order_lines" ADD CONSTRAINT "chk_sales_order_lines_reserved_qty_nonneg" CHECK ("reserved_base_quantity" >= 0);
ALTER TABLE "sales_order_lines" ADD CONSTRAINT "chk_sales_order_lines_fulfilled_qty_nonneg" CHECK ("fulfilled_base_quantity" >= 0);
ALTER TABLE "sales_orders" ADD CONSTRAINT "chk_sales_orders_total_nonneg" CHECK ("total_amount" >= 0);
