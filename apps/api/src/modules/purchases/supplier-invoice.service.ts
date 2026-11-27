import crypto from 'crypto';
import {
  AuditAction,
  ItcStatus,
  Prisma,
  ReceiptMatchStatus,
  SupplierInvoiceStatus,
} from '@prisma/client';
import { prisma } from '../../services/prisma.service';
import { AuditService } from '../../services/audit.service';
import { AppError } from '../../middleware/error.middleware';
import {
  AuditMeta,
  paginatedResult,
  PaginationParams,
  toPlainJson,
} from '../master-data/master-data.utils';
import { UserContext } from '../inventory/inventory.utils';
import { getIndianFinancialYear } from '../sales/sales-invoice.service';
import { buildDateRangeFilter } from '../sales/sales.utils';
import {
  CreateSupplierInvoiceInput,
  MatchReceiptsInput,
  UpdateSupplierInvoiceInput,
} from './supplier-invoice.types';

const HUNDRED = new Prisma.Decimal(100);
const TWO = new Prisma.Decimal(2);

async function generateInternalPurchaseInvoiceNumberInTx(
  tx: Prisma.TransactionClient,
  invoiceDate: Date,
): Promise<{ internalInvoiceNumber: string; financialYear: string }> {
  const prefix = 'PINV';
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
    internalInvoiceNumber: `${prefix}/${financialYear}/${String(seq).padStart(5, '0')}`,
    financialYear,
  };
}

const SUPPLIER_INVOICE_INCLUDE = {
  supplier: {
    select: { id: true, code: true, legalName: true, gstin: true },
  },
  factory: {
    select: { id: true, code: true, name: true, state: true, stateCode: true },
  },
  company: {
    select: { id: true, code: true, legalName: true, gstin: true, stateCode: true },
  },
  lines: {
    orderBy: { lineNumber: 'asc' as const },
    include: {
      inventoryItem: { select: { id: true, code: true, name: true } },
      uom: { select: { id: true, code: true, symbol: true } },
    },
  },
  receiptMatches: {
    include: {
      receipt: {
        select: {
          id: true,
          receiptNumber: true,
          receiptDate: true,
          status: true,
          warehouseId: true,
        },
      },
    },
  },
  statusHistory: {
    orderBy: { createdAt: 'asc' as const },
  },
};

