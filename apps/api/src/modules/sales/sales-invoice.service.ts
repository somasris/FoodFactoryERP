import crypto from 'crypto';
import { AuditAction, Prisma, SalesInvoiceStatus } from '@prisma/client';
import { prisma } from '../../services/prisma.service';
import { AuditService } from '../../services/audit.service';
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
  getAuthorizedWarehouseIds,
  UserContext,
  ZERO,
} from '../inventory/inventory.utils';
import { CreateSalesInvoiceInput, UpdateSalesInvoiceInput } from './sales-invoice.types';
import { buildDateRangeFilter, resolveApplicableTaxRate } from './sales.utils';

const HUNDRED = new Prisma.Decimal(100);
const TWO = new Prisma.Decimal(2);

const INVOICE_INCLUDE = {
  salesOrder: { select: { id: true, orderNumber: true, status: true, orderDate: true } },
  fulfillment: { select: { id: true, fulfillmentNumber: true, fulfilledAt: true } },
  customer: {
    select: {
      id: true,
      code: true,
      legalName: true,
      tradeName: true,
      gstin: true,
      phone: true,
      email: true,
    },
  },
  billingAddress: true,
  warehouse: { select: { id: true, code: true, name: true } },
  company: { select: { id: true, code: true, legalName: true, gstin: true, stateCode: true } },
  lines: {
    orderBy: { lineNumber: 'asc' as const },
    include: {
      productVariant: { select: { id: true, sku: true, name: true } },
      uom: { select: { id: true, code: true, symbol: true } },
      taxRate: { select: { id: true, code: true, name: true, ratePercentage: true } },
    },
  },
};

export function getIndianFinancialYear(date: Date): string {
  const year = date.getUTCFullYear();
  const month = date.getUTCMonth(); // 0 = Jan, 3 = Apr
  if (month >= 3) {
    return `${year}-${String(year + 1).slice(-2)}`;
  }
  return `${year - 1}-${String(year).slice(-2)}`;
}

async function generateInvoiceNumberInTx(
  tx: Prisma.TransactionClient,
  invoiceDate: Date,
): Promise<{ invoiceNumber: string; financialYear: string }> {
  const prefixCfg = await tx.systemConfig.findUnique({ where: { key: 'INVOICE_NUMBER_PREFIX' } });
  const prefix = (prefixCfg?.value || 'INV').trim().toUpperCase().slice(0, 15) || 'INV';
  const financialYear = getIndianFinancialYear(invoiceDate);
  const newId = crypto.randomUUID();

  const rows = await tx.$queryRaw<{ last_number: number }[]>`
    INSERT INTO invoice_number_sequences (id, prefix, financial_year, last_number, updated_at)
    VALUES (${newId}, ${prefix}, ${financialYear}, 1, NOW())
    ON CONFLICT (prefix, financial_year)
    DO UPDATE SET last_number = invoice_number_sequences.last_number + 1, updated_at = NOW()
    RETURNING last_number
  `;

  const seq = rows[0].last_number;
  return {
    invoiceNumber: `${prefix}/${financialYear}/${String(seq).padStart(5, '0')}`,
    financialYear,
  };
}

export class SalesInvoiceService {
  static async listInvoices(
    params: PaginationParams,
    user: UserContext,
    filters: {
      status?: string;
      customerId?: string;
      salesOrderId?: string;
      warehouseId?: string;
      fromDate?: string;
      toDate?: string;
    },
  ) {
    const allowedWh = await getAuthorizedWarehouseIds(user, 'READ');
    if (filters.warehouseId) {
      await assertWarehouseAccess(user, filters.warehouseId, 'READ');
    }

    const where: Prisma.SalesInvoiceWhereInput = {};
    if (filters.warehouseId) {
      where.warehouseId = filters.warehouseId;
    } else if (allowedWh) {
      where.warehouseId = { in: allowedWh };
    }

    if (filters.status) where.status = filters.status as SalesInvoiceStatus;
    if (filters.customerId) where.customerId = filters.customerId;
    if (filters.salesOrderId) where.salesOrderId = filters.salesOrderId;
    const dateFilter = buildDateRangeFilter(filters.fromDate, filters.toDate);
    if (dateFilter) {
      where.invoiceDate = dateFilter;
    }
    if (params.search) {
      where.OR = [
        { invoiceNumber: { contains: params.search, mode: 'insensitive' } },
        { customerLegalName: { contains: params.search, mode: 'insensitive' } },
        { salesOrder: { orderNumber: { contains: params.search, mode: 'insensitive' } } },
      ];
    }

    const [items, total] = await Promise.all([
      prisma.salesInvoice.findMany({
        where,
        skip: params.skip,
        take: params.take,
        orderBy: { createdAt: 'desc' },
        include: {
          salesOrder: { select: { id: true, orderNumber: true } },
          customer: { select: { id: true, code: true, legalName: true } },
          warehouse: { select: { id: true, code: true, name: true } },
          _count: { select: { lines: true } },
        },
      }),
      prisma.salesInvoice.count({ where }),
    ]);

    return paginatedResult(items, total, params.page, params.limit);
  }

