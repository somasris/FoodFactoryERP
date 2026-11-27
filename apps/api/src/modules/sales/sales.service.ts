import { AuditAction, Prisma, SalesOrderStatus } from '@prisma/client';
import { prisma } from '../../services/prisma.service';
import { AuditService } from '../../services/audit.service';
import { NotificationEventsService } from '../notifications/notification-events.service';
import { AppError } from '../../middleware/error.middleware';
import {
  AuditMeta,
  paginatedResult,
  PaginationParams,
  toPlainJson,
} from '../master-data/master-data.utils';
import {
  assertWarehouseAccess,
  convertQuantityDecimal,
  generateDocNumber,
  getAuthorizedWarehouseIds,
  UserContext,
  ZERO,
} from '../inventory/inventory.utils';
import { InventoryReservationService } from '../inventory/inventory-reservation.service';
import { buildDateRangeFilter, resolveApplicableTaxRate } from './sales.utils';
import {
  CreateSalesOrderInput,
  FulfillSalesOrderInput,
  UpdateSalesOrderInput,
} from './sales.types';

const HUNDRED = new Prisma.Decimal(100);

export type StockAvailabilityStatus =
  | 'SUFFICIENT'
  | 'PARTIAL'
  | 'INSUFFICIENT'
  | 'NOT_APPLICABLE';

export interface SalesOrderLineStockAvailability {
  salesOrderLineId: string;
  lineNumber: number;
  productVariantId: string;
  inventoryItemId: string;
  sku: string;
  productName: string;
  uomSymbol: string;
  requestedQuantity: string;
  availableQuantity: string;
  shortageQuantity: string;
  isSufficient: boolean;
}

export interface SalesOrderStockAvailability {
  status: StockAvailabilityStatus;
  warehouseId: string;
  warehouseCode: string;
  warehouseName: string;
  totalLines: number;
  sufficientLines: number;
  insufficientLines: number;
  lines: SalesOrderLineStockAvailability[];
}

const NON_APPLICABLE_STOCK_STATUSES = new Set<SalesOrderStatus>([
  SalesOrderStatus.CANCELLED,
  SalesOrderStatus.FULFILLED,
  SalesOrderStatus.REJECTED,
]);

const STOCK_STATUS_SORT_RANK: Record<StockAvailabilityStatus, number> = {
  INSUFFICIENT: 0,
  PARTIAL: 1,
  SUFFICIENT: 2,
  NOT_APPLICABLE: 3,
};

function canUserViewInventory(user: UserContext): boolean {
  return (
    user.roles.includes('OWNER') ||
    user.roles.includes('ADMIN') ||
    (user.permissions?.includes('inventory.read') ?? false)
  );
}

interface StockOrderLineInput {
  id: string;
  lineNumber: number;
  productVariantId: string;
  inventoryItemId: string;
  orderedQuantity: Prisma.Decimal | string;
  baseQuantity: Prisma.Decimal | string;
  reservedBaseQuantity: Prisma.Decimal | string;
  fulfilledBaseQuantity: Prisma.Decimal | string;
  productVariant: {
    sku: string;
    name: string;
    product?: { name: string } | null;
  };
  uom: { symbol: string };
}

interface StockOrderInput {
  warehouseId: string;
  status: SalesOrderStatus;
  warehouse: { id: string; code: string; name: string };
  lines: StockOrderLineInput[];
}

function computeOrderStockAvailability(
  order: StockOrderInput,
  availableByWhItem: Map<string, Prisma.Decimal>,
): SalesOrderStockAvailability {
  if (NON_APPLICABLE_STOCK_STATUSES.has(order.status)) {
    return {
      status: 'NOT_APPLICABLE',
      warehouseId: order.warehouse.id,
      warehouseCode: order.warehouse.code,
      warehouseName: order.warehouse.name,
      totalLines: order.lines.length,
      sufficientLines: 0,
      insufficientLines: 0,
      lines: [],
    };
  }

  const localPool = new Map<string, Prisma.Decimal>();
  const lineResults: SalesOrderLineStockAvailability[] = [];
  let sufficientLines = 0;
  let insufficientLines = 0;
  const includesOwnReservation =
    order.status === SalesOrderStatus.CONFIRMED ||
    order.status === SalesOrderStatus.PARTIALLY_FULFILLED;

  for (const line of order.lines) {
    const baseQty = new Prisma.Decimal(line.baseQuantity);
    const fulfilledBase = new Prisma.Decimal(line.fulfilledBaseQuantity);
    const remainingBase = Prisma.Decimal.max(ZERO, baseQty.sub(fulfilledBase));
    const orderedQty = new Prisma.Decimal(line.orderedQuantity);
    const ratio = baseQty.gt(ZERO) ? orderedQty.div(baseQty) : new Prisma.Decimal(1);

    const productName =
      line.productVariant.product?.name || line.productVariant.name || line.productVariant.sku;

    if (remainingBase.lte(ZERO)) {
      sufficientLines += 1;
      lineResults.push({
        salesOrderLineId: line.id,
        lineNumber: line.lineNumber,
        productVariantId: line.productVariantId,
        inventoryItemId: line.inventoryItemId,
        sku: line.productVariant.sku,
        productName,
        uomSymbol: line.uom.symbol,
        requestedQuantity: '0',
        availableQuantity: '0',
        shortageQuantity: '0',
        isSufficient: true,
      });
      continue;
    }

    const key = `${order.warehouseId}:${line.inventoryItemId}`;
    const poolAvail = localPool.has(key)
      ? localPool.get(key)!
      : (availableByWhItem.get(key) ?? ZERO);

    const reservedForLine = includesOwnReservation
      ? Prisma.Decimal.max(ZERO, new Prisma.Decimal(line.reservedBaseQuantity))
      : ZERO;

    const effectiveAvailBase = poolAvail.add(reservedForLine);
    const neededFromPool = Prisma.Decimal.max(ZERO, remainingBase.sub(reservedForLine));
    const consumedFromPool = Prisma.Decimal.min(poolAvail, neededFromPool);
    localPool.set(key, poolAvail.sub(consumedFromPool));

    const shortageBase = Prisma.Decimal.max(ZERO, remainingBase.sub(effectiveAvailBase));
    const isSufficient = shortageBase.lte(ZERO);
    if (isSufficient) {
      sufficientLines += 1;
    } else {
      insufficientLines += 1;
    }

    const requestedDisplay = remainingBase.mul(ratio).toDecimalPlaces(4);
    const availableDisplay = effectiveAvailBase.mul(ratio).toDecimalPlaces(4);
    const shortageDisplay = shortageBase.mul(ratio).toDecimalPlaces(4);

    lineResults.push({
      salesOrderLineId: line.id,
      lineNumber: line.lineNumber,
      productVariantId: line.productVariantId,
      inventoryItemId: line.inventoryItemId,
      sku: line.productVariant.sku,
      productName,
      uomSymbol: line.uom.symbol,
      requestedQuantity: requestedDisplay.toString(),
      availableQuantity: availableDisplay.toString(),
      shortageQuantity: shortageDisplay.toString(),
      isSufficient,
    });
  }

  let status: StockAvailabilityStatus;
  if (insufficientLines === 0) {
    status = 'SUFFICIENT';
  } else if (sufficientLines > 0) {
    status = 'PARTIAL';
  } else {
    status = 'INSUFFICIENT';
  }

  return {
    status,
    warehouseId: order.warehouse.id,
    warehouseCode: order.warehouse.code,
    warehouseName: order.warehouse.name,
    totalLines: order.lines.length,
    sufficientLines,
    insufficientLines,
    lines: lineResults,
  };
}