async function buildSupplierInvoiceLinesInTx(
  tx: Prisma.TransactionClient,
  lines: CreateSupplierInvoiceInput['lines'],
  isInterState: boolean,
) {
  let subtotal = new Prisma.Decimal(0);
  let discountAmount = new Prisma.Decimal(0);
  let taxableValue = new Prisma.Decimal(0);
  let cgstAmount = new Prisma.Decimal(0);
  let sgstAmount = new Prisma.Decimal(0);
  let igstAmount = new Prisma.Decimal(0);
  let taxAmount = new Prisma.Decimal(0);

  const lineCreates: Prisma.SupplierInvoiceLineCreateWithoutSupplierInvoiceInput[] = [];

  for (let i = 0; i < lines.length; i++) {
    const reqLine = lines[i];
    const item = await tx.inventoryItem.findUnique({
      where: { id: reqLine.inventoryItemId },
      include: {
        rawMaterial: { include: { taxRate: true } },
        productVariant: { include: { product: { include: { taxRate: true } } } },
      },
    });
    if (!item || !item.isActive) {
      throw new AppError(`Active inventory item not found for line ${i + 1}.`, 404);
    }

    const uom = await tx.unitOfMeasure.findUnique({ where: { id: reqLine.uomId } });
    if (!uom) {
      throw new AppError(`Unit of measure not found for line ${i + 1}.`, 404);
    }

    const qty = new Prisma.Decimal(reqLine.quantity).toDecimalPlaces(4);
    const unitPrice = new Prisma.Decimal(reqLine.unitPrice).toDecimalPlaces(2);
    const discPct = new Prisma.Decimal(reqLine.discountPercent ?? '0').toDecimalPlaces(2);

    const defaultTaxRate =
      item.rawMaterial?.taxRate?.ratePercentage ??
      item.productVariant?.product?.taxRate?.ratePercentage ??
      0;
    const taxRatePct = new Prisma.Decimal(reqLine.taxRatePercent ?? defaultTaxRate).toDecimalPlaces(2);

    const lineSub = qty.mul(unitPrice).toDecimalPlaces(2);
    const lineDisc = lineSub.mul(discPct).div(HUNDRED).toDecimalPlaces(2);
    const lineTaxable = lineSub.sub(lineDisc).toDecimalPlaces(2);

    const cgstRate = isInterState ? new Prisma.Decimal(0) : taxRatePct.div(TWO).toDecimalPlaces(2);
    const sgstRate = isInterState ? new Prisma.Decimal(0) : taxRatePct.div(TWO).toDecimalPlaces(2);
    const igstRate = isInterState ? taxRatePct : new Prisma.Decimal(0);

    const lineCgst = lineTaxable.mul(cgstRate).div(HUNDRED).toDecimalPlaces(2);
    const lineSgst = lineTaxable.mul(sgstRate).div(HUNDRED).toDecimalPlaces(2);
    const lineIgst = lineTaxable.mul(igstRate).div(HUNDRED).toDecimalPlaces(2);
    const lineTax = lineCgst.add(lineSgst).add(lineIgst).toDecimalPlaces(2);
    const lineTotal = lineTaxable.add(lineTax).toDecimalPlaces(2);

    const hsn =
      reqLine.hsnCode ||
      item.rawMaterial?.hsnCode ||
      item.productVariant?.product?.hsnCode ||
      '0000';

    subtotal = subtotal.add(lineSub);
    discountAmount = discountAmount.add(lineDisc);
    taxableValue = taxableValue.add(lineTaxable);
    cgstAmount = cgstAmount.add(lineCgst);
    sgstAmount = sgstAmount.add(lineSgst);
    igstAmount = igstAmount.add(lineIgst);
    taxAmount = taxAmount.add(lineTax);

    lineCreates.push({
      lineNumber: i + 1,
      inventoryItem: { connect: { id: item.id } },
      descriptionSnapshot: reqLine.description || item.name,
      hsnCodeSnapshot: hsn,
      quantity: qty,
      uom: { connect: { id: uom.id } },
      unitPrice,
      discountPercent: discPct,
      discountAmount: lineDisc,
      taxableValue: lineTaxable,
      taxRateSnapshot: taxRatePct,
      cgstRate,
      sgstRate,
      igstRate,
      cgstAmount: lineCgst,
      sgstAmount: lineSgst,
      igstAmount: lineIgst,
      taxAmount: lineTax,
      totalAmount: lineTotal,
    });
  }

  const rawTotal = taxableValue.add(taxAmount);
  const roundedTotal = rawTotal.toDecimalPlaces(0, Prisma.Decimal.ROUND_HALF_UP);
  const roundOff = roundedTotal.sub(rawTotal).toDecimalPlaces(2);
  const grandTotal = rawTotal.add(roundOff).toDecimalPlaces(2);

  return {
    subtotal,
    discountAmount,
    taxableValue,
    cgstAmount,
    sgstAmount,
    igstAmount,
    taxAmount,
    roundOff,
    grandTotal,
    lineCreates,
  };
}

