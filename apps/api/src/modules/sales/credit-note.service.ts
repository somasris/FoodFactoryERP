import crypto from 'crypto';
import { AuditAction, CreditNoteStatus, Prisma } from '@prisma/client';
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
  getAuthorizedWarehouseIds,
  UserContext,
  ZERO,
} from '../inventory/inventory.utils';
import { getIndianFinancialYear } from './sales-invoice.service';
import { buildDateRangeFilter } from './sales.utils';
import { CreateCreditNoteInput } from './credit-note.types';
import { recomputeInvoicePaymentStatusInTx } from './customer-payment.service';

const HUNDRED = new Prisma.Decimal(100);

async function generateCreditNoteNumberInTx(
  tx: Prisma.TransactionClient,
  creditNoteDate: Date,
): Promise<{ creditNoteNumber: string; financialYear: string }> {
  const prefix = 'CN';
  const financialYear = getIndianFinancialYear(creditNoteDate);
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
    creditNoteNumber: `${prefix}/${financialYear}/${String(seq).padStart(5, '0')}`,
    financialYear,
  };
}

const CREDIT_NOTE_INCLUDE = {
  salesInvoice: {
    select: {
      id: true,
      invoiceNumber: true,
      invoiceDate: true,
      grandTotal: true,
      status: true,
      paymentStatus: true,
    },
  },
  customer: {
    select: { id: true, code: true, legalName: true, gstin: true },
  },
  warehouse: { select: { id: true, code: true, name: true } },
  company: { select: { id: true, code: true, legalName: true, gstin: true, stateCode: true } },
  lines: {
    orderBy: { lineNumber: 'asc' as const },
    include: {
      originalInvoiceLine: {
        select: { id: true, lineNumber: true, quantity: true, unitPrice: true },
      },
    },
  },
  statusHistory: {
    orderBy: { createdAt: 'asc' as const },
  },
};