  static async listOrderInvoices(orderId: string, user: UserContext) {
    const order = await prisma.salesOrder.findUnique({
      where: { id: orderId },
      select: { id: true, warehouseId: true },
    });
    if (!order) throw new AppError('Sales order not found.', 404);
    await assertWarehouseAccess(user, order.warehouseId, 'READ');

    return prisma.salesInvoice.findMany({
      where: { salesOrderId: orderId },
      orderBy: { createdAt: 'desc' },
      include: INVOICE_INCLUDE,
    });
  }

  static async getInvoiceById(id: string, user: UserContext) {
    const invoice = await prisma.salesInvoice.findUnique({
      where: { id },
      include: {
        ...INVOICE_INCLUDE,
        statusHistory: {
          orderBy: { createdAt: 'desc' },
          include: { changedBy: { select: { id: true, fullName: true, username: true } } },
        },
      },
    });
    if (!invoice) throw new AppError('Sales invoice not found.', 404);
    await assertWarehouseAccess(user, invoice.warehouseId, 'READ');
    return invoice;
  }

  static async getInvoiceByNumber(invoiceNumber: string, user: UserContext) {
    const invoice = await prisma.salesInvoice.findUnique({
      where: { invoiceNumber },
      include: {
        ...INVOICE_INCLUDE,
        statusHistory: {
          orderBy: { createdAt: 'desc' },
          include: { changedBy: { select: { id: true, fullName: true, username: true } } },
        },
      },
    });
    if (!invoice) throw new AppError('Sales invoice not found.', 404);
    await assertWarehouseAccess(user, invoice.warehouseId, 'READ');
    return invoice;
  }

  private static async resolveCompanyAndCustomerSnapshot(
    tx: Prisma.TransactionClient,
    customerId: string,
    billingAddressId: string | null | undefined,
    shippingAddressId: string | null | undefined,
    userId: string,
  ) {
    const userRecord = await tx.user.findUnique({
      where: { id: userId },
      select: { companyId: true },
    });

    const company = userRecord?.companyId
      ? await tx.company.findUnique({ where: { id: userRecord.companyId } })
      : await tx.company.findFirst({ where: { isActive: true }, orderBy: { createdAt: 'asc' } });

    if (!company || !company.isActive) {
      throw new AppError('Active company configuration is required for GST invoicing.', 400);
    }
    if (!company.gstin?.trim() || !company.stateCode?.trim()) {
      throw new AppError(
        'Company GSTIN and state code must be configured before generating GST invoices.',
        400,
      );
    }

    const customer = await tx.customer.findUnique({
      where: { id: customerId },
      include: { addresses: true },
    });
    if (!customer) throw new AppError('Customer not found.', 404);

    let billingAddress = billingAddressId
      ? customer.addresses.find(a => a.id === billingAddressId)
      : undefined;

    if (billingAddressId && !billingAddress) {
      throw new AppError('Selected billing address does not belong to the customer.', 400);
    }

    if (!billingAddress) {
      billingAddress =
        customer.addresses.find(a => a.addressType === 'BILLING' && a.isDefault) ||
        customer.addresses.find(a => a.addressType === 'BILLING') ||
        (shippingAddressId
          ? customer.addresses.find(a => a.id === shippingAddressId)
          : undefined) ||
        customer.addresses.find(a => a.isDefault) ||
        customer.addresses[0];
    }

    const customerStateCode =
      billingAddress?.stateCode?.trim() ||
      (customer.gstin && customer.gstin.trim().length >= 2
        ? customer.gstin.trim().slice(0, 2)
        : '');

    if (!customerStateCode) {
      throw new AppError(
        'Customer billing address with state code or customer GSTIN is required for GST invoicing.',
        400,
      );
    }

    const customerBillingAddress = billingAddress
      ? `${billingAddress.addressLine1}, ${billingAddress.city}, ${billingAddress.state} - ${billingAddress.pincode}`
      : 'Address not specified';

    const isInterState = company.stateCode.trim() !== customerStateCode;
    const placeOfSupply = billingAddress
      ? `${billingAddress.state} (${customerStateCode})`
      : `State Code ${customerStateCode}`;

    return {
      company,
      customer,
      billingAddressId: billingAddress?.id ?? null,
      customerStateCode,
      customerBillingAddress,
      placeOfSupply,
      isInterState,
    };
  }