export class SupplierInvoiceService {
  static async createDraft(
    input: CreateSupplierInvoiceInput,
    user: UserContext,
    meta: AuditMeta,
  ) {
    if (input.idempotencyKey) {
      const existing = await prisma.supplierInvoice.findUnique({
        where: { idempotencyKey: input.idempotencyKey },
        include: SUPPLIER_INVOICE_INCLUDE,
      });
      if (existing) return existing;
    }

    const invoiceDate = new Date(input.invoiceDate);
    const receivedDate = input.receivedDate ? new Date(input.receivedDate) : new Date();
    const dueDate = input.dueDate ? new Date(input.dueDate) : null;

    const created = await prisma.$transaction(async tx => {
      const supplier = await tx.supplier.findUnique({
        where: { id: input.supplierId },
        include: { addresses: { where: { isDefault: true }, take: 1 } },
      });
      if (!supplier || !supplier.isActive) {
        throw new AppError('Active supplier not found.', 404);
      }

      const duplicate = await tx.supplierInvoice.findUnique({
        where: {
          supplierId_supplierInvoiceNumber: {
            supplierId: supplier.id,
            supplierInvoiceNumber: input.supplierInvoiceNumber.trim(),
          },
        },
      });
      if (duplicate) {
        throw new AppError(
          `Duplicate supplier invoice number "${input.supplierInvoiceNumber}" for supplier ${supplier.legalName}.`,
          409,
        );
      }

      const factory = await tx.factory.findUnique({
        where: { id: input.factoryId },
        include: { company: true },
      });
      if (!factory || !factory.isActive) {
        throw new AppError('Active factory not found.', 404);
      }

      const supplierStateCode =
        input.supplierStateCode ||
        supplier.addresses[0]?.stateCode ||
        factory.stateCode;
      const supplierGstin = input.supplierGstin ?? supplier.gstin ?? null;
      const isInterState = supplierStateCode !== factory.stateCode;
      const placeOfSupply = `${factory.state} (${factory.stateCode})`;

      const computed = await buildSupplierInvoiceLinesInTx(tx, input.lines, isInterState);
      const { internalInvoiceNumber, financialYear } =
        await generateInternalPurchaseInvoiceNumberInTx(tx, invoiceDate);

      return tx.supplierInvoice.create({
        data: {
          supplierInvoiceNumber: input.supplierInvoiceNumber.trim(),
          internalInvoiceNumber,
          financialYear,
          supplierId: supplier.id,
          factoryId: factory.id,
          companyId: factory.companyId,
          invoiceDate,
          receivedDate,
          dueDate,
          supplierLegalName: supplier.legalName,
          supplierGstin,
          supplierStateCode,
          placeOfSupply,
          isInterState,
          subtotal: computed.subtotal,
          discountAmount: computed.discountAmount,
          taxableValue: computed.taxableValue,
          cgstAmount: computed.cgstAmount,
          sgstAmount: computed.sgstAmount,
          igstAmount: computed.igstAmount,
          taxAmount: computed.taxAmount,
          roundOff: computed.roundOff,
          grandTotal: computed.grandTotal,
          status: SupplierInvoiceStatus.DRAFT,
          matchingStatus: ReceiptMatchStatus.UNMATCHED,
          itcStatus: (input.itcStatus as ItcStatus) ?? ItcStatus.PENDING_VERIFICATION,
          notes: input.notes ?? null,
          idempotencyKey: input.idempotencyKey ?? null,
          createdById: user.userId,
          lines: { create: computed.lineCreates },
          statusHistory: {
            create: {
              fromStatus: null,
              toStatus: SupplierInvoiceStatus.DRAFT,
              changedById: user.userId,
              reason: 'Supplier invoice draft created',
            },
          },
        },
        include: SUPPLIER_INVOICE_INCLUDE,
      });
    });

    await AuditService.log({
      userId: meta.userId,
      action: AuditAction.CREATE,
      entityType: 'SupplierInvoice',
      entityId: created.id,
      newState: toPlainJson({
        internalInvoiceNumber: created.internalInvoiceNumber,
        supplierInvoiceNumber: created.supplierInvoiceNumber,
        supplierId: created.supplierId,
        grandTotal: created.grandTotal.toString(),
      }),
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
      remarks: `Supplier invoice ${created.internalInvoiceNumber} draft created`,
    });

    return created;
  }