async function attachStockAvailabilityToOrders<T extends StockOrderInput>(
  orders: T[],
): Promise<Array<T & { stockAvailability: SalesOrderStockAvailability }>> {
  if (orders.length === 0) return [];

  const pairs: Array<{ warehouseId: string; inventoryItemId: string }> = [];
  for (const order of orders) {
    if (NON_APPLICABLE_STOCK_STATUSES.has(order.status)) continue;
    for (const line of order.lines) {
      pairs.push({ warehouseId: order.warehouseId, inventoryItemId: line.inventoryItemId });
    }
  }

  const availableByWhItem =
    await InventoryReservationService.getEligibleAvailableByWarehouseAndItem(pairs);

  return orders.map(order => ({
    ...order,
    stockAvailability: computeOrderStockAvailability(order, availableByWhItem),
  }));
}

const ORDER_INCLUDE = {
  customer: {
    select: {
      id: true,
      code: true,
      legalName: true,
      tradeName: true,
      customerType: true,
      gstin: true,
      phone: true,
      email: true,
    },
  },
  shippingAddress: true,
  warehouse: { select: { id: true, code: true, name: true, warehouseType: true } },
  salesman: { select: { id: true, fullName: true, username: true } },
  lines: {
    orderBy: { lineNumber: 'asc' as const },
    include: {
      productVariant: {
        select: {
          id: true,
          sku: true,
          name: true,
          defaultSellingPrice: true,
          uomId: true,
          product: { select: { id: true, code: true, name: true, hsnCode: true } },
        },
      },
      uom: { select: { id: true, code: true, symbol: true } },
      taxRate: { select: { id: true, code: true, name: true, ratePercentage: true } },
    },
  },
};