  private static async buildInvoiceLinesAndAllocate(
    tx: Prisma.TransactionClient,
    salesOrderId: string,
    invoiceDate: Date,
    isInterState: boolean,
    requestedLines?: CreateSalesInvoiceInput['lines'],
  ) {
    const orderLines = await tx.salesOrderLine.findMany({
      where: { salesOrderId },
      orderBy: { lineNumber: 'asc' },
      include: {
        productVariant: { include: { product: { include: { taxRate: true } } } },
        inventoryItem: true,
        uom: true,
        taxRate: true,
      },
    });

    const lineMap = new Map(orderLines.map(l => [l.id, l]));
    const targetItems: Array<{
      orderLine: (typeof orderLines)[0];
      qty: Prisma.Decimal;
      baseQty: Prisma.Decimal;
    }> = [];

    if (requestedLines && requestedLines.length > 0) {
      const seenLineIds = new Set<string>();
      for (const reqLine of requestedLines) {
        if (seenLineIds.has(reqLine.salesOrderLineId)) {
          throw new AppError('Duplicate salesOrderLineId in invoice lines.', 400);
        }
        seenLineIds.add(reqLine.salesOrderLineId);

        const orderLine = lineMap.get(reqLine.salesOrderLineId);
        if (!orderLine) {
          throw new AppError(`Sales order line ${reqLine.salesOrderLineId} not found.`, 404);
        }

        const qty = new Prisma.Decimal(reqLine.quantity);
        const { converted: baseQty } = await convertQuantityDecimal(
          tx,
          qty,
          orderLine.uomId,
          orderLine.inventoryItem.uomId,
        );

        const remainingBase = new Prisma.Decimal(orderLine.fulfilledBaseQuantity).sub(
          orderLine.invoicedBaseQuantity,
        );
        if (baseQty.gt(remainingBase)) {
          throw new AppError(
            `Line ${orderLine.lineNumber}: Invoice quantity exceeds remaining uninvoiced fulfilled quantity (${remainingBase.toString()}).`,
            400,
          );
        }

        targetItems.push({ orderLine, qty, baseQty });
      }
    } else {
      for (const orderLine of orderLines) {
        const remainingBase = new Prisma.Decimal(orderLine.fulfilledBaseQuantity).sub(
          orderLine.invoicedBaseQuantity,
        );
        if (remainingBase.lte(ZERO)) continue;

        const ratio = new Prisma.Decimal(orderLine.orderedQuantity).div(orderLine.baseQuantity);
        const qty = remainingBase.mul(ratio).toDecimalPlaces(4);
        targetItems.push({ orderLine, qty, baseQty: remainingBase });
      }
    }

    if (targetItems.length === 0) {
      throw new AppError('No fulfilled, uninvoiced quantities available to invoice.', 400);
    }

    let subtotal = ZERO;
    let discountAmount = ZERO;
    let taxableAmountTotal = ZERO;
    let cgstTotal = ZERO;
    let sgstTotal = ZERO;
    let igstTotal = ZERO;
    let taxTotal = ZERO;
    let rawLineTotal = ZERO;

    const preparedLines: Prisma.SalesInvoiceLineCreateWithoutSalesInvoiceInput[] = [];

    for (let i = 0; i < targetItems.length; i++) {
      const { orderLine, qty, baseQty } = targetItems[i];
      const hsnCode = orderLine.productVariant.product.hsnCode;

      const activeTaxRate = await resolveApplicableTaxRate(
        tx,
        hsnCode,
        invoiceDate,
        orderLine.taxRate,
      );

      const unitPrice = new Prisma.Decimal(orderLine.unitPrice);
      const discountPct = new Prisma.Decimal(orderLine.discountPercent);
      const gross = qty.mul(unitPrice).toDecimalPlaces(2);
      const lineDiscount = gross.mul(discountPct).div(HUNDRED).toDecimalPlaces(2);
      const taxable = gross.sub(lineDiscount);

      const gstRate = new Prisma.Decimal(activeTaxRate.ratePercentage);
      let cgstRate = ZERO;
      let sgstRate = ZERO;
      let igstRate = ZERO;
      let cgstAmt = ZERO;
      let sgstAmt = ZERO;
      let igstAmt = ZERO;

      if (isInterState) {
        igstRate = gstRate;
        igstAmt = taxable.mul(igstRate).div(HUNDRED).toDecimalPlaces(2);
      } else {
        cgstRate = gstRate.div(TWO).toDecimalPlaces(2);
        sgstRate = gstRate.sub(cgstRate).toDecimalPlaces(2);
        cgstAmt = taxable.mul(cgstRate).div(HUNDRED).toDecimalPlaces(2);
        sgstAmt = taxable.mul(sgstRate).div(HUNDRED).toDecimalPlaces(2);
      }

      const lineTax = cgstAmt.add(sgstAmt).add(igstAmt);
      const lineTotal = taxable.add(lineTax);

      subtotal = subtotal.add(gross);
      discountAmount = discountAmount.add(lineDiscount);
      taxableAmountTotal = taxableAmountTotal.add(taxable);
      cgstTotal = cgstTotal.add(cgstAmt);
      sgstTotal = sgstTotal.add(sgstAmt);
      igstTotal = igstTotal.add(igstAmt);
      taxTotal = taxTotal.add(lineTax);
      rawLineTotal = rawLineTotal.add(lineTotal);

      await tx.salesOrderLine.update({
        where: { id: orderLine.id },
        data: {
          invoicedBaseQuantity: new Prisma.Decimal(orderLine.invoicedBaseQuantity).add(baseQty),
        },
      });

      preparedLines.push({
        salesOrderLine: { connect: { id: orderLine.id } },
        lineNumber: i + 1,
        productVariant: { connect: { id: orderLine.productVariantId } },
        inventoryItem: { connect: { id: orderLine.inventoryItemId } },
        uom: { connect: { id: orderLine.uomId } },
        taxRate: { connect: { id: activeTaxRate.id } },
        itemCode: orderLine.productVariant.sku,
        itemName: `${orderLine.productVariant.product.name} - ${orderLine.productVariant.name}`,
        description: orderLine.productVariant.product.description ?? null,
        hsnCode,
        uomCode: orderLine.uom.code,
        uomSymbol: orderLine.uom.symbol,
        quantity: qty,
        baseQuantity: baseQty,
        unitPrice,
        discountPercent: discountPct,
        discountAmount: lineDiscount,
        taxableAmount: taxable,
        gstRate,
        cgstRate,
        sgstRate,
        igstRate,
        cgstAmount: cgstAmt,
        sgstAmount: sgstAmt,
        igstAmount: igstAmt,
        taxAmount: lineTax,
        lineTotal,
      });
    }

    const grandTotal = rawLineTotal.toDecimalPlaces(0, Prisma.Decimal.ROUND_HALF_UP);
    const roundOffAmount = grandTotal.sub(rawLineTotal).toDecimalPlaces(2);

    return {
      preparedLines,
      subtotal: subtotal.toDecimalPlaces(2),
      discountAmount: discountAmount.toDecimalPlaces(2),
      taxableAmount: taxableAmountTotal.toDecimalPlaces(2),
      cgstAmount: cgstTotal.toDecimalPlaces(2),
      sgstAmount: sgstTotal.toDecimalPlaces(2),
      igstAmount: igstTotal.toDecimalPlaces(2),
      taxAmount: taxTotal.toDecimalPlaces(2),
      roundOffAmount,
      grandTotal,
    };
  }