  static async updateDraft(
    id: string,
    input: UpdateSupplierInvoiceInput,
    _user: UserContext,
    meta: AuditMeta,
  ) {
    const updated = await prisma.$transaction(async tx => {
      const existing = await tx.supplierInvoice.findUnique({ where: { id } });
      if (!existing) throw new AppError('Supplier invoice not found.', 404);
      if (existing.status !== SupplierInvoiceStatus.DRAFT) {
        throw new AppError('Only DRAFT supplier invoices can be edited.', 400);
      }

      if (
        input.supplierInvoiceNumber &&
        input.supplierInvoiceNumber.trim() !== existing.supplierInvoiceNumber
      ) {
        const dup = await tx.supplierInvoice.findUnique({
          where: {
            supplierId_supplierInvoiceNumber: {
              supplierId: existing.supplierId,
              supplierInvoiceNumber: input.supplierInvoiceNumber.trim(),
            },
          },
        });
        if (dup) {
          throw new AppError(
            `Duplicate supplier invoice number "${input.supplierInvoiceNumber}".`,
            409,
          );
        }
      }

      let totalsData: Record<string, unknown> = {};
      if (input.lines) {
        const computed = await buildSupplierInvoiceLinesInTx(
          tx,
          input.lines,
          existing.isInterState,
        );
        await tx.supplierInvoiceLine.deleteMany({ where: { supplierInvoiceId: id } });
        totalsData = {
          subtotal: computed.subtotal,
          discountAmount: computed.discountAmount,
          taxableValue: computed.taxableValue,
          cgstAmount: computed.cgstAmount,
          sgstAmount: computed.sgstAmount,
          igstAmount: computed.igstAmount,
          taxAmount: computed.taxAmount,
          roundOff: computed.roundOff,
          grandTotal: computed.grandTotal,
          lines: { create: computed.lineCreates },
        };
      }

      return tx.supplierInvoice.update({
        where: { id },
        data: {
          ...(input.supplierInvoiceNumber
            ? { supplierInvoiceNumber: input.supplierInvoiceNumber.trim() }
            : {}),
          ...(input.invoiceDate ? { invoiceDate: new Date(input.invoiceDate) } : {}),
          ...(input.receivedDate ? { receivedDate: new Date(input.receivedDate) } : {}),
          ...(input.dueDate !== undefined
            ? { dueDate: input.dueDate ? new Date(input.dueDate) : null }
            : {}),
          ...(input.itcStatus ? { itcStatus: input.itcStatus as ItcStatus } : {}),
          ...(input.itcNotes !== undefined ? { itcNotes: input.itcNotes } : {}),
          ...(input.notes !== undefined ? { notes: input.notes } : {}),
          ...totalsData,
        },
        include: SUPPLIER_INVOICE_INCLUDE,
      });
    });

    await AuditService.log({
      userId: meta.userId,
      action: AuditAction.UPDATE,
      entityType: 'SupplierInvoice',
      entityId: id,
      newState: toPlainJson({
        internalInvoiceNumber: updated.internalInvoiceNumber,
        grandTotal: updated.grandTotal.toString(),
        itcStatus: updated.itcStatus,
      }),
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
      remarks: `Updated draft supplier invoice ${updated.internalInvoiceNumber}`,
    });

    return updated;
  }

  static async postInvoice(id: string, user: UserContext, meta: AuditMeta) {
    const posted = await prisma.$transaction(async tx => {
      await tx.$queryRaw`SELECT id FROM supplier_invoices WHERE id = ${id} FOR UPDATE`;
      const existing = await tx.supplierInvoice.findUnique({ where: { id } });
      if (!existing) throw new AppError('Supplier invoice not found.', 404);
      if (existing.status !== SupplierInvoiceStatus.DRAFT) {
        throw new AppError(
          `Only DRAFT supplier invoices can be posted (current status: ${existing.status}).`,
          400,
        );
      }

      const updated = await tx.supplierInvoice.update({
        where: { id },
        data: {
          status: SupplierInvoiceStatus.POSTED,
          postedById: user.userId,
          postedAt: new Date(),
        },
        include: SUPPLIER_INVOICE_INCLUDE,
      });

      await tx.supplierInvoiceStatusHistory.create({
        data: {
          supplierInvoiceId: id,
          fromStatus: SupplierInvoiceStatus.DRAFT,
          toStatus: SupplierInvoiceStatus.POSTED,
          changedById: user.userId,
          reason: `Posted supplier invoice ${updated.internalInvoiceNumber}`,
        },
      });

      return updated;
    });

    await AuditService.log({
      userId: meta.userId,
      action: AuditAction.POST,
      entityType: 'SupplierInvoice',
      entityId: id,
      previousState: { status: SupplierInvoiceStatus.DRAFT },
      newState: {
        status: SupplierInvoiceStatus.POSTED,
        internalInvoiceNumber: posted.internalInvoiceNumber,
      },
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
      remarks: `Posted supplier invoice ${posted.internalInvoiceNumber}`,
    });

    return posted;
  }