export class SalesService {
  static async getDashboardSummary(
    user: UserContext,
    filters: { fromDate?: string; toDate?: string },
  ) {
    const allowedWh = await getAuthorizedWarehouseIds(user, 'READ');
    const baseWhere: Prisma.SalesOrderWhereInput = allowedWh
      ? { warehouseId: { in: allowedWh } }
      : {};

    const dateFilter = buildDateRangeFilter(filters.fromDate, filters.toDate);
    if (dateFilter) {
      baseWhere.orderDate = dateFilter;
    }

    const [
      totalOrders,
      draftOrders,
      pendingApprovals,
      approvedOrders,
      confirmedOrders,
      partiallyFulfilledOrders,
      fulfilledOrders,
      cancelledOrders,
      rejectedOrders,
      valueAgg,
      recentOrders,
    ] = await Promise.all([
      prisma.salesOrder.count({ where: baseWhere }),
      prisma.salesOrder.count({ where: { ...baseWhere, status: 'DRAFT' } }),
      prisma.salesOrder.count({ where: { ...baseWhere, status: 'SUBMITTED' } }),
      prisma.salesOrder.count({ where: { ...baseWhere, status: 'APPROVED' } }),
      prisma.salesOrder.count({ where: { ...baseWhere, status: 'CONFIRMED' } }),
      prisma.salesOrder.count({ where: { ...baseWhere, status: 'PARTIALLY_FULFILLED' } }),
      prisma.salesOrder.count({ where: { ...baseWhere, status: 'FULFILLED' } }),
      prisma.salesOrder.count({ where: { ...baseWhere, status: 'CANCELLED' } }),
      prisma.salesOrder.count({ where: { ...baseWhere, status: 'REJECTED' } }),
      prisma.salesOrder.aggregate({
        where: {
          ...baseWhere,
          status: { in: ['CONFIRMED', 'PARTIALLY_FULFILLED', 'FULFILLED'] },
        },
        _sum: { totalAmount: true },
      }),
      prisma.salesOrder.findMany({
        where: baseWhere,
        take: 8,
        orderBy: { createdAt: 'desc' },
        include: {
          customer: { select: { id: true, code: true, legalName: true } },
          warehouse: { select: { id: true, code: true, name: true } },
          _count: { select: { lines: true } },
        },
      }),
    ]);

    const invWhere: Prisma.SalesInvoiceWhereInput = allowedWh
      ? { warehouseId: { in: allowedWh } }
      : {};
    if (dateFilter) {
      invWhere.invoiceDate = dateFilter;
    }

    const [
      totalInvoices,
      draftInvoices,
      issuedInvoices,
      cancelledInvoices,
      issuedValueAgg,
      issuedForTrends,
    ] = await Promise.all([
      prisma.salesInvoice.count({ where: invWhere }),
      prisma.salesInvoice.count({ where: { ...invWhere, status: 'DRAFT' } }),
      prisma.salesInvoice.count({ where: { ...invWhere, status: 'ISSUED' } }),
      prisma.salesInvoice.count({ where: { ...invWhere, status: 'CANCELLED' } }),
      prisma.salesInvoice.aggregate({
        where: { ...invWhere, status: 'ISSUED' },
        _sum: { grandTotal: true },
      }),
      prisma.salesInvoice.findMany({
        where: { ...invWhere, status: 'ISSUED' },
        select: { invoiceDate: true, grandTotal: true },
        orderBy: { invoiceDate: 'asc' },
        take: 200,
      }),
    ]);

    const trendMap = new Map<string, { count: number; totalValue: Prisma.Decimal }>();
    for (const row of issuedForTrends) {
      const monthKey = row.invoiceDate.toISOString().slice(0, 7);
      const curr = trendMap.get(monthKey) ?? { count: 0, totalValue: ZERO };
      curr.count += 1;
      curr.totalValue = curr.totalValue.add(row.grandTotal);
      trendMap.set(monthKey, curr);
    }
    const invoiceTrends = Array.from(trendMap.entries()).map(([period, stats]) => ({
      period,
      count: stats.count,
      totalValue: stats.totalValue.toDecimalPlaces(2).toString(),
    }));

    return {
      totalOrders,
      draftOrders,
      pendingApprovals,
      approvedOrders,
      confirmedOrders,
      partiallyFulfilledOrders,
      fulfilledOrders,
      cancelledOrders,
      rejectedOrders,
      confirmedSalesValue: new Prisma.Decimal(valueAgg._sum.totalAmount ?? 0)
        .toDecimalPlaces(2)
        .toString(),
      recentOrders,
      invoiceMetrics: {
        totalInvoices,
        draftInvoices,
        issuedInvoices,
        cancelledInvoices,
        totalInvoicedValue: new Prisma.Decimal(issuedValueAgg._sum.grandTotal ?? 0)
          .toDecimalPlaces(2)
          .toString(),
        invoiceTrends,
      },
    };
  }

  static async listOrders(
    params: PaginationParams,
    user: UserContext,
    filters: {
      status?: string;
      customerId?: string;
      warehouseId?: string;
      fromDate?: string;
      toDate?: string;
      stockAvailability?: string;
      sortBy?: string;
      sortOrder?: string;
    },
  ) {
    const allowedWh = await getAuthorizedWarehouseIds(user, 'READ');
    if (filters.warehouseId) {
      await assertWarehouseAccess(user, filters.warehouseId, 'READ');
    }

    const canViewInventory = canUserViewInventory(user);
    if (filters.stockAvailability && !canViewInventory) {
      throw new AppError(
        'Forbidden: inventory.read permission is required to filter by stock availability.',
        403,
      );
    }

    const where: Prisma.SalesOrderWhereInput = {};
    if (filters.warehouseId) {
      where.warehouseId = filters.warehouseId;
    } else if (allowedWh) {
      where.warehouseId = { in: allowedWh };
    }

    if (filters.status) where.status = filters.status as SalesOrderStatus;
    if (filters.customerId) where.customerId = filters.customerId;
    const listDateFilter = buildDateRangeFilter(filters.fromDate, filters.toDate);
    if (listDateFilter) {
      where.orderDate = listDateFilter;
    }
    if (params.search) {
      where.OR = [
        { orderNumber: { contains: params.search, mode: 'insensitive' } },
        { customer: { legalName: { contains: params.search, mode: 'insensitive' } } },
        { customer: { code: { contains: params.search, mode: 'insensitive' } } },
      ];
    }

    const listInclude = {
      customer: { select: { id: true, code: true, legalName: true, customerType: true } },
      warehouse: { select: { id: true, code: true, name: true } },
      salesman: { select: { id: true, fullName: true, username: true } },
      lines: {
        orderBy: { lineNumber: 'asc' as const },
        select: {
          id: true,
          lineNumber: true,
          productVariantId: true,
          inventoryItemId: true,
          orderedQuantity: true,
          baseQuantity: true,
          reservedBaseQuantity: true,
          fulfilledBaseQuantity: true,
          productVariant: {
            select: {
              sku: true,
              name: true,
              product: { select: { name: true } },
            },
          },
          uom: { select: { symbol: true } },
        },
      },
      _count: { select: { lines: true } },
    };

    const needsFullStockEvaluation =
      canViewInventory &&
      (Boolean(filters.stockAvailability) || filters.sortBy === 'stockAvailability');

    if (needsFullStockEvaluation) {
      const allOrders = await prisma.salesOrder.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        include: listInclude,
      });

      const enriched = await attachStockAvailabilityToOrders(allOrders);
      let filtered = filters.stockAvailability
        ? enriched.filter(o => o.stockAvailability.status === filters.stockAvailability)
        : enriched;

      if (filters.sortBy === 'stockAvailability') {
        const dir = filters.sortOrder === 'desc' ? -1 : 1;
        filtered = [...filtered].sort(
          (a, b) =>
            dir *
            (STOCK_STATUS_SORT_RANK[a.stockAvailability.status] -
              STOCK_STATUS_SORT_RANK[b.stockAvailability.status]),
        );
      }