  static async createInvoiceFromOrder(
    orderId: string,
    input: CreateSalesInvoiceInput,
    user: UserContext,
    meta: AuditMeta,
  ) {
    if (input.idempotencyKey) {
      const existing = await prisma.salesInvoice.findUnique({
        where: { idempotencyKey: input.idempotencyKey },
        include: INVOICE_INCLUDE,
      });
      if (existing) {
        await assertWarehouseAccess(user, existing.warehouseId, 'READ');
        return existing;
      }
    }

    const created = await prisma.$transaction(async tx => {
      const locked = await tx.$queryRaw<{ id: string }[]>`
        SELECT id FROM sales_orders WHERE id = ${orderId} FOR UPDATE
      `;
      if (locked.length === 0) throw new AppError('Sales order not found.', 404);

      const order = await tx.salesOrder.findUniqueOrThrow({
        where: { id: orderId },
      });

      await assertWarehouseAccess(user, order.warehouseId, 'READ_WRITE');

      if (order.status !== 'PARTIALLY_FULFILLED' && order.status !== 'FULFILLED') {
        throw new AppError(
          `Only PARTIALLY_FULFILLED or FULFILLED sales orders can be invoiced (current status: ${order.status}).`,
          400,
        );
      }

      if (input.fulfillmentId) {
        const ful = await tx.salesOrderFulfillment.findUnique({
          where: { id: input.fulfillmentId },
        });
        if (!ful || ful.salesOrderId !== order.id) {
          throw new AppError('Fulfillment record does not belong to this sales order.', 400);
        }
      }

      const invoiceDate = input.invoiceDate ? new Date(input.invoiceDate) : new Date();
      const snapshot = await this.resolveCompanyAndCustomerSnapshot(
        tx,
        order.customerId,
        input.billingAddressId,
        order.shippingAddressId,
        user.userId,
      );

      const dueDate = input.dueDate
        ? new Date(input.dueDate)
        : new Date(invoiceDate.getTime() + snapshot.customer.creditPeriodDays * 86400000);

      const computed = await this.buildInvoiceLinesAndAllocate(
        tx,
        order.id,
        invoiceDate,
        snapshot.isInterState,
        input.lines,
      );

      const { invoiceNumber, financialYear } = await generateInvoiceNumberInTx(tx, invoiceDate);

      return tx.salesInvoice.create({
        data: {
          invoiceNumber,
          financialYear,
          salesOrderId: order.id,
          fulfillmentId: input.fulfillmentId ?? null,
          customerId: order.customerId,
          billingAddressId: snapshot.billingAddressId,
          warehouseId: order.warehouseId,
          companyId: snapshot.company.id,
          invoiceDate,
          dueDate,
          status: SalesInvoiceStatus.DRAFT,
          companyLegalName: snapshot.company.legalName,
          companyGstin: snapshot.company.gstin,
          companyStateCode: snapshot.company.stateCode,
          companyAddress: snapshot.company.address,
          customerLegalName: snapshot.customer.legalName,
          customerGstin: snapshot.customer.gstin ?? null,
          customerStateCode: snapshot.customerStateCode,
          customerBillingAddress: snapshot.customerBillingAddress,
          placeOfSupply: snapshot.placeOfSupply,
          isInterState: snapshot.isInterState,
          subtotal: computed.subtotal,
          discountAmount: computed.discountAmount,
          taxableAmount: computed.taxableAmount,
          cgstAmount: computed.cgstAmount,
          sgstAmount: computed.sgstAmount,
          igstAmount: computed.igstAmount,
          taxAmount: computed.taxAmount,
          roundOffAmount: computed.roundOffAmount,
          grandTotal: computed.grandTotal,
          notes: input.notes ?? null,
          termsAndConditions: input.termsAndConditions ?? null,
          idempotencyKey: input.idempotencyKey ?? null,
          createdById: user.userId,
          lines: { create: computed.preparedLines },
          statusHistory: {
            create: {
              fromStatus: null,
              toStatus: SalesInvoiceStatus.DRAFT,
              changedById: user.userId,
              reason: `Draft invoice created from ${order.orderNumber}`,
            },
          },
        },
        include: INVOICE_INCLUDE,
      });
    });

    await AuditService.log({
      userId: meta.userId,
      action: AuditAction.CREATE,
      entityType: 'SalesInvoice',
      entityId: created.id,
      newState: toPlainJson(created),
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });

    return created;
  }