  static async cancelInvoice(
    id: string,
    reason: string,
    user: UserContext,
    meta: AuditMeta,
  ) {
    const cancelled = await prisma.$transaction(async tx => {
      await tx.$queryRaw`SELECT id FROM supplier_invoices WHERE id = ${id} FOR UPDATE`;
      const existing = await tx.supplierInvoice.findUnique({ where: { id } });
      if (!existing) throw new AppError('Supplier invoice not found.', 404);
      if (existing.status === SupplierInvoiceStatus.CANCELLED) {
        throw new AppError('Supplier invoice is already cancelled.', 400);
      }

      const updated = await tx.supplierInvoice.update({
        where: { id },
        data: {
          status: SupplierInvoiceStatus.CANCELLED,
          cancelledById: user.userId,
          cancelledAt: new Date(),
          cancellationReason: reason,
        },
        include: SUPPLIER_INVOICE_INCLUDE,
      });

      await tx.supplierInvoiceStatusHistory.create({
        data: {
          supplierInvoiceId: id,
          fromStatus: existing.status,
          toStatus: SupplierInvoiceStatus.CANCELLED,
          changedById: user.userId,
          reason,
        },
      });

      return { updated, previousStatus: existing.status };
    });

    await AuditService.log({
      userId: meta.userId,
      action: AuditAction.CANCEL,
      entityType: 'SupplierInvoice',
      entityId: id,
      previousState: { status: cancelled.previousStatus },
      newState: { status: SupplierInvoiceStatus.CANCELLED, cancellationReason: reason },
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
      remarks: reason,
    });

    return cancelled.updated;
  }

  static async updateItcStatus(
    id: string,
    itcStatus: ItcStatus,
    itcNotes: string | undefined,
    meta: AuditMeta,
  ) {
    const existing = await prisma.supplierInvoice.findUnique({ where: { id } });
    if (!existing) throw new AppError('Supplier invoice not found.', 404);
    if (existing.status === SupplierInvoiceStatus.CANCELLED) {
      throw new AppError('Cannot update ITC classification on a cancelled invoice.', 400);
    }

    const updated = await prisma.supplierInvoice.update({
      where: { id },
      data: {
        itcStatus,
        ...(itcNotes !== undefined ? { itcNotes } : {}),
      },
      include: SUPPLIER_INVOICE_INCLUDE,
    });

    await AuditService.log({
      userId: meta.userId,
      action: AuditAction.UPDATE,
      entityType: 'SupplierInvoice',
      entityId: id,
      previousState: { itcStatus: existing.itcStatus },
      newState: { itcStatus, itcNotes: itcNotes ?? null },
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
      remarks: `Updated ITC status to ${itcStatus}`,
    });

    return updated;
  }