      const total = filtered.length;
      const paged = filtered.slice(params.skip, params.skip + params.take);
      return paginatedResult(paged, total, params.page, params.limit);
    }

    const [items, total] = await Promise.all([
      prisma.salesOrder.findMany({
        where,
        skip: params.skip,
        take: params.take,
        orderBy: { createdAt: 'desc' },
        include: listInclude,
      }),
      prisma.salesOrder.count({ where }),
    ]);

    const enrichedItems: Array<(typeof items)[number] & { stockAvailability: SalesOrderStockAvailability | null }> =
      canViewInventory
        ? await attachStockAvailabilityToOrders(items)
        : items.map(item => ({ ...item, stockAvailability: null }));

    return paginatedResult(enrichedItems, total, params.page, params.limit);
  }

  static async getOrderById(id: string, user: UserContext) {
    const order = await prisma.salesOrder.findUnique({
      where: { id },
      include: {
        ...ORDER_INCLUDE,
        statusHistory: {
          orderBy: { createdAt: 'desc' },
          include: { changedBy: { select: { id: true, fullName: true, username: true } } },
        },
        fulfillments: { orderBy: { fulfilledAt: 'desc' } },
      },
    });
    if (!order) throw new AppError('Sales order not found.', 404);
    await assertWarehouseAccess(user, order.warehouseId, 'READ');

    if (!canUserViewInventory(user)) {
      return { ...order, stockAvailability: null };
    }
    const [enriched] = await attachStockAvailabilityToOrders([order]);
    return enriched;
  }

  static async getOrderHistory(id: string, user: UserContext) {
    const order = await prisma.salesOrder.findUnique({
      where: { id },
      select: { id: true, warehouseId: true },
    });
    if (!order) throw new AppError('Sales order not found.', 404);
    await assertWarehouseAccess(user, order.warehouseId, 'READ');

    return prisma.salesOrderStatusHistory.findMany({
      where: { salesOrderId: id },
      orderBy: { createdAt: 'desc' },
      include: { changedBy: { select: { id: true, fullName: true, username: true } } },
    });
  }

  /**
   * Compute authoritative line pricing, UOM conversion, and tax snapshots on the backend.
   */
  private static async buildOrderLines(
    tx: Prisma.TransactionClient,
    lines: CreateSalesOrderInput['lines'],
    effectiveDate: Date,
  ) {
    const preparedLines: Prisma.SalesOrderLineCreateWithoutSalesOrderInput[] = [];
    let orderSubtotal = ZERO;
    let orderDiscount = ZERO;
    let orderTax = ZERO;
    let orderTotal = ZERO;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const variant = await tx.productVariant.findUnique({
        where: { id: line.productVariantId },
        include: {
          product: { include: { taxRate: true } },
          inventoryItem: true,
        },
      });

      if (!variant || !variant.isActive || !variant.product.isActive) {
        throw new AppError(`Active product variant not found for line ${i + 1}.`, 404);
      }
      if (!variant.inventoryItem || !variant.inventoryItem.isActive) {
        throw new AppError(
          `Product variant ${variant.sku} does not have an active inventory item.`,
          400,
        );
      }

      const orderedQty = new Prisma.Decimal(line.orderedQuantity);
      const { converted: baseQty, multiplier } = await convertQuantityDecimal(
        tx,
        orderedQty,
        line.uomId,
        variant.inventoryItem.uomId,
      );

      // Authoritative unit price in ordered UOM derived from variant.defaultSellingPrice (base UOM)
      const baseUnitPrice = new Prisma.Decimal(variant.defaultSellingPrice);
      const unitPrice = baseUnitPrice.mul(multiplier).toDecimalPlaces(2);

      const discountPct = new Prisma.Decimal(line.discountPercent || '0');
      const grossAmount = orderedQty.mul(unitPrice).toDecimalPlaces(2);
      const lineDiscount = grossAmount.mul(discountPct).div(HUNDRED).toDecimalPlaces(2);
      const taxableAmount = grossAmount.sub(lineDiscount);

      const taxRate = await resolveApplicableTaxRate(
        tx,
        variant.product.hsnCode,
        effectiveDate,
        variant.product.taxRate,
      );
      const taxPct = new Prisma.Decimal(taxRate.ratePercentage);
      const taxAmount = taxableAmount.mul(taxPct).div(HUNDRED).toDecimalPlaces(2);
      const lineTotal = taxableAmount.add(taxAmount);

      orderSubtotal = orderSubtotal.add(grossAmount);
      orderDiscount = orderDiscount.add(lineDiscount);
      orderTax = orderTax.add(taxAmount);
      orderTotal = orderTotal.add(lineTotal);

      preparedLines.push({
        lineNumber: i + 1,
        productVariant: { connect: { id: variant.id } },
        inventoryItem: { connect: { id: variant.inventoryItem.id } },
        uom: { connect: { id: line.uomId } },
        orderedQuantity: orderedQty,
        baseQuantity: baseQty,
        unitPrice,
        discountPercent: discountPct,
        taxRate: { connect: { id: taxRate.id } },
        taxPercentage: taxPct,
        taxableAmount,
        taxAmount,
        lineTotal,
        notes: line.notes ?? null,
      });
    }

    return {
      preparedLines,
      subtotal: orderSubtotal.toDecimalPlaces(2),
      discountAmount: orderDiscount.toDecimalPlaces(2),
      taxAmount: orderTax.toDecimalPlaces(2),
      totalAmount: orderTotal.toDecimalPlaces(2),
    };
  }

  static async createOrder(input: CreateSalesOrderInput, user: UserContext, meta: AuditMeta) {
    await assertWarehouseAccess(user, input.warehouseId, 'READ_WRITE');

    const [customer, warehouse] = await Promise.all([
      prisma.customer.findUnique({ where: { id: input.customerId } }),
      prisma.warehouse.findUnique({ where: { id: input.warehouseId } }),
    ]);
    if (!customer || !customer.isActive) throw new AppError('Active customer not found.', 404);
    if (!warehouse || !warehouse.isActive) throw new AppError('Active warehouse not found.', 404);

    if (input.shippingAddressId) {
      const addr = await prisma.customerAddress.findUnique({
        where: { id: input.shippingAddressId },
      });
      if (!addr || addr.customerId !== customer.id) {
        throw new AppError('Shipping address does not belong to the selected customer.', 400);
      }
    }

    const created = await prisma.$transaction(async tx => {
      const orderDate = input.orderDate ? new Date(input.orderDate) : new Date();
      const computed = await this.buildOrderLines(tx, input.lines, orderDate);

      const order = await tx.salesOrder.create({
        data: {
          orderNumber: generateDocNumber('SO'),
          customerId: customer.id,
          shippingAddressId: input.shippingAddressId ?? null,
          warehouseId: warehouse.id,
          salesmanId: user.userId,
          orderDate,
          expectedDeliveryDate: input.expectedDeliveryDate
            ? new Date(input.expectedDeliveryDate)
            : null,
          status: SalesOrderStatus.DRAFT,
          subtotal: computed.subtotal,
          discountAmount: computed.discountAmount,
          taxAmount: computed.taxAmount,
          totalAmount: computed.totalAmount,
          notes: input.notes ?? null,
          deliveryInstructions: input.deliveryInstructions ?? null,
          createdById: user.userId,
          lines: { create: computed.preparedLines },
          statusHistory: {
            create: {
              fromStatus: null,
              toStatus: SalesOrderStatus.DRAFT,
              changedById: user.userId,
              reason: 'Sales order created',
            },
          },
        },
        include: ORDER_INCLUDE,
      });

      return order;
    });

    await AuditService.log({
      userId: meta.userId,
      action: AuditAction.CREATE,
      entityType: 'SalesOrder',
      entityId: created.id,
      newState: toPlainJson(created),
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });

    await NotificationEventsService.onSalesOrderCreated({
      id: created.id,
      orderNumber: created.orderNumber,
      warehouseId: created.warehouseId,
      salesmanId: created.salesmanId,
      customerName: created.customer?.legalName,
    });

    return created;
  }

  static async updateOrder(
    id: string,
    input: UpdateSalesOrderInput,
    user: UserContext,
    meta: AuditMeta,
  ) {
    const existing = await prisma.salesOrder.findUnique({
      where: { id },
      include: { lines: true },
    });
    if (!existing) throw new AppError('Sales order not found.', 404);
    await assertWarehouseAccess(user, existing.warehouseId, 'READ_WRITE');

    if (existing.status !== 'DRAFT' && existing.status !== 'REJECTED') {
      throw new AppError(
        `Only DRAFT or REJECTED sales orders can be modified (current status: ${existing.status}).`,
        400,
      );
    }

    const targetCustomerId = input.customerId || existing.customerId;
    const targetWarehouseId = input.warehouseId || existing.warehouseId;

    if (input.warehouseId) {
      await assertWarehouseAccess(user, targetWarehouseId, 'READ_WRITE');
      const wh = await prisma.warehouse.findUnique({ where: { id: targetWarehouseId } });
      if (!wh || !wh.isActive) throw new AppError('Active warehouse not found.', 404);
    }

    if (input.customerId) {
      const cust = await prisma.customer.findUnique({ where: { id: targetCustomerId } });
      if (!cust || !cust.isActive) throw new AppError('Active customer not found.', 404);
    }

    if (input.shippingAddressId) {
      const addr = await prisma.customerAddress.findUnique({
        where: { id: input.shippingAddressId },
      });
      if (!addr || addr.customerId !== targetCustomerId) {
        throw new AppError('Shipping address does not belong to the selected customer.', 400);
      }
    }

    const updated = await prisma.$transaction(async tx => {
      let lineUpdateData: Record<string, unknown> = {};

      if (input.lines) {
        await tx.salesOrderLine.deleteMany({ where: { salesOrderId: id } });
        const computed = await this.buildOrderLines(tx, input.lines, existing.orderDate);
        lineUpdateData = {
          subtotal: computed.subtotal,
          discountAmount: computed.discountAmount,
          taxAmount: computed.taxAmount,
          totalAmount: computed.totalAmount,
          lines: { create: computed.preparedLines },
        };
      }

      return tx.salesOrder.update({
        where: { id },
        data: {
          customerId: targetCustomerId,
          warehouseId: targetWarehouseId,
          ...(input.shippingAddressId !== undefined
            ? { shippingAddressId: input.shippingAddressId }
            : {}),
          ...(input.expectedDeliveryDate !== undefined
            ? {
                expectedDeliveryDate: input.expectedDeliveryDate
                  ? new Date(input.expectedDeliveryDate)
                  : null,
              }
            : {}),
          ...(input.notes !== undefined ? { notes: input.notes } : {}),
          ...(input.deliveryInstructions !== undefined
            ? { deliveryInstructions: input.deliveryInstructions }
            : {}),
          ...lineUpdateData,
        },
        include: ORDER_INCLUDE,
      });
    });

    await AuditService.log({
      userId: meta.userId,
      action: AuditAction.UPDATE,
      entityType: 'SalesOrder',
      entityId: id,
      previousState: { status: existing.status, totalAmount: existing.totalAmount },
      newState: { status: updated.status, totalAmount: updated.totalAmount },
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });

    return updated;
  }

  static async submitOrder(id: string, user: UserContext, meta: AuditMeta) {
    const existing = await prisma.salesOrder.findUnique({ where: { id } });
    if (!existing) throw new AppError('Sales order not found.', 404);
    await assertWarehouseAccess(user, existing.warehouseId, 'READ_WRITE');

    if (existing.status !== 'DRAFT' && existing.status !== 'REJECTED') {
      throw new AppError(
        `Only DRAFT or REJECTED orders can be submitted (current status: ${existing.status}).`,
        400,
      );
    }

    const updated = await prisma.$transaction(async tx => {
      const order = await tx.salesOrder.update({
        where: { id },
        data: {
          status: SalesOrderStatus.SUBMITTED,
          submittedById: user.userId,
          submittedAt: new Date(),
        },
        include: ORDER_INCLUDE,
      });

      await tx.salesOrderStatusHistory.create({
        data: {
          salesOrderId: id,
          fromStatus: existing.status,
          toStatus: SalesOrderStatus.SUBMITTED,
          changedById: user.userId,
          reason: 'Submitted for approval',
        },
      });

      return order;
    });

    await AuditService.log({
      userId: meta.userId,
      action: AuditAction.SUBMIT,
      entityType: 'SalesOrder',
      entityId: id,
      previousState: { status: existing.status },
      newState: { status: updated.status },
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });

    await NotificationEventsService.onSalesOrderSubmitted({
      id: updated.id,
      orderNumber: updated.orderNumber,
      warehouseId: updated.warehouseId,
      salesmanId: updated.salesmanId,
    });

    return updated;
  }

  static async approveOrder(id: string, user: UserContext, meta: AuditMeta) {
    const existing = await prisma.salesOrder.findUnique({ where: { id } });
    if (!existing) throw new AppError('Sales order not found.', 404);
    await assertWarehouseAccess(user, existing.warehouseId, 'READ_WRITE');

    if (existing.status !== 'SUBMITTED') {
      throw new AppError(
        `Only SUBMITTED orders can be approved (current status: ${existing.status}).`,
        400,
      );
    }

    const updated = await prisma.$transaction(async tx => {
      const order = await tx.salesOrder.update({
        where: { id },
        data: {
          status: SalesOrderStatus.APPROVED,
          approvedById: user.userId,
          approvedAt: new Date(),
        },
        include: ORDER_INCLUDE,
      });

      await tx.salesOrderStatusHistory.create({
        data: {
          salesOrderId: id,
          fromStatus: existing.status,
          toStatus: SalesOrderStatus.APPROVED,
          changedById: user.userId,
          reason: 'Order approved',
        },
      });

      return order;
    });

    await AuditService.log({
      userId: meta.userId,
      action: AuditAction.APPROVE,
      entityType: 'SalesOrder',
      entityId: id,
      previousState: { status: existing.status },
      newState: { status: updated.status },
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });

    await NotificationEventsService.onSalesOrderApproved({
      id: updated.id,
      orderNumber: updated.orderNumber,
      warehouseId: updated.warehouseId,
      salesmanId: updated.salesmanId,
    });

    return updated;
  }

  static async rejectOrder(id: string, reason: string, user: UserContext, meta: AuditMeta) {
    const existing = await prisma.salesOrder.findUnique({ where: { id } });
    if (!existing) throw new AppError('Sales order not found.', 404);
    await assertWarehouseAccess(user, existing.warehouseId, 'READ_WRITE');

    if (existing.status !== 'SUBMITTED') {
      throw new AppError(
        `Only SUBMITTED orders can be rejected (current status: ${existing.status}).`,
        400,
      );
    }

    const updated = await prisma.$transaction(async tx => {
      const order = await tx.salesOrder.update({
        where: { id },
        data: {
          status: SalesOrderStatus.REJECTED,
          rejectedById: user.userId,
          rejectedAt: new Date(),
          rejectionReason: reason,
        },
        include: ORDER_INCLUDE,
      });

      await tx.salesOrderStatusHistory.create({
        data: {
          salesOrderId: id,
          fromStatus: existing.status,
          toStatus: SalesOrderStatus.REJECTED,
          changedById: user.userId,
          reason,
        },
      });

      return order;
    });

    await AuditService.log({
      userId: meta.userId,
      action: AuditAction.REJECT,
      entityType: 'SalesOrder',
      entityId: id,
      previousState: { status: existing.status },
      newState: { status: updated.status, rejectionReason: reason },
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
      remarks: reason,
    });

    await NotificationEventsService.onSalesOrderRejected({
      id: updated.id,
      orderNumber: updated.orderNumber,
      salesmanId: updated.salesmanId,
      reason,
    });

    return updated;
  }

  /**
   * Confirm an APPROVED sales order and atomically reserve available stock in the order's warehouse.
   */
  static async confirmOrder(
    id: string,
    idempotencyKey: string | undefined,
    user: UserContext,
    meta: AuditMeta,
  ) {
    const effectiveKey = idempotencyKey || `CONFIRM-SO-${id}`;

    const existingIdempotent = await prisma.salesOrder.findUnique({
      where: { idempotencyKey: effectiveKey },
      include: ORDER_INCLUDE,
    });
    if (existingIdempotent && existingIdempotent.status === 'CONFIRMED') {
      await assertWarehouseAccess(user, existingIdempotent.warehouseId, 'READ_WRITE');
      return existingIdempotent;
    }

    const confirmed = await prisma.$transaction(async tx => {
      const locked = await tx.$queryRaw<{ id: string; status: string }[]>`
        SELECT id, status FROM sales_orders WHERE id = ${id} FOR UPDATE
      `;
      if (locked.length === 0) throw new AppError('Sales order not found.', 404);

      const order = await tx.salesOrder.findUniqueOrThrow({
        where: { id },
        include: { lines: { orderBy: { lineNumber: 'asc' } } },
      });

      await assertWarehouseAccess(user, order.warehouseId, 'READ_WRITE');

      if (order.status === 'CONFIRMED') {
        if (order.idempotencyKey === effectiveKey) {
          return tx.salesOrder.findUniqueOrThrow({ where: { id }, include: ORDER_INCLUDE });
        }
        throw new AppError('Sales order has already been confirmed.', 409);
      }

      if (order.status !== 'APPROVED') {
        throw new AppError(
          `Sales order must be APPROVED before confirmation (current status: ${order.status}).`,
          400,
        );
      }

      // Reserve stock transactionally via InventoryReservationService
      await InventoryReservationService.reserveStockInTx(
        tx,
        order.warehouseId,
        order.lines.map(l => ({
          inventoryItemId: l.inventoryItemId,
          baseQuantity: new Prisma.Decimal(l.baseQuantity),
        })),
      );

      for (const line of order.lines) {
        await tx.salesOrderLine.update({
          where: { id: line.id },
          data: { reservedBaseQuantity: line.baseQuantity },
        });
      }

      const updatedOrder = await tx.salesOrder.update({
        where: { id },
        data: {
          status: SalesOrderStatus.CONFIRMED,
          confirmedById: user.userId,
          confirmedAt: new Date(),
          idempotencyKey: effectiveKey,
        },
        include: ORDER_INCLUDE,
      });

      await tx.salesOrderStatusHistory.create({
        data: {
          salesOrderId: id,
          fromStatus: order.status,
          toStatus: SalesOrderStatus.CONFIRMED,
          changedById: user.userId,
          reason: 'Order confirmed and stock reserved',
        },
      });

      return updatedOrder;
    });

    await AuditService.log({
      userId: meta.userId,
      action: AuditAction.CONFIRM,
      entityType: 'SalesOrder',
      entityId: id,
      previousState: { status: 'APPROVED' },
      newState: { status: confirmed.status, orderNumber: confirmed.orderNumber },
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
      remarks: `Confirmed sales order ${confirmed.orderNumber} and reserved inventory`,
    });

    await NotificationEventsService.onSalesOrderConfirmed({
      id: confirmed.id,
      orderNumber: confirmed.orderNumber,
      warehouseId: confirmed.warehouseId,
      salesmanId: confirmed.salesmanId,
    });

    return confirmed;
  }

  /**
   * Cancel a sales order and release any reserved stock if the order was CONFIRMED.
   */
  static async cancelOrder(id: string, reason: string, user: UserContext, meta: AuditMeta) {
    const cancelled = await prisma.$transaction(async tx => {
      const locked = await tx.$queryRaw<{ id: string; status: string }[]>`
        SELECT id, status FROM sales_orders WHERE id = ${id} FOR UPDATE
      `;
      if (locked.length === 0) throw new AppError('Sales order not found.', 404);

      const order = await tx.salesOrder.findUniqueOrThrow({
        where: { id },
        include: { lines: { orderBy: { lineNumber: 'asc' } } },
      });

      await assertWarehouseAccess(user, order.warehouseId, 'READ_WRITE');

      if (
        order.status === 'PARTIALLY_FULFILLED' ||
        order.status === 'FULFILLED' ||
        order.status === 'CANCELLED'
      ) {
        throw new AppError(`Cannot cancel sales order in status ${order.status}.`, 400);
      }

      if (order.status === 'CONFIRMED') {
        const toRelease = order.lines
          .filter(l => new Prisma.Decimal(l.reservedBaseQuantity).gt(ZERO))
          .map(l => ({
            inventoryItemId: l.inventoryItemId,
            baseQuantity: new Prisma.Decimal(l.reservedBaseQuantity),
          }));

        await InventoryReservationService.releaseReservedStockInTx(tx, order.warehouseId, toRelease);

        for (const line of order.lines) {
          await tx.salesOrderLine.update({
            where: { id: line.id },
            data: { reservedBaseQuantity: ZERO },
          });
        }
      }

      const updatedOrder = await tx.salesOrder.update({
        where: { id },
        data: {
          status: SalesOrderStatus.CANCELLED,
          cancelledById: user.userId,
          cancelledAt: new Date(),
          cancellationReason: reason,
        },
        include: ORDER_INCLUDE,
      });

      await tx.salesOrderStatusHistory.create({
        data: {
          salesOrderId: id,
          fromStatus: order.status,
          toStatus: SalesOrderStatus.CANCELLED,
          changedById: user.userId,
          reason,
        },
      });

      return { updatedOrder, previousStatus: order.status };
    });

    await AuditService.log({
      userId: meta.userId,
      action: AuditAction.CANCEL,
      entityType: 'SalesOrder',
      entityId: id,
      previousState: { status: cancelled.previousStatus },
      newState: { status: cancelled.updatedOrder.status, cancellationReason: reason },
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
      remarks: reason,
    });

    await NotificationEventsService.onSalesOrderCancelled({
      id: cancelled.updatedOrder.id,
      orderNumber: cancelled.updatedOrder.orderNumber,
      warehouseId: cancelled.updatedOrder.warehouseId,
      salesmanId: cancelled.updatedOrder.salesmanId,
      reason,
    });

    return cancelled.updatedOrder;
  }

  /**
   * Fulfill a CONFIRMED or PARTIALLY_FULFILLED sales order via InventoryReservationService.
   */
  static async fulfillOrder(
    id: string,
    input: FulfillSalesOrderInput,
    user: UserContext,
    meta: AuditMeta,
  ) {
    const effectiveKey = input.idempotencyKey || `FULFILL-SO-${id}-${Date.now()}`;

    if (input.idempotencyKey) {
      const existingFulfillment = await prisma.salesOrderFulfillment.findUnique({
        where: { idempotencyKey: input.idempotencyKey },
      });
      if (existingFulfillment) {
        const order = await prisma.salesOrder.findUniqueOrThrow({
          where: { id },
          include: ORDER_INCLUDE,
        });
        await assertWarehouseAccess(user, order.warehouseId, 'READ_WRITE');
        return { order, fulfillment: existingFulfillment };
      }
    }

    const result = await prisma.$transaction(async tx => {
      const locked = await tx.$queryRaw<{ id: string; status: string }[]>`
        SELECT id, status FROM sales_orders WHERE id = ${id} FOR UPDATE
      `;
      if (locked.length === 0) throw new AppError('Sales order not found.', 404);

      const order = await tx.salesOrder.findUniqueOrThrow({
        where: { id },
        include: { lines: { orderBy: { lineNumber: 'asc' } } },
      });

      await assertWarehouseAccess(user, order.warehouseId, 'READ_WRITE');

      if (order.status !== 'CONFIRMED' && order.status !== 'PARTIALLY_FULFILLED') {
        throw new AppError(
          `Only CONFIRMED or PARTIALLY_FULFILLED orders can be fulfilled (current status: ${order.status}).`,
          400,
        );
      }

      const lineMap = new Map(order.lines.map(l => [l.id, l]));
      const fulfillmentRequests: Array<{
        orderLine: (typeof order.lines)[0];
        requestedQty: Prisma.Decimal;
        baseQty: Prisma.Decimal;
      }> = [];

      if (input.lines && input.lines.length > 0) {
        for (const reqLine of input.lines) {
          const orderLine = lineMap.get(reqLine.salesOrderLineId);
          if (!orderLine) {
            throw new AppError(`Sales order line ${reqLine.salesOrderLineId} not found.`, 404);
          }
          const reqQty = new Prisma.Decimal(reqLine.quantity);
          const { converted: baseQty } = await convertQuantityDecimal(
            tx,
            reqQty,
            orderLine.uomId,
            orderLine.inventoryItemId
              ? (await tx.inventoryItem.findUniqueOrThrow({ where: { id: orderLine.inventoryItemId } }))
                  .uomId
              : orderLine.uomId,
          );

          const remainingBase = new Prisma.Decimal(orderLine.baseQuantity).sub(
            orderLine.fulfilledBaseQuantity,
          );
          if (baseQty.gt(remainingBase)) {
            throw new AppError(
              `Line ${orderLine.lineNumber}: Fulfillment quantity exceeds remaining unfulfilled quantity (${remainingBase.toString()}).`,
              400,
            );
          }

          fulfillmentRequests.push({ orderLine, requestedQty: reqQty, baseQty });
        }
      } else {
        // Fulfill all remaining quantities
        for (const orderLine of order.lines) {
          const remainingBase = new Prisma.Decimal(orderLine.baseQuantity).sub(
            orderLine.fulfilledBaseQuantity,
          );
          if (remainingBase.lte(ZERO)) continue;

          const ratio = new Prisma.Decimal(orderLine.orderedQuantity).div(orderLine.baseQuantity);
          const remainingOrdered = remainingBase.mul(ratio).toDecimalPlaces(4);
          fulfillmentRequests.push({
            orderLine,
            requestedQty: remainingOrdered,
            baseQty: remainingBase,
          });
        }
      }

      if (fulfillmentRequests.length === 0) {
        throw new AppError('No remaining quantities to fulfill on this sales order.', 400);
      }

      const { inventoryIssue } = await InventoryReservationService.fulfillReservedStockInTx(tx, {
        warehouseId: order.warehouseId,
        orderNumber: order.orderNumber,
        orderId: order.id,
        idempotencyKey: effectiveKey,
        userId: user.userId,
        notes: input.notes ?? null,
        lines: fulfillmentRequests.map(f => ({
          inventoryItemId: f.orderLine.inventoryItemId,
          uomId: f.orderLine.uomId,
          requestedQuantity: f.requestedQty,
          baseQuantity: f.baseQty,
        })),
      });

      // Update order lines fulfilled and reserved quantities
      for (const f of fulfillmentRequests) {
        const newFulfilled = new Prisma.Decimal(f.orderLine.fulfilledBaseQuantity).add(f.baseQty);
        const newReserved = Prisma.Decimal.max(
          ZERO,
          new Prisma.Decimal(f.orderLine.reservedBaseQuantity).sub(f.baseQty),
        );

        await tx.salesOrderLine.update({
          where: { id: f.orderLine.id },
          data: {
            fulfilledBaseQuantity: newFulfilled,
            reservedBaseQuantity: newReserved,
          },
        });
      }

      const refreshedLines = await tx.salesOrderLine.findMany({ where: { salesOrderId: id } });
      const allFulfilled = refreshedLines.every(l =>
        new Prisma.Decimal(l.fulfilledBaseQuantity).gte(l.baseQuantity),
      );
      const nextStatus = allFulfilled
        ? SalesOrderStatus.FULFILLED
        : SalesOrderStatus.PARTIALLY_FULFILLED;

      const fulfillment = await tx.salesOrderFulfillment.create({
        data: {
          fulfillmentNumber: generateDocNumber('FUL'),
          salesOrderId: order.id,
          inventoryIssueId: inventoryIssue.id,
          idempotencyKey: effectiveKey,
          fulfilledById: user.userId,
          notes: input.notes ?? null,
        },
      });

      const updatedOrder = await tx.salesOrder.update({
        where: { id },
        data: { status: nextStatus },
        include: ORDER_INCLUDE,
      });

      await tx.salesOrderStatusHistory.create({
        data: {
          salesOrderId: id,
          fromStatus: order.status,
          toStatus: nextStatus,
          changedById: user.userId,
          reason: `Fulfilled via ${fulfillment.fulfillmentNumber} (Issue: ${inventoryIssue.issueNumber})`,
        },
      });

      return { order: updatedOrder, fulfillment, previousStatus: order.status };
    });

    await AuditService.log({
      userId: meta.userId,
      action: AuditAction.FULFILL,
      entityType: 'SalesOrder',
      entityId: id,
      previousState: { status: result.previousStatus },
      newState: {
        status: result.order.status,
        fulfillmentNumber: result.fulfillment.fulfillmentNumber,
      },
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });

    await NotificationEventsService.onSalesOrderFulfilled({
      id: result.order.id,
      orderNumber: result.order.orderNumber,
      warehouseId: result.order.warehouseId,
      salesmanId: result.order.salesmanId,
      status: result.order.status,
    });
    await NotificationEventsService.evaluateInventoryAlerts(
      result.order.warehouseId,
      result.order.lines.map(l => l.inventoryItemId),
    );

    return { order: result.order, fulfillment: result.fulfillment };
  }
}