  static async updateDraftInvoice(
    id: string,
    input: UpdateSalesInvoiceInput,
    user: UserContext,
    meta: AuditMeta,
  ) {
    const existing = await prisma.salesInvoice.findUnique({
      where: { id },
      include: { lines: true, salesOrder: true },
    });
    if (!existing) throw new AppError('Sales invoice not found.', 404);
    await assertWarehouseAccess(user, existing.warehouseId, 'READ_WRITE');

    if (existing.status !== 'DRAFT') {
      throw new AppError(
        `Only DRAFT invoices can be modified (current status: ${existing.status}).`,
        400,
      );
    }

    const updated = await prisma.$transaction(async tx => {
      await tx.$queryRaw`SELECT id FROM sales_orders WHERE id = ${existing.salesOrderId} FOR UPDATE`;

      let snapshotUpdate: Record<string, unknown> = {};
      let isInterState = existing.isInterState;

      if (input.billingAddressId !== undefined) {
        const snapshot = await this.resolveCompanyAndCustomerSnapshot(
          tx,
          existing.customerId,
          input.billingAddressId,
          existing.salesOrder.shippingAddressId,
          user.userId,
        );
        isInterState = snapshot.isInterState;
        snapshotUpdate = {
          billingAddressId: snapshot.billingAddressId,
          customerStateCode: snapshot.customerStateCode,
          customerBillingAddress: snapshot.customerBillingAddress,
          placeOfSupply: snapshot.placeOfSupply,
          isInterState: snapshot.isInterState,
        };
      }

      let lineUpdateData: Record<string, unknown> = {};
      if (input.lines || input.billingAddressId !== undefined) {
        // Release previous invoicedBaseQuantity before re-allocating
        for (const oldLine of existing.lines) {
          const soLine = await tx.salesOrderLine.findUniqueOrThrow({
            where: { id: oldLine.salesOrderLineId },
          });
          await tx.salesOrderLine.update({
            where: { id: soLine.id },
            data: {
              invoicedBaseQuantity: Prisma.Decimal.max(
                ZERO,
                new Prisma.Decimal(soLine.invoicedBaseQuantity).sub(oldLine.baseQuantity),
              ),
            },
          });
        }

        const effectiveLines =
          input.lines ??
          existing.lines.map(l => ({
            salesOrderLineId: l.salesOrderLineId,
            quantity: l.quantity.toString(),
          }));

        await tx.salesInvoiceLine.deleteMany({ where: { salesInvoiceId: id } });

        const computed = await this.buildInvoiceLinesAndAllocate(
          tx,
          existing.salesOrderId,
          existing.invoiceDate,
          isInterState,
          effectiveLines,
        );

        lineUpdateData = {
          subtotal: computed.subtotal,
          discountAmount: computed.discountAmount,
          taxableAmount: computed.taxableAmount,
          cgstAmount: computed.cgstAmount,
          sgstAmount: computed.sgstAmount,
          igstAmount: computed.igstAmount,
          taxAmount: computed.taxAmount,
          roundOffAmount: computed.roundOffAmount,
          grandTotal: computed.grandTotal,
          lines: { create: computed.preparedLines },
        };
      }

      return tx.salesInvoice.update({
        where: { id },
        data: {
          ...snapshotUpdate,
          ...(input.dueDate !== undefined
            ? { dueDate: input.dueDate ? new Date(input.dueDate) : null }
            : {}),
          ...(input.notes !== undefined ? { notes: input.notes } : {}),
          ...(input.termsAndConditions !== undefined
            ? { termsAndConditions: input.termsAndConditions }
            : {}),
          ...lineUpdateData,
        },
        include: INVOICE_INCLUDE,
      });
    });

    await AuditService.log({
      userId: meta.userId,
      action: AuditAction.UPDATE,
      entityType: 'SalesInvoice',
      entityId: id,
      previousState: { grandTotal: existing.grandTotal },
      newState: { grandTotal: updated.grandTotal },
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });

    return updated;
  }