  /**
   * Matches a SupplierInvoice against one or more POSTED InventoryReceipts.
   * Never modifies InventoryBalance or InventoryReceiptLine historical costs.
   */
  static async matchToReceipts(
    id: string,
    input: MatchReceiptsInput,
    user: UserContext,
    meta: AuditMeta,
  ) {
    const updated = await prisma.$transaction(async tx => {
      const invoice = await tx.supplierInvoice.findUnique({
        where: { id },
        include: { lines: true },
      });
      if (!invoice) throw new AppError('Supplier invoice not found.', 404);
      if (invoice.status === SupplierInvoiceStatus.CANCELLED) {
        throw new AppError('Cannot match a cancelled supplier invoice.', 400);
      }

      const receipts = await tx.inventoryReceipt.findMany({
        where: { id: { in: input.receiptIds } },
        include: { lines: true },
      });
      if (receipts.length !== input.receiptIds.length) {
        throw new AppError('One or more inventory receipts were not found.', 404);
      }

      for (const r of receipts) {
        if (r.status !== 'POSTED') {
          throw new AppError(
            `Inventory receipt ${r.receiptNumber} must be POSTED before matching (current: ${r.status}).`,
            400,
          );
        }
      }

      // Aggregate receipt quantities and costs by inventoryItemId
      const receiptByItem = new Map<
        string,
        { qty: Prisma.Decimal; uomIds: Set<string>; unitCosts: Prisma.Decimal[] }
      >();
      for (const r of receipts) {
        for (const rl of r.lines) {
          const entry = receiptByItem.get(rl.inventoryItemId) ?? {
            qty: new Prisma.Decimal(0),
            uomIds: new Set<string>(),
            unitCosts: [],
          };
          entry.qty = entry.qty.add(new Prisma.Decimal(rl.quantity));
          entry.uomIds.add(rl.uomId);
          entry.unitCosts.push(new Prisma.Decimal(rl.unitCost));
          receiptByItem.set(rl.inventoryItemId, entry);
        }
      }

      const discrepancies: Array<{
        type: 'QUANTITY_MISMATCH' | 'UOM_MISMATCH' | 'RATE_MISMATCH' | 'UNMATCHED_ITEM';
        inventoryItemId: string;
        description: string;
      }> = [];

      let allLinesMatched = true;
      let anyLineMatched = false;

      for (const invLine of invoice.lines) {
        const rec = receiptByItem.get(invLine.inventoryItemId);
        if (!rec) {
          allLinesMatched = false;
          discrepancies.push({
            type: 'UNMATCHED_ITEM',
            inventoryItemId: invLine.inventoryItemId,
            description: `${invLine.descriptionSnapshot}: not present in selected receipt(s).`,
          });
          continue;
        }
        anyLineMatched = true;

        if (!rec.uomIds.has(invLine.uomId)) {
          allLinesMatched = false;
          discrepancies.push({
            type: 'UOM_MISMATCH',
            inventoryItemId: invLine.inventoryItemId,
            description: `${invLine.descriptionSnapshot}: UOM differs between invoice and receipt.`,
          });
        }

        const invQty = new Prisma.Decimal(invLine.quantity);
        if (!invQty.eq(rec.qty)) {
          allLinesMatched = false;
          discrepancies.push({
            type: 'QUANTITY_MISMATCH',
            inventoryItemId: invLine.inventoryItemId,
            description: `${invLine.descriptionSnapshot}: invoiced ${invQty.toString()} vs received ${rec.qty.toString()}.`,
          });
        }

        const invPrice = new Prisma.Decimal(invLine.unitPrice);
        const rateMismatch = rec.unitCosts.some(c => c.sub(invPrice).abs().gt(new Prisma.Decimal('0.01')));
        if (rateMismatch) {
          allLinesMatched = false;
          discrepancies.push({
            type: 'RATE_MISMATCH',
            inventoryItemId: invLine.inventoryItemId,
            description: `${invLine.descriptionSnapshot}: invoice unit price ${invPrice.toFixed(2)} differs from receipt cost.`,
          });
        }
      }

      let matchStatus: ReceiptMatchStatus = ReceiptMatchStatus.UNMATCHED;
      if (discrepancies.length > 0) {
        matchStatus = anyLineMatched
          ? ReceiptMatchStatus.MISMATCH
          : ReceiptMatchStatus.UNMATCHED;
      } else if (allLinesMatched && invoice.lines.length > 0) {
        matchStatus = ReceiptMatchStatus.MATCHED;
      }

      for (const r of receipts) {
        await tx.supplierInvoiceReceiptMatch.upsert({
          where: {
            supplierInvoiceId_receiptId: {
              supplierInvoiceId: invoice.id,
              receiptId: r.id,
            },
          },
          create: {
            supplierInvoiceId: invoice.id,
            receiptId: r.id,
            matchStatus,
            discrepancies: toPlainJson(discrepancies) as Prisma.InputJsonValue,
            matchedById: user.userId,
            notes: input.notes ?? null,
          },
          update: {
            matchStatus,
            discrepancies: toPlainJson(discrepancies) as Prisma.InputJsonValue,
            matchedById: user.userId,
            matchedAt: new Date(),
            notes: input.notes ?? null,
          },
        });
      }

      return tx.supplierInvoice.update({
        where: { id: invoice.id },
        data: { matchingStatus: matchStatus },
        include: SUPPLIER_INVOICE_INCLUDE,
      });
    });

    await AuditService.log({
      userId: meta.userId,
      action: AuditAction.UPDATE,
      entityType: 'SupplierInvoice',
      entityId: id,
      newState: toPlainJson({
        matchingStatus: updated.matchingStatus,
        receiptIds: input.receiptIds,
      }),
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
      remarks: `Matched supplier invoice ${updated.internalInvoiceNumber} (${updated.matchingStatus})`,
    });

    return updated;
  }