export class CreditNoteService {
  static async createDraft(
    input: CreateCreditNoteInput,
    user: UserContext,
    meta: AuditMeta,
  ) {
    if (input.idempotencyKey) {
      const existing = await prisma.creditNote.findUnique({
        where: { idempotencyKey: input.idempotencyKey },
        include: CREDIT_NOTE_INCLUDE,
      });
      if (existing) return existing;
    }

    const creditNoteDate = input.creditNoteDate ? new Date(input.creditNoteDate) : new Date();

    const created = await prisma.$transaction(async tx => {
      await tx.$queryRaw`SELECT id FROM sales_invoices WHERE id = ${input.salesInvoiceId} FOR UPDATE`;

      const invoice = await tx.salesInvoice.findUnique({
        where: { id: input.salesInvoiceId },
        include: {
          lines: true,
          creditNotes: {
            where: { status: { in: [CreditNoteStatus.DRAFT, CreditNoteStatus.ISSUED] } },
            include: { lines: true },
          },
        },
      });
      if (!invoice) throw new AppError('Sales invoice not found.', 404);
      await assertWarehouseAccess(user, invoice.warehouseId, 'READ_WRITE');

      if (invoice.status !== 'ISSUED') {
        throw new AppError(
          `Credit notes can only be created for ISSUED invoices (current status: ${invoice.status}).`,
          400,
        );
      }

      const invoiceLineMap = new Map(invoice.lines.map(l => [l.id, l]));
      const creditedQtyByLine = new Map<string, Prisma.Decimal>();
      let existingCreditedValue = new Prisma.Decimal(0);

      for (const cn of invoice.creditNotes) {
        existingCreditedValue = existingCreditedValue.add(new Prisma.Decimal(cn.grandTotal));
        for (const cl of cn.lines) {
          creditedQtyByLine.set(
            cl.originalInvoiceLineId,
            (creditedQtyByLine.get(cl.originalInvoiceLineId) ?? new Prisma.Decimal(0)).add(
              new Prisma.Decimal(cl.quantity),
            ),
          );
        }
      }

      let subtotal = new Prisma.Decimal(0);
      let discountAmount = new Prisma.Decimal(0);
      let taxableValue = new Prisma.Decimal(0);
      let cgstAmount = new Prisma.Decimal(0);
      let sgstAmount = new Prisma.Decimal(0);
      let igstAmount = new Prisma.Decimal(0);
      let taxAmount = new Prisma.Decimal(0);

      const lineCreates: Prisma.CreditNoteLineCreateWithoutCreditNoteInput[] = [];
      const seenLineIds = new Set<string>();

      for (let i = 0; i < input.lines.length; i++) {
        const reqLine = input.lines[i];
        if (seenLineIds.has(reqLine.originalInvoiceLineId)) {
          throw new AppError('Duplicate invoice line in credit note request.', 400);
        }
        seenLineIds.add(reqLine.originalInvoiceLineId);

        const origLine = invoiceLineMap.get(reqLine.originalInvoiceLineId);
        if (!origLine) {
          throw new AppError(
            `Invoice line ${reqLine.originalInvoiceLineId} does not belong to invoice ${invoice.invoiceNumber}.`,
            400,
          );
        }

        const qty = new Prisma.Decimal(reqLine.quantity).toDecimalPlaces(4);
        if (qty.lte(ZERO)) {
          throw new AppError('Credit note line quantity must be greater than zero.', 400);
        }

        const alreadyCreditedQty = creditedQtyByLine.get(origLine.id) ?? new Prisma.Decimal(0);
        const remainingQty = new Prisma.Decimal(origLine.quantity).sub(alreadyCreditedQty);
        if (qty.gt(remainingQty)) {
          throw new AppError(
            `Credit quantity (${qty.toString()}) exceeds remaining creditable quantity (${remainingQty.toString()}) for ${origLine.itemName}.`,
            400,
          );
        }

        const unitPrice = new Prisma.Decimal(origLine.unitPrice);
        const lineSub = qty.mul(unitPrice).toDecimalPlaces(2);
        const discPct = new Prisma.Decimal(origLine.discountPercent);
        const lineDisc = lineSub.mul(discPct).div(HUNDRED).toDecimalPlaces(2);
        const lineTaxable = lineSub.sub(lineDisc).toDecimalPlaces(2);

        const cgstRate = new Prisma.Decimal(origLine.cgstRate);
        const sgstRate = new Prisma.Decimal(origLine.sgstRate);
        const igstRate = new Prisma.Decimal(origLine.igstRate);
        const lineCgst = lineTaxable.mul(cgstRate).div(HUNDRED).toDecimalPlaces(2);
        const lineSgst = lineTaxable.mul(sgstRate).div(HUNDRED).toDecimalPlaces(2);
        const lineIgst = lineTaxable.mul(igstRate).div(HUNDRED).toDecimalPlaces(2);
        const lineTax = lineCgst.add(lineSgst).add(lineIgst).toDecimalPlaces(2);
        const lineTotal = lineTaxable.add(lineTax).toDecimalPlaces(2);

        subtotal = subtotal.add(lineSub);
        discountAmount = discountAmount.add(lineDisc);
        taxableValue = taxableValue.add(lineTaxable);
        cgstAmount = cgstAmount.add(lineCgst);
        sgstAmount = sgstAmount.add(lineSgst);
        igstAmount = igstAmount.add(lineIgst);
        taxAmount = taxAmount.add(lineTax);

        lineCreates.push({
          originalInvoiceLine: { connect: { id: origLine.id } },
          lineNumber: i + 1,
          productVariantId: origLine.productVariantId,
          itemCodeSnapshot: origLine.itemCode,
          descriptionSnapshot: origLine.itemName,
          hsnCodeSnapshot: origLine.hsnCode,
          uomSymbolSnapshot: origLine.uomSymbol,
          quantity: qty,
          unitPrice,
          discountPercent: discPct,
          discountAmount: lineDisc,
          taxableValue: lineTaxable,
          taxRateSnapshot: new Prisma.Decimal(origLine.gstRate),
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

      const remainingCreditableValue = new Prisma.Decimal(invoice.grandTotal).sub(
        existingCreditedValue,
      );
      if (grandTotal.gt(remainingCreditableValue)) {
        throw new AppError(
          `Credit note total (${grandTotal.toFixed(2)}) exceeds remaining creditable invoice value (${remainingCreditableValue.toFixed(2)}).`,
          400,
        );
      }

      const { creditNoteNumber, financialYear } = await generateCreditNoteNumberInTx(
        tx,
        creditNoteDate,
      );

      const cn = await tx.creditNote.create({
        data: {
          creditNoteNumber,
          financialYear,
          salesInvoiceId: invoice.id,
          customerId: invoice.customerId,
          warehouseId: invoice.warehouseId,
          companyId: invoice.companyId,
          creditNoteDate,
          reason: input.reason,
          companyLegalName: invoice.companyLegalName,
          companyGstin: invoice.companyGstin,
          companyStateCode: invoice.companyStateCode,
          companyAddress: invoice.companyAddress,
          customerLegalName: invoice.customerLegalName,
          customerGstin: invoice.customerGstin,
          customerStateCode: invoice.customerStateCode,
          customerBillingAddress: invoice.customerBillingAddress,
          placeOfSupply: invoice.placeOfSupply,
          isInterState: invoice.isInterState,
          subtotal,
          discountAmount,
          taxableValue,
          cgstAmount,
          sgstAmount,
          igstAmount,
          taxAmount,
          roundOff,
          grandTotal,
          status: CreditNoteStatus.DRAFT,
          idempotencyKey: input.idempotencyKey ?? null,
          createdById: user.userId,
          lines: { create: lineCreates },
          statusHistory: {
            create: {
              fromStatus: null,
              toStatus: CreditNoteStatus.DRAFT,
              changedById: user.userId,
              reason: input.reason,
            },
          },
        },
        include: CREDIT_NOTE_INCLUDE,
      });

      return cn;
    });

    await AuditService.log({
      userId: meta.userId,
      action: AuditAction.CREATE,
      entityType: 'CreditNote',
      entityId: created.id,
      newState: toPlainJson({
        creditNoteNumber: created.creditNoteNumber,
        salesInvoiceId: created.salesInvoiceId,
        grandTotal: created.grandTotal.toString(),
        status: created.status,
      }),
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
      remarks: `Credit note draft ${created.creditNoteNumber} created`,
    });

    return created;
  }

  static async issueCreditNote(id: string, user: UserContext, meta: AuditMeta) {
    const issued = await prisma.$transaction(async tx => {
      await tx.$queryRaw`SELECT id FROM credit_notes WHERE id = ${id} FOR UPDATE`;

      const existing = await tx.creditNote.findUnique({
        where: { id },
        include: { lines: true },
      });
      if (!existing) throw new AppError('Credit note not found.', 404);
      await assertWarehouseAccess(user, existing.warehouseId, 'READ_WRITE');

      if (existing.status !== CreditNoteStatus.DRAFT) {
        throw new AppError(
          `Only DRAFT credit notes can be issued (current status: ${existing.status}).`,
          400,
        );
      }

      await tx.$queryRaw`SELECT id FROM sales_invoices WHERE id = ${existing.salesInvoiceId} FOR UPDATE`;
      const invoice = await tx.salesInvoice.findUniqueOrThrow({
        where: { id: existing.salesInvoiceId },
        include: {
          creditNotes: {
            where: { status: CreditNoteStatus.ISSUED },
            include: { lines: true },
          },
        },
      });

      if (invoice.status !== 'ISSUED') {
        throw new AppError('Parent sales invoice is not in ISSUED state.', 400);
      }

      const issuedTotal = invoice.creditNotes.reduce(
        (sum, c) => sum.add(new Prisma.Decimal(c.grandTotal)),
        new Prisma.Decimal(0),
      );
      if (
        issuedTotal.add(new Prisma.Decimal(existing.grandTotal)).gt(
          new Prisma.Decimal(invoice.grandTotal),
        )
      ) {
        throw new AppError('Issuing this credit note would exceed the invoice grand total.', 400);
      }

      const updated = await tx.creditNote.update({
        where: { id },
        data: {
          status: CreditNoteStatus.ISSUED,
          issuedById: user.userId,
          issuedAt: new Date(),
        },
        include: CREDIT_NOTE_INCLUDE,
      });

      await tx.creditNoteStatusHistory.create({
        data: {
          creditNoteId: id,
          fromStatus: CreditNoteStatus.DRAFT,
          toStatus: CreditNoteStatus.ISSUED,
          changedById: user.userId,
          reason: `Credit note ${updated.creditNoteNumber} issued`,
        },
      });

      await recomputeInvoicePaymentStatusInTx(tx, existing.salesInvoiceId);

      return updated;
    });

    await AuditService.log({
      userId: meta.userId,
      action: AuditAction.POST,
      entityType: 'CreditNote',
      entityId: id,
      previousState: { status: CreditNoteStatus.DRAFT },
      newState: {
        status: CreditNoteStatus.ISSUED,
        creditNoteNumber: issued.creditNoteNumber,
        grandTotal: issued.grandTotal.toString(),
      },
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
      remarks: `Credit note ${issued.creditNoteNumber} issued`,
    });

    return issued;
  }

  static async cancelCreditNote(
    id: string,
    reason: string,
    user: UserContext,
    meta: AuditMeta,
  ) {
    const cancelled = await prisma.$transaction(async tx => {
      await tx.$queryRaw`SELECT id FROM credit_notes WHERE id = ${id} FOR UPDATE`;
      const existing = await tx.creditNote.findUnique({ where: { id } });
      if (!existing) throw new AppError('Credit note not found.', 404);
      await assertWarehouseAccess(user, existing.warehouseId, 'READ_WRITE');

      if (existing.status === CreditNoteStatus.CANCELLED) {
        throw new AppError('Credit note is already cancelled.', 400);
      }

      await tx.$queryRaw`SELECT id FROM sales_invoices WHERE id = ${existing.salesInvoiceId} FOR UPDATE`;

      const updated = await tx.creditNote.update({
        where: { id },
        data: {
          status: CreditNoteStatus.CANCELLED,
          cancelledById: user.userId,
          cancelledAt: new Date(),
          cancellationReason: reason,
        },
        include: CREDIT_NOTE_INCLUDE,
      });

      await tx.creditNoteStatusHistory.create({
        data: {
          creditNoteId: id,
          fromStatus: existing.status,
          toStatus: CreditNoteStatus.CANCELLED,
          changedById: user.userId,
          reason,
        },
      });

      if (existing.status === CreditNoteStatus.ISSUED) {
        await recomputeInvoicePaymentStatusInTx(tx, existing.salesInvoiceId);
      }

      return { updated, previousStatus: existing.status };
    });

    await AuditService.log({
      userId: meta.userId,
      action: AuditAction.CANCEL,
      entityType: 'CreditNote',
      entityId: id,
      previousState: { status: cancelled.previousStatus },
      newState: { status: CreditNoteStatus.CANCELLED, cancellationReason: reason },
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
      remarks: reason,
    });

    return cancelled.updated;
  }

  static async listCreditNotes(
    params: PaginationParams,
    user: UserContext,
    filters: {
      status?: string;
      customerId?: string;
      salesInvoiceId?: string;
      fromDate?: string;
      toDate?: string;
    },
  ) {
    const allowedWh = await getAuthorizedWarehouseIds(user, 'READ');
    const where: Prisma.CreditNoteWhereInput = {};
    if (allowedWh) where.warehouseId = { in: allowedWh };
    if (filters.status) where.status = filters.status as CreditNoteStatus;
    if (filters.customerId) where.customerId = filters.customerId;
    if (filters.salesInvoiceId) where.salesInvoiceId = filters.salesInvoiceId;
    const dateFilter = buildDateRangeFilter(filters.fromDate, filters.toDate);
    if (dateFilter) where.creditNoteDate = dateFilter;
    if (params.search) {
      where.OR = [
        { creditNoteNumber: { contains: params.search, mode: 'insensitive' } },
        { customerLegalName: { contains: params.search, mode: 'insensitive' } },
        { salesInvoice: { invoiceNumber: { contains: params.search, mode: 'insensitive' } } },
      ];
    }

    const [items, total] = await Promise.all([
      prisma.creditNote.findMany({
        where,
        skip: params.skip,
        take: params.take,
        orderBy: { creditNoteDate: 'desc' },
        include: CREDIT_NOTE_INCLUDE,
      }),
      prisma.creditNote.count({ where }),
    ]);

    return paginatedResult(items, total, params.page, params.limit);
  }

  static async getCreditNoteById(id: string, user: UserContext) {
    const cn = await prisma.creditNote.findUnique({
      where: { id },
      include: CREDIT_NOTE_INCLUDE,
    });
    if (!cn) throw new AppError('Credit note not found.', 404);
    await assertWarehouseAccess(user, cn.warehouseId, 'READ');
    return cn;
  }

  static async listInvoiceCreditNotes(salesInvoiceId: string, user: UserContext) {
    const invoice = await prisma.salesInvoice.findUnique({
      where: { id: salesInvoiceId },
      select: { id: true, warehouseId: true },
    });
    if (!invoice) throw new AppError('Sales invoice not found.', 404);
    await assertWarehouseAccess(user, invoice.warehouseId, 'READ');

    return prisma.creditNote.findMany({
      where: { salesInvoiceId },
      orderBy: { creditNoteDate: 'desc' },
      include: CREDIT_NOTE_INCLUDE,
    });
  }

  static async getCustomerCreditBalance(customerId: string) {
    const customer = await prisma.customer.findUnique({
      where: { id: customerId },
      select: { id: true, code: true, legalName: true },
    });
    if (!customer) throw new AppError('Customer not found.', 404);

    const [payments, invoices] = await Promise.all([
      prisma.customerPayment.findMany({
        where: { customerId, status: 'RECORDED' },
        include: { allocations: { where: { isReversed: false } } },
      }),
      prisma.salesInvoice.findMany({
        where: { customerId, status: 'ISSUED' },
        include: {
          paymentAllocations: { where: { isReversed: false } },
          creditNotes: { where: { status: 'ISSUED' } },
        },
      }),
    ]);

    let unallocatedPayments = new Prisma.Decimal(0);
    for (const p of payments) {
      const alloc = p.allocations.reduce(
        (s, a) => s.add(new Prisma.Decimal(a.allocatedAmount)),
        new Prisma.Decimal(0),
      );
      unallocatedPayments = unallocatedPayments.add(
        Prisma.Decimal.max(ZERO, new Prisma.Decimal(p.amount).sub(alloc)),
      );
    }

    let invoiceExcessCredits = new Prisma.Decimal(0);
    for (const inv of invoices) {
      const paid = inv.paymentAllocations.reduce(
        (s, a) => s.add(new Prisma.Decimal(a.allocatedAmount)),
        new Prisma.Decimal(0),
      );
      const cnTotal = inv.creditNotes.reduce(
        (s, c) => s.add(new Prisma.Decimal(c.grandTotal)),
        new Prisma.Decimal(0),
      );
      const diff = paid.add(cnTotal).sub(new Prisma.Decimal(inv.grandTotal));
      if (diff.gt(ZERO)) {
        invoiceExcessCredits = invoiceExcessCredits.add(diff);
      }
    }

    const totalCustomerCreditBalance = unallocatedPayments.add(invoiceExcessCredits);
    return {
      customer,
      unallocatedPayments: unallocatedPayments.toFixed(2),
      invoiceExcessCredits: invoiceExcessCredits.toFixed(2),
      totalCustomerCreditBalance: totalCustomerCreditBalance.toFixed(2),
      refundPolicy:
        'Excess credit balances are tracked separately as a customer credit/refund liability; refunds require a separate recorded refund transaction.',
    };
  }
}