  static async issueInvoice(id: string, user: UserContext, meta: AuditMeta) {
    const existing = await prisma.salesInvoice.findUnique({ where: { id } });
    if (!existing) throw new AppError('Sales invoice not found.', 404);
    await assertWarehouseAccess(user, existing.warehouseId, 'READ_WRITE');

    if (existing.status !== 'DRAFT') {
      throw new AppError(
        `Only DRAFT invoices can be issued (current status: ${existing.status}).`,
        400,
      );
    }

    const issued = await prisma.$transaction(async tx => {
      const inv = await tx.salesInvoice.update({
        where: { id },
        data: {
          status: SalesInvoiceStatus.ISSUED,
          issuedById: user.userId,
          issuedAt: new Date(),
        },
        include: INVOICE_INCLUDE,
      });

      await tx.salesInvoiceStatusHistory.create({
        data: {
          salesInvoiceId: id,
          fromStatus: SalesInvoiceStatus.DRAFT,
          toStatus: SalesInvoiceStatus.ISSUED,
          changedById: user.userId,
          reason: `Invoice ${inv.invoiceNumber} issued`,
        },
      });

      return inv;
    });

    await AuditService.log({
      userId: meta.userId,
      action: AuditAction.ISSUE,
      entityType: 'SalesInvoice',
      entityId: id,
      previousState: { status: existing.status },
      newState: { status: issued.status, invoiceNumber: issued.invoiceNumber },
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });

    return issued;
  }