  static async listInvoices(
    params: PaginationParams,
    filters: {
      supplierId?: string;
      factoryId?: string;
      status?: string;
      matchingStatus?: string;
      itcStatus?: string;
      gstin?: string;
      fromDate?: string;
      toDate?: string;
    },
  ) {
    const where: Prisma.SupplierInvoiceWhereInput = {};
    if (filters.supplierId) where.supplierId = filters.supplierId;
    if (filters.factoryId) where.factoryId = filters.factoryId;
    if (filters.status) where.status = filters.status as SupplierInvoiceStatus;
    if (filters.matchingStatus) where.matchingStatus = filters.matchingStatus as ReceiptMatchStatus;
    if (filters.itcStatus) where.itcStatus = filters.itcStatus as ItcStatus;
    if (filters.gstin) where.supplierGstin = { contains: filters.gstin, mode: 'insensitive' };
    const dateFilter = buildDateRangeFilter(filters.fromDate, filters.toDate);
    if (dateFilter) where.invoiceDate = dateFilter;

    if (params.search) {
      where.OR = [
        { supplierInvoiceNumber: { contains: params.search, mode: 'insensitive' } },
        { internalInvoiceNumber: { contains: params.search, mode: 'insensitive' } },
        { supplierLegalName: { contains: params.search, mode: 'insensitive' } },
      ];
    }

    const [items, total] = await Promise.all([
      prisma.supplierInvoice.findMany({
        where,
        skip: params.skip,
        take: params.take,
        orderBy: { invoiceDate: 'desc' },
        include: SUPPLIER_INVOICE_INCLUDE,
      }),
      prisma.supplierInvoice.count({ where }),
    ]);

    return paginatedResult(items, total, params.page, params.limit);
  }

  static async getById(id: string) {
    const inv = await prisma.supplierInvoice.findUnique({
      where: { id },
      include: SUPPLIER_INVOICE_INCLUDE,
    });
    if (!inv) throw new AppError('Supplier invoice not found.', 404);
    return inv;
  }

  static async getUnmatchedReceipts() {
    const receipts = await prisma.inventoryReceipt.findMany({
      where: {
        status: 'POSTED',
        supplierInvoiceMatches: {
          none: {
            supplierInvoice: {
              status: { not: SupplierInvoiceStatus.CANCELLED },
            },
          },
        },
      },
      orderBy: { receiptDate: 'desc' },
      include: {
        warehouse: { select: { id: true, code: true, name: true } },
        lines: {
          include: {
            inventoryItem: { select: { id: true, code: true, name: true } },
            uom: { select: { id: true, code: true, symbol: true } },
          },
        },
      },
      take: 100,
    });

    return receipts;
  }