  static async cancelInvoice(id: string, reason: string, user: UserContext, meta: AuditMeta) {
    const cancelled = await prisma.$transaction(async tx => {
      const existing = await tx.salesInvoice.findUnique({
        where: { id },
        include: { lines: true },
      });
      if (!existing) throw new AppError('Sales invoice not found.', 404);
      await assertWarehouseAccess(user, existing.warehouseId, 'READ_WRITE');

      if (existing.status === 'CANCELLED') {
        throw new AppError('Sales invoice is already cancelled.', 400);
      }

      await tx.$queryRaw`SELECT id FROM sales_orders WHERE id = ${existing.salesOrderId} FOR UPDATE`;

      // Release invoicedBaseQuantity on linked sales order lines without touching inventory
      for (const line of existing.lines) {
        const soLine = await tx.salesOrderLine.findUniqueOrThrow({
          where: { id: line.salesOrderLineId },
        });
        await tx.salesOrderLine.update({
          where: { id: soLine.id },
          data: {
            invoicedBaseQuantity: Prisma.Decimal.max(
              ZERO,
              new Prisma.Decimal(soLine.invoicedBaseQuantity).sub(line.baseQuantity),
            ),
          },
        });
      }

      const inv = await tx.salesInvoice.update({
        where: { id },
        data: {
          status: SalesInvoiceStatus.CANCELLED,
          cancelledById: user.userId,
          cancelledAt: new Date(),
          cancellationReason: reason,
        },
        include: INVOICE_INCLUDE,
      });

      await tx.salesInvoiceStatusHistory.create({
        data: {
          salesInvoiceId: id,
          fromStatus: existing.status,
          toStatus: SalesInvoiceStatus.CANCELLED,
          changedById: user.userId,
          reason,
        },
      });

      return { inv, previousStatus: existing.status };
    });

    await AuditService.log({
      userId: meta.userId,
      action: AuditAction.CANCEL,
      entityType: 'SalesInvoice',
      entityId: id,
      previousState: { status: cancelled.previousStatus },
      newState: { status: cancelled.inv.status, cancellationReason: reason },
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
      remarks: reason,
    });

    return cancelled.inv;
  }
}