  static async getPurchaseRegister(filters: {
    supplierId?: string;
    factoryId?: string;
    status?: string;
    matchingStatus?: string;
    itcStatus?: string;
    gstin?: string;
    fromDate?: string;
    toDate?: string;
  }) {
    const where: Prisma.SupplierInvoiceWhereInput = {
      status: (filters.status as SupplierInvoiceStatus) || SupplierInvoiceStatus.POSTED,
    };
    if (filters.supplierId) where.supplierId = filters.supplierId;
    if (filters.factoryId) where.factoryId = filters.factoryId;
    if (filters.matchingStatus) where.matchingStatus = filters.matchingStatus as ReceiptMatchStatus;
    if (filters.itcStatus) where.itcStatus = filters.itcStatus as ItcStatus;
    if (filters.gstin) where.supplierGstin = { contains: filters.gstin, mode: 'insensitive' };
    const dateFilter = buildDateRangeFilter(filters.fromDate, filters.toDate);
    if (dateFilter) where.invoiceDate = dateFilter;

    const invoices = await prisma.supplierInvoice.findMany({
      where,
      orderBy: { invoiceDate: 'desc' },
      include: SUPPLIER_INVOICE_INCLUDE,
    });

    const rows = invoices.flatMap(inv =>
      inv.lines.map(line => ({
        supplierInvoiceId: inv.id,
        supplierName: inv.supplierLegalName,
        supplierGstin: inv.supplierGstin ?? '',
        supplierInvoiceNumber: inv.supplierInvoiceNumber,
        internalInvoiceNumber: inv.internalInvoiceNumber,
        invoiceDate: inv.invoiceDate,
        factoryName: inv.factory.name,
        hsnCode: line.hsnCodeSnapshot,
        itemDescription: line.descriptionSnapshot,
        quantity: line.quantity.toString(),
        uomSymbol: line.uom.symbol,
        taxableValue: line.taxableValue.toFixed(2),
        cgstAmount: line.cgstAmount.toFixed(2),
        sgstAmount: line.sgstAmount.toFixed(2),
        igstAmount: line.igstAmount.toFixed(2),
        totalInvoiceValue: inv.grandTotal.toFixed(2),
        lineTotal: line.totalAmount.toFixed(2),
        matchingStatus: inv.matchingStatus,
        itcStatus: inv.itcStatus,
        status: inv.status,
      })),
    );

    const totals = invoices.reduce(
      (acc, inv) => ({
        taxableValue: acc.taxableValue.add(new Prisma.Decimal(inv.taxableValue)),
        cgstAmount: acc.cgstAmount.add(new Prisma.Decimal(inv.cgstAmount)),
        sgstAmount: acc.sgstAmount.add(new Prisma.Decimal(inv.sgstAmount)),
        igstAmount: acc.igstAmount.add(new Prisma.Decimal(inv.igstAmount)),
        taxAmount: acc.taxAmount.add(new Prisma.Decimal(inv.taxAmount)),
        grandTotal: acc.grandTotal.add(new Prisma.Decimal(inv.grandTotal)),
      }),
      {
        taxableValue: new Prisma.Decimal(0),
        cgstAmount: new Prisma.Decimal(0),
        sgstAmount: new Prisma.Decimal(0),
        igstAmount: new Prisma.Decimal(0),
        taxAmount: new Prisma.Decimal(0),
        grandTotal: new Prisma.Decimal(0),
      },
    );

    return {
      invoiceCount: invoices.length,
      totals: {
        taxableValue: totals.taxableValue.toFixed(2),
        cgstAmount: totals.cgstAmount.toFixed(2),
        sgstAmount: totals.sgstAmount.toFixed(2),
        igstAmount: totals.igstAmount.toFixed(2),
        taxAmount: totals.taxAmount.toFixed(2),
        grandTotal: totals.grandTotal.toFixed(2),
      },
      rows,
      invoices,
    };
  }
}
