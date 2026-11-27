import crypto from 'crypto';
import {
  AuditAction,
  CustomerPaymentStatus,
  InvoicePaymentStatus,
  PaymentMode,
  Prisma,
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
import {
  assertWarehouseAccess,
  getAuthorizedWarehouseIds,
  UserContext,
  ZERO,
} from '../inventory/inventory.utils';
import { getIndianFinancialYear } from './sales-invoice.service';
import { buildDateRangeFilter } from './sales.utils';
import {
  AllocatePaymentInput,
  CreateCustomerPaymentInput,
} from './customer-payment.types';

async function generatePaymentNumberInTx(
  tx: Prisma.TransactionClient,
  paymentDate: Date,
): Promise<{ paymentNumber: string; financialYear: string }> {
  const prefix = 'PAY';
  const financialYear = getIndianFinancialYear(paymentDate);
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
    paymentNumber: `${prefix}/${financialYear}/${String(seq).padStart(5, '0')}`,
    financialYear,
  };
}

export interface InvoiceFinancialSummary {
  invoiceId: string;
  grandTotal: Prisma.Decimal;
  netAllocatedPayments: Prisma.Decimal;
  issuedCreditNotesTotal: Prisma.Decimal;
  outstandingAmount: Prisma.Decimal;
  excessCreditAmount: Prisma.Decimal;
  paymentStatus: InvoicePaymentStatus;
}

/**
 * Computes authoritative invoice outstanding and payment status inside a transaction.
 * Formula: Invoice Outstanding = max(0, Issued Grand Total - Net Allocated Payments - Issued Credit Notes)
 */
export async function recomputeInvoicePaymentStatusInTx(
  tx: Prisma.TransactionClient,
  salesInvoiceId: string,
): Promise<InvoiceFinancialSummary> {
  const invoice = await tx.salesInvoice.findUniqueOrThrow({
    where: { id: salesInvoiceId },
    select: { id: true, grandTotal: true, status: true, paymentStatus: true },
  });

  const [allocAgg, cnAgg] = await Promise.all([
    tx.paymentAllocation.aggregate({
      where: { salesInvoiceId, isReversed: false },
      _sum: { allocatedAmount: true },
    }),
    tx.creditNote.aggregate({
      where: { salesInvoiceId, status: 'ISSUED' },
      _sum: { grandTotal: true },
    }),
  ]);

  const grandTotal = new Prisma.Decimal(invoice.grandTotal).toDecimalPlaces(2);
  const netAllocatedPayments = new Prisma.Decimal(
    allocAgg._sum.allocatedAmount ?? 0,
  ).toDecimalPlaces(2);
  const issuedCreditNotesTotal = new Prisma.Decimal(
    cnAgg._sum.grandTotal ?? 0,
  ).toDecimalPlaces(2);

  const effectiveSettled = netAllocatedPayments.add(issuedCreditNotesTotal);
  const rawDiff = grandTotal.sub(effectiveSettled);

  const outstandingAmount = rawDiff.gt(ZERO) ? rawDiff.toDecimalPlaces(2) : new Prisma.Decimal(0);
  const excessCreditAmount = rawDiff.lt(ZERO)
    ? rawDiff.abs().toDecimalPlaces(2)
    : new Prisma.Decimal(0);

  let paymentStatus: InvoicePaymentStatus = InvoicePaymentStatus.UNPAID;
  if (invoice.status === 'ISSUED') {
    if (outstandingAmount.lte(ZERO) && (grandTotal.gt(ZERO) || effectiveSettled.gt(ZERO))) {
      paymentStatus = InvoicePaymentStatus.PAID;
    } else if (effectiveSettled.gt(ZERO)) {
      paymentStatus = InvoicePaymentStatus.PARTIALLY_PAID;
    }
  }

  if (invoice.paymentStatus !== paymentStatus) {
    await tx.salesInvoice.update({
      where: { id: salesInvoiceId },
      data: { paymentStatus },
    });
  }

  return {
    invoiceId: salesInvoiceId,
    grandTotal,
    netAllocatedPayments,
    issuedCreditNotesTotal,
    outstandingAmount,
    excessCreditAmount,
    paymentStatus,
  };
}

const PAYMENT_INCLUDE = {
  customer: {
    select: { id: true, code: true, legalName: true, customerType: true, gstin: true },
  },
  allocations: {
    orderBy: { createdAt: 'asc' as const },
    include: {
      salesInvoice: {
        select: {
          id: true,
          invoiceNumber: true,
          invoiceDate: true,
          dueDate: true,
          grandTotal: true,
          status: true,
          paymentStatus: true,
        },
      },
    },
  },
};

function enrichPayment(payment: Prisma.CustomerPaymentGetPayload<{ include: typeof PAYMENT_INCLUDE }>) {
  const activeAllocated = payment.allocations
    .filter(a => !a.isReversed)
    .reduce((sum, a) => sum.add(new Prisma.Decimal(a.allocatedAmount)), new Prisma.Decimal(0));
  const totalAmount = new Prisma.Decimal(payment.amount);
  const unallocatedAmount =
    payment.status === CustomerPaymentStatus.REVERSED
      ? new Prisma.Decimal(0)
      : Prisma.Decimal.max(new Prisma.Decimal(0), totalAmount.sub(activeAllocated));

  return {
    ...payment,
    allocatedAmount: activeAllocated.toFixed(2),
    unallocatedAmount: unallocatedAmount.toFixed(2),
  };
}

async function applyAllocationsInTx(
  tx: Prisma.TransactionClient,
  paymentId: string,
  allocations: AllocatePaymentInput['allocations'],
  user: UserContext,
) {
  await tx.$queryRaw`SELECT id FROM customer_payments WHERE id = ${paymentId} FOR UPDATE`;

  const payment = await tx.customerPayment.findUnique({
    where: { id: paymentId },
    include: { allocations: { where: { isReversed: false } } },
  });
  if (!payment) throw new AppError('Customer payment not found.', 404);
  if (payment.status !== CustomerPaymentStatus.RECORDED) {
    throw new AppError('Cannot allocate a reversed customer payment.', 400);
  }

  const alreadyAllocated = payment.allocations.reduce(
    (sum, a) => sum.add(new Prisma.Decimal(a.allocatedAmount)),
    new Prisma.Decimal(0),
  );
  let remainingPayment = new Prisma.Decimal(payment.amount).sub(alreadyAllocated);

  // Lock target invoices in deterministic order to avoid deadlocks
  const uniqueInvoiceIds = Array.from(new Set(allocations.map(a => a.salesInvoiceId))).sort();
  for (const invId of uniqueInvoiceIds) {
    await tx.$queryRaw`SELECT id FROM sales_invoices WHERE id = ${invId} FOR UPDATE`;
  }

  for (const line of allocations) {
    const allocAmt = new Prisma.Decimal(line.allocatedAmount).toDecimalPlaces(2);
    if (allocAmt.lte(ZERO)) {
      throw new AppError('Allocation amount must be greater than zero.', 400);
    }
    if (allocAmt.gt(remainingPayment)) {
      throw new AppError(
        `Allocation (${allocAmt.toFixed(2)}) exceeds payment remaining unallocated balance (${remainingPayment.toFixed(2)}).`,
        400,
      );
    }

    const invoice = await tx.salesInvoice.findUnique({
      where: { id: line.salesInvoiceId },
    });
    if (!invoice) {
      throw new AppError(`Sales invoice ${line.salesInvoiceId} not found.`, 404);
    }
    if (invoice.customerId !== payment.customerId) {
      throw new AppError(
        `Cross-customer allocation rejected for invoice ${invoice.invoiceNumber}.`,
        400,
      );
    }
    if (invoice.status !== 'ISSUED') {
      throw new AppError(
        `Only ISSUED invoices can receive allocations (invoice ${invoice.invoiceNumber} is ${invoice.status}).`,
        400,
      );
    }

    const summary = await recomputeInvoicePaymentStatusInTx(tx, invoice.id);
    if (allocAmt.gt(summary.outstandingAmount)) {
      throw new AppError(
        `Allocation (${allocAmt.toFixed(2)}) exceeds invoice ${invoice.invoiceNumber} outstanding (${summary.outstandingAmount.toFixed(2)}).`,
        400,
      );
    }

    await tx.paymentAllocation.create({
      data: {
        paymentId: payment.id,
        salesInvoiceId: invoice.id,
        allocatedAmount: allocAmt,
        createdById: user.userId,
      },
    });

    remainingPayment = remainingPayment.sub(allocAmt);
    await recomputeInvoicePaymentStatusInTx(tx, invoice.id);
  }
}

export class CustomerPaymentService {
  static async createPayment(
    input: CreateCustomerPaymentInput,
    user: UserContext,
    meta: AuditMeta,
  ) {
    if (input.idempotencyKey) {
      const existing = await prisma.customerPayment.findUnique({
        where: { idempotencyKey: input.idempotencyKey },
        include: PAYMENT_INCLUDE,
      });
      if (existing) return enrichPayment(existing);
    }

    const paymentDate = input.paymentDate ? new Date(input.paymentDate) : new Date();
    const amount = new Prisma.Decimal(input.amount).toDecimalPlaces(2);
    if (amount.lte(ZERO)) {
      throw new AppError('Payment amount must be greater than zero.', 400);
    }

    const created = await prisma.$transaction(async tx => {
      const customer = await tx.customer.findUnique({
        where: { id: input.customerId },
      });
      if (!customer || !customer.isActive) {
        throw new AppError('Active customer not found.', 404);
      }

      const { paymentNumber, financialYear } = await generatePaymentNumberInTx(tx, paymentDate);

      const payment = await tx.customerPayment.create({
        data: {
          paymentNumber,
          financialYear,
          customerId: customer.id,
          paymentDate,
          amount,
          paymentMode: input.paymentMode as PaymentMode,
          transactionReference: input.transactionReference ?? null,
          notes: input.notes ?? null,
          status: CustomerPaymentStatus.RECORDED,
          idempotencyKey: input.idempotencyKey ?? null,
          createdById: user.userId,
        },
      });

      if (input.allocations && input.allocations.length > 0) {
        await applyAllocationsInTx(tx, payment.id, input.allocations, user);
      }

      return tx.customerPayment.findUniqueOrThrow({
        where: { id: payment.id },
        include: PAYMENT_INCLUDE,
      });
    });

    await AuditService.log({
      userId: meta.userId,
      action: AuditAction.CREATE,
      entityType: 'CustomerPayment',
      entityId: created.id,
      newState: toPlainJson({
        paymentNumber: created.paymentNumber,
        customerId: created.customerId,
        amount: created.amount.toString(),
        paymentMode: created.paymentMode,
        allocationsCount: created.allocations.length,
      }),
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
      remarks: `Customer payment ${created.paymentNumber} recorded`,
    });

    return enrichPayment(created);
  }

  static async allocatePayment(
    paymentId: string,
    input: AllocatePaymentInput,
    user: UserContext,
    meta: AuditMeta,
  ) {
    const updated = await prisma.$transaction(async tx => {
      await applyAllocationsInTx(tx, paymentId, input.allocations, user);
      return tx.customerPayment.findUniqueOrThrow({
        where: { id: paymentId },
        include: PAYMENT_INCLUDE,
      });
    });

    await AuditService.log({
      userId: meta.userId,
      action: AuditAction.UPDATE,
      entityType: 'CustomerPayment',
      entityId: paymentId,
      newState: toPlainJson({
        allocations: input.allocations,
      }),
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
      remarks: `Allocated payment ${updated.paymentNumber}`,
    });

    return enrichPayment(updated);
  }

  static async reversePayment(
    paymentId: string,
    reason: string,
    user: UserContext,
    meta: AuditMeta,
  ) {
    const reversed = await prisma.$transaction(async tx => {
      await tx.$queryRaw`SELECT id FROM customer_payments WHERE id = ${paymentId} FOR UPDATE`;
      const existing = await tx.customerPayment.findUnique({
        where: { id: paymentId },
        include: { allocations: { where: { isReversed: false } } },
      });
      if (!existing) throw new AppError('Customer payment not found.', 404);
      if (existing.status === CustomerPaymentStatus.REVERSED) {
        throw new AppError('Customer payment is already reversed.', 400);
      }

      const now = new Date();
      const affectedInvoiceIds = Array.from(
        new Set(existing.allocations.map(a => a.salesInvoiceId)),
      ).sort();

      for (const invId of affectedInvoiceIds) {
        await tx.$queryRaw`SELECT id FROM sales_invoices WHERE id = ${invId} FOR UPDATE`;
      }

      await tx.paymentAllocation.updateMany({
        where: { paymentId, isReversed: false },
        data: { isReversed: true, reversedAt: now },
      });

      await tx.customerPayment.update({
        where: { id: paymentId },
        data: {
          status: CustomerPaymentStatus.REVERSED,
          reversedById: user.userId,
          reversedAt: now,
          reversalReason: reason,
        },
      });

      for (const invId of affectedInvoiceIds) {
        await recomputeInvoicePaymentStatusInTx(tx, invId);
      }

      return tx.customerPayment.findUniqueOrThrow({
        where: { id: paymentId },
        include: PAYMENT_INCLUDE,
      });
    });

    await AuditService.log({
      userId: meta.userId,
      action: AuditAction.CANCEL,
      entityType: 'CustomerPayment',
      entityId: paymentId,
      previousState: { status: 'RECORDED' },
      newState: { status: 'REVERSED', reversalReason: reason },
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
      remarks: reason,
    });

    return enrichPayment(reversed);
  }

  static async listPayments(
    params: PaginationParams,
    filters: {
      customerId?: string;
      status?: string;
      paymentMode?: string;
      fromDate?: string;
      toDate?: string;
    },
  ) {
    const where: Prisma.CustomerPaymentWhereInput = {};
    if (filters.customerId) where.customerId = filters.customerId;
    if (filters.status) where.status = filters.status as CustomerPaymentStatus;
    if (filters.paymentMode) where.paymentMode = filters.paymentMode as PaymentMode;
    const dateFilter = buildDateRangeFilter(filters.fromDate, filters.toDate);
    if (dateFilter) where.paymentDate = dateFilter;
    if (params.search) {
      where.OR = [
        { paymentNumber: { contains: params.search, mode: 'insensitive' } },
        { transactionReference: { contains: params.search, mode: 'insensitive' } },
        { customer: { legalName: { contains: params.search, mode: 'insensitive' } } },
      ];
    }

    const [items, total] = await Promise.all([
      prisma.customerPayment.findMany({
        where,
        skip: params.skip,
        take: params.take,
        orderBy: { paymentDate: 'desc' },
        include: PAYMENT_INCLUDE,
      }),
      prisma.customerPayment.count({ where }),
    ]);

    return paginatedResult(items.map(enrichPayment), total, params.page, params.limit);
  }

  static async getPaymentById(id: string) {
    const payment = await prisma.customerPayment.findUnique({
      where: { id },
      include: PAYMENT_INCLUDE,
    });
    if (!payment) throw new AppError('Customer payment not found.', 404);
    return enrichPayment(payment);
  }

  static async getInvoicePaymentHistory(invoiceId: string, user: UserContext) {
    const invoice = await prisma.salesInvoice.findUnique({
      where: { id: invoiceId },
      include: {
        customer: { select: { id: true, code: true, legalName: true } },
        paymentAllocations: {
          orderBy: { createdAt: 'desc' },
          include: {
            payment: {
              select: {
                id: true,
                paymentNumber: true,
                paymentDate: true,
                paymentMode: true,
                amount: true,
                status: true,
                transactionReference: true,
                reversalReason: true,
              },
            },
          },
        },
        creditNotes: {
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            creditNoteNumber: true,
            creditNoteDate: true,
            grandTotal: true,
            status: true,
            reason: true,
          },
        },
      },
    });
    if (!invoice) throw new AppError('Sales invoice not found.', 404);
    await assertWarehouseAccess(user, invoice.warehouseId, 'READ');

    const netAllocatedPayments = invoice.paymentAllocations
      .filter(a => !a.isReversed)
      .reduce((sum, a) => sum.add(new Prisma.Decimal(a.allocatedAmount)), new Prisma.Decimal(0));
    const issuedCreditNotesTotal = invoice.creditNotes
      .filter(c => c.status === 'ISSUED')
      .reduce((sum, c) => sum.add(new Prisma.Decimal(c.grandTotal)), new Prisma.Decimal(0));
    const grandTotal = new Prisma.Decimal(invoice.grandTotal);
    const diff = grandTotal.sub(netAllocatedPayments).sub(issuedCreditNotesTotal);
    const outstandingAmount = diff.gt(ZERO) ? diff : new Prisma.Decimal(0);
    const excessCreditBalance = diff.lt(ZERO) ? diff.abs() : new Prisma.Decimal(0);

    return {
      invoiceId: invoice.id,
      invoiceNumber: invoice.invoiceNumber,
      invoiceStatus: invoice.status,
      paymentStatus: invoice.paymentStatus,
      customer: invoice.customer,
      grandTotal: grandTotal.toFixed(2),
      netAllocatedPayments: netAllocatedPayments.toFixed(2),
      issuedCreditNotesTotal: issuedCreditNotesTotal.toFixed(2),
      outstandingAmount: outstandingAmount.toFixed(2),
      excessCreditBalance: excessCreditBalance.toFixed(2),
      allocations: invoice.paymentAllocations,
      creditNotes: invoice.creditNotes,
    };
  }

  static async getCustomerPaymentHistory(customerId: string) {
    const customer = await prisma.customer.findUnique({
      where: { id: customerId },
      select: { id: true, code: true, legalName: true },
    });
    if (!customer) throw new AppError('Customer not found.', 404);

    const payments = await prisma.customerPayment.findMany({
      where: { customerId },
      orderBy: { paymentDate: 'desc' },
      include: PAYMENT_INCLUDE,
    });

    return {
      customer,
      payments: payments.map(enrichPayment),
    };
  }

  static async getCustomerOutstanding(customerId: string, user: UserContext) {
    const report = await this.getReceivablesReport(user, { customerId });
    const customerRow = report.customers[0];
    return (
      customerRow ?? {
        customerId,
        invoiceCount: 0,
        totalInvoiced: '0.00',
        totalPaid: '0.00',
        totalCreditNotes: '0.00',
        outstandingAmount: '0.00',
        unallocatedPayments: '0.00',
        excessCreditBalance: '0.00',
        invoices: [],
      }
    );
  }

  static async getReceivablesReport(
    user: UserContext,
    filters: {
      customerId?: string;
      invoiceId?: string;
      fromDate?: string;
      toDate?: string;
    },
  ) {
    const allowedWh = await getAuthorizedWarehouseIds(user, 'READ');
    const where: Prisma.SalesInvoiceWhereInput = {
      status: 'ISSUED',
    };
    if (allowedWh) where.warehouseId = { in: allowedWh };
    if (filters.customerId) where.customerId = filters.customerId;
    if (filters.invoiceId) where.id = filters.invoiceId;
    const dateFilter = buildDateRangeFilter(filters.fromDate, filters.toDate);
    if (dateFilter) where.invoiceDate = dateFilter;

    const invoices = await prisma.salesInvoice.findMany({
      where,
      orderBy: { invoiceDate: 'asc' },
      include: {
        customer: { select: { id: true, code: true, legalName: true, customerType: true } },
        paymentAllocations: { where: { isReversed: false } },
        creditNotes: { where: { status: 'ISSUED' } },
      },
    });

    const customerIds = Array.from(new Set(invoices.map(i => i.customerId)));
    const allRecordedPayments =
      customerIds.length > 0 || filters.customerId
        ? await prisma.customerPayment.findMany({
            where: {
              status: CustomerPaymentStatus.RECORDED,
              customerId: filters.customerId
                ? filters.customerId
                : { in: customerIds },
            },
            include: { allocations: { where: { isReversed: false } } },
          })
        : [];

    const unallocatedByCustomer = new Map<string, Prisma.Decimal>();
    for (const p of allRecordedPayments) {
      const alloc = p.allocations.reduce(
        (s, a) => s.add(new Prisma.Decimal(a.allocatedAmount)),
        new Prisma.Decimal(0),
      );
      const unalloc = Prisma.Decimal.max(ZERO, new Prisma.Decimal(p.amount).sub(alloc));
      unallocatedByCustomer.set(
        p.customerId,
        (unallocatedByCustomer.get(p.customerId) ?? new Prisma.Decimal(0)).add(unalloc),
      );
    }

    const invoiceRows = invoices.map(inv => {
      const grandTotal = new Prisma.Decimal(inv.grandTotal);
      const paidAmount = inv.paymentAllocations.reduce(
        (s, a) => s.add(new Prisma.Decimal(a.allocatedAmount)),
        new Prisma.Decimal(0),
      );
      const creditNoteAmount = inv.creditNotes.reduce(
        (s, c) => s.add(new Prisma.Decimal(c.grandTotal)),
        new Prisma.Decimal(0),
      );
      const diff = grandTotal.sub(paidAmount).sub(creditNoteAmount);
      const outstandingAmount = diff.gt(ZERO) ? diff : new Prisma.Decimal(0);
      const excessCredit = diff.lt(ZERO) ? diff.abs() : new Prisma.Decimal(0);

      return {
        invoiceId: inv.id,
        invoiceNumber: inv.invoiceNumber,
        invoiceDate: inv.invoiceDate,
        dueDate: inv.dueDate,
        effectiveDueDate: inv.dueDate ?? inv.invoiceDate,
        dueDateFallbackUsed: !inv.dueDate,
        customerId: inv.customerId,
        customerCode: inv.customer.code,
        customerLegalName: inv.customer.legalName,
        paymentStatus: inv.paymentStatus,
        grandTotal: grandTotal.toFixed(2),
        paidAmount: paidAmount.toFixed(2),
        creditNoteAmount: creditNoteAmount.toFixed(2),
        outstandingAmount: outstandingAmount.toFixed(2),
        excessCreditBalance: excessCredit.toFixed(2),
      };
    });

    const customerMap = new Map<
      string,
      {
        customerId: string;
        customerCode: string;
        customerLegalName: string;
        invoiceCount: number;
        totalInvoiced: Prisma.Decimal;
        totalPaid: Prisma.Decimal;
        totalCreditNotes: Prisma.Decimal;
        outstandingAmount: Prisma.Decimal;
        excessFromInvoices: Prisma.Decimal;
      }
    >();

    for (const row of invoiceRows) {
      const entry = customerMap.get(row.customerId) ?? {
        customerId: row.customerId,
        customerCode: row.customerCode,
        customerLegalName: row.customerLegalName,
        invoiceCount: 0,
        totalInvoiced: new Prisma.Decimal(0),
        totalPaid: new Prisma.Decimal(0),
        totalCreditNotes: new Prisma.Decimal(0),
        outstandingAmount: new Prisma.Decimal(0),
        excessFromInvoices: new Prisma.Decimal(0),
      };
      entry.invoiceCount += 1;
      entry.totalInvoiced = entry.totalInvoiced.add(row.grandTotal);
      entry.totalPaid = entry.totalPaid.add(row.paidAmount);
      entry.totalCreditNotes = entry.totalCreditNotes.add(row.creditNoteAmount);
      entry.outstandingAmount = entry.outstandingAmount.add(row.outstandingAmount);
      entry.excessFromInvoices = entry.excessFromInvoices.add(row.excessCreditBalance);
      customerMap.set(row.customerId, entry);
    }

    const customers = Array.from(customerMap.values()).map(c => {
      const unalloc = unallocatedByCustomer.get(c.customerId) ?? new Prisma.Decimal(0);
      const totalExcess = c.excessFromInvoices.add(unalloc);
      return {
        customerId: c.customerId,
        customerCode: c.customerCode,
        customerLegalName: c.customerLegalName,
        invoiceCount: c.invoiceCount,
        totalInvoiced: c.totalInvoiced.toFixed(2),
        totalPaid: c.totalPaid.toFixed(2),
        totalCreditNotes: c.totalCreditNotes.toFixed(2),
        outstandingAmount: c.outstandingAmount.toFixed(2),
        unallocatedPayments: unalloc.toFixed(2),
        excessCreditBalance: totalExcess.toFixed(2),
      };
    });

    const grandTotals = invoiceRows.reduce(
      (acc, r) => ({
        totalInvoiced: acc.totalInvoiced.add(r.grandTotal),
        totalPaid: acc.totalPaid.add(r.paidAmount),
        totalCreditNotes: acc.totalCreditNotes.add(r.creditNoteAmount),
        totalOutstanding: acc.totalOutstanding.add(r.outstandingAmount),
      }),
      {
        totalInvoiced: new Prisma.Decimal(0),
        totalPaid: new Prisma.Decimal(0),
        totalCreditNotes: new Prisma.Decimal(0),
        totalOutstanding: new Prisma.Decimal(0),
      },
    );

    return {
      totals: {
        invoiceCount: invoiceRows.length,
        totalInvoiced: grandTotals.totalInvoiced.toFixed(2),
        totalPaid: grandTotals.totalPaid.toFixed(2),
        totalCreditNotes: grandTotals.totalCreditNotes.toFixed(2),
        totalOutstanding: grandTotals.totalOutstanding.toFixed(2),
      },
      customers,
      invoices: invoiceRows,
    };
  }

  static async getAgeingReport(
    user: UserContext,
    filters: {
      asOfDate?: string;
      customerId?: string;
      invoiceId?: string;
      fromDate?: string;
      toDate?: string;
    },
  ) {
    const asOf = filters.asOfDate ? new Date(filters.asOfDate) : new Date();
    const asOfUtcMidnight = Date.UTC(
      asOf.getUTCFullYear(),
      asOf.getUTCMonth(),
      asOf.getUTCDate(),
    );

    const receivables = await this.getReceivablesReport(user, filters);

    type BucketKey = 'notDue' | 'days1to30' | 'days31to60' | 'days61to90' | 'above90';
    const emptyBuckets = () => ({
      notDue: new Prisma.Decimal(0),
      days1to30: new Prisma.Decimal(0),
      days31to60: new Prisma.Decimal(0),
      days61to90: new Prisma.Decimal(0),
      above90: new Prisma.Decimal(0),
      totalOutstanding: new Prisma.Decimal(0),
    });

    const totals = emptyBuckets();
    const byCustomer = new Map<
      string,
      ReturnType<typeof emptyBuckets> & {
        customerId: string;
        customerCode: string;
        customerLegalName: string;
      }
    >();

    const invoices = receivables.invoices
      .filter(inv => new Prisma.Decimal(inv.outstandingAmount).gt(ZERO))
      .map(inv => {
        const refDate = new Date(inv.effectiveDueDate);
        const refUtcMidnight = Date.UTC(
          refDate.getUTCFullYear(),
          refDate.getUTCMonth(),
          refDate.getUTCDate(),
        );
        const daysPastDue = Math.floor((asOfUtcMidnight - refUtcMidnight) / 86_400_000);

        let bucket: BucketKey = 'notDue';
        if (daysPastDue <= 0) bucket = 'notDue';
        else if (daysPastDue <= 30) bucket = 'days1to30';
        else if (daysPastDue <= 60) bucket = 'days31to60';
        else if (daysPastDue <= 90) bucket = 'days61to90';
        else bucket = 'above90';

        const out = new Prisma.Decimal(inv.outstandingAmount);
        totals[bucket] = totals[bucket].add(out);
        totals.totalOutstanding = totals.totalOutstanding.add(out);

        const cEntry = byCustomer.get(inv.customerId) ?? {
          ...emptyBuckets(),
          customerId: inv.customerId,
          customerCode: inv.customerCode,
          customerLegalName: inv.customerLegalName,
        };
        cEntry[bucket] = cEntry[bucket].add(out);
        cEntry.totalOutstanding = cEntry.totalOutstanding.add(out);
        byCustomer.set(inv.customerId, cEntry);

        return {
          ...inv,
          daysPastDue: Math.max(0, daysPastDue),
          bucket,
        };
      });

    return {
      asOfDate: asOf.toISOString(),
      fallbackRule: 'Uses SalesInvoice.dueDate when present; otherwise falls back to SalesInvoice.invoiceDate.',
      bucketTotals: {
        notDue: totals.notDue.toFixed(2),
        days1to30: totals.days1to30.toFixed(2),
        days31to60: totals.days31to60.toFixed(2),
        days61to90: totals.days61to90.toFixed(2),
        above90: totals.above90.toFixed(2),
        totalOutstanding: totals.totalOutstanding.toFixed(2),
      },
      customers: Array.from(byCustomer.values()).map(c => ({
        customerId: c.customerId,
        customerCode: c.customerCode,
        customerLegalName: c.customerLegalName,
        notDue: c.notDue.toFixed(2),
        days1to30: c.days1to30.toFixed(2),
        days31to60: c.days31to60.toFixed(2),
        days61to90: c.days61to90.toFixed(2),
        above90: c.above90.toFixed(2),
        totalOutstanding: c.totalOutstanding.toFixed(2),
      })),
      invoices,
    };
  }

  /**
   * P1.1 Dedicated Collection Summary Report.
   * Uses paymentDate (not invoiceDate) and Prisma.Decimal for all monetary totals.
   * Reversed payments are tracked in totalReversedPayments and excluded from netCollections.
   */
  static async getCollectionReport(filters: {
    fromDate?: string;
    toDate?: string;
    paymentMode?: string;
    customerId?: string;
    groupBy?: 'daily' | 'monthly';
  }) {
    const groupBy = filters.groupBy === 'daily' ? 'daily' : 'monthly';
    const where: Prisma.CustomerPaymentWhereInput = {};
    if (filters.customerId) where.customerId = filters.customerId;
    if (filters.paymentMode) where.paymentMode = filters.paymentMode as PaymentMode;
    const dateFilter = buildDateRangeFilter(filters.fromDate, filters.toDate);
    if (dateFilter) where.paymentDate = dateFilter;

    const payments = await prisma.customerPayment.findMany({
      where,
      orderBy: { paymentDate: 'asc' },
      include: {
        customer: { select: { id: true, code: true, legalName: true } },
        allocations: { where: { isReversed: false } },
      },
    });

    let totalGrossPaymentsReceived = new Prisma.Decimal(0);
    let totalReversedPayments = new Prisma.Decimal(0);
    let netCollections = new Prisma.Decimal(0);
    let totalAllocatedAmount = new Prisma.Decimal(0);
    let totalUnallocatedAdvances = new Prisma.Decimal(0);
    let recordedCount = 0;
    let reversedCount = 0;

    const modeMap = new Map<
      string,
      {
        paymentMode: string;
        transactionCount: number;
        netCollected: Prisma.Decimal;
        allocatedAmount: Prisma.Decimal;
        unallocatedAdvances: Prisma.Decimal;
      }
    >();

    const customerMap = new Map<
      string,
      {
        customerId: string;
        customerCode: string;
        customerLegalName: string;
        transactionCount: number;
        netCollected: Prisma.Decimal;
        allocatedAmount: Prisma.Decimal;
        unallocatedAdvances: Prisma.Decimal;
      }
    >();

    const periodMap = new Map<
      string,
      {
        period: string;
        transactionCount: number;
        grossReceived: Prisma.Decimal;
        reversedAmount: Prisma.Decimal;
        netCollected: Prisma.Decimal;
        unallocatedAdvances: Prisma.Decimal;
      }
    >();

    for (const p of payments) {
      const amt = new Prisma.Decimal(p.amount).toDecimalPlaces(2);
      totalGrossPaymentsReceived = totalGrossPaymentsReceived.add(amt);

      const periodKey =
        groupBy === 'daily'
          ? p.paymentDate.toISOString().slice(0, 10)
          : p.paymentDate.toISOString().slice(0, 7);

      const pEntry = periodMap.get(periodKey) ?? {
        period: periodKey,
        transactionCount: 0,
        grossReceived: new Prisma.Decimal(0),
        reversedAmount: new Prisma.Decimal(0),
        netCollected: new Prisma.Decimal(0),
        unallocatedAdvances: new Prisma.Decimal(0),
      };
      pEntry.transactionCount += 1;
      pEntry.grossReceived = pEntry.grossReceived.add(amt);

      if (p.status === CustomerPaymentStatus.REVERSED) {
        reversedCount += 1;
        totalReversedPayments = totalReversedPayments.add(amt);
        pEntry.reversedAmount = pEntry.reversedAmount.add(amt);
        periodMap.set(periodKey, pEntry);
        continue;
      }

      recordedCount += 1;
      netCollections = netCollections.add(amt);

      const allocSum = p.allocations.reduce(
        (sum, a) => sum.add(new Prisma.Decimal(a.allocatedAmount)),
        new Prisma.Decimal(0),
      );
      const allocated = Prisma.Decimal.min(amt, allocSum).toDecimalPlaces(2);
      const unallocated = Prisma.Decimal.max(ZERO, amt.sub(allocated)).toDecimalPlaces(2);

      totalAllocatedAmount = totalAllocatedAmount.add(allocated);
      totalUnallocatedAdvances = totalUnallocatedAdvances.add(unallocated);

      pEntry.netCollected = pEntry.netCollected.add(amt);
      pEntry.unallocatedAdvances = pEntry.unallocatedAdvances.add(unallocated);
      periodMap.set(periodKey, pEntry);

      const mEntry = modeMap.get(p.paymentMode) ?? {
        paymentMode: p.paymentMode,
        transactionCount: 0,
        netCollected: new Prisma.Decimal(0),
        allocatedAmount: new Prisma.Decimal(0),
        unallocatedAdvances: new Prisma.Decimal(0),
      };
      mEntry.transactionCount += 1;
      mEntry.netCollected = mEntry.netCollected.add(amt);
      mEntry.allocatedAmount = mEntry.allocatedAmount.add(allocated);
      mEntry.unallocatedAdvances = mEntry.unallocatedAdvances.add(unallocated);
      modeMap.set(p.paymentMode, mEntry);

      const cEntry = customerMap.get(p.customerId) ?? {
        customerId: p.customerId,
        customerCode: p.customer.code,
        customerLegalName: p.customer.legalName,
        transactionCount: 0,
        netCollected: new Prisma.Decimal(0),
        allocatedAmount: new Prisma.Decimal(0),
        unallocatedAdvances: new Prisma.Decimal(0),
      };
      cEntry.transactionCount += 1;
      cEntry.netCollected = cEntry.netCollected.add(amt);
      cEntry.allocatedAmount = cEntry.allocatedAmount.add(allocated);
      cEntry.unallocatedAdvances = cEntry.unallocatedAdvances.add(unallocated);
      customerMap.set(p.customerId, cEntry);
    }

    return {
      groupBy,
      accountingPolicy:
        'Reversed payments are excluded from netCollections and breakdowns, and reported separately in totalReversedPayments. Multi-invoice allocations are summed once per payment without double-counting.',
      summary: {
        transactionCount: payments.length,
        recordedCount,
        reversedCount,
        totalGrossPaymentsReceived: totalGrossPaymentsReceived.toFixed(2),
        totalReversedPayments: totalReversedPayments.toFixed(2),
        netCollections: netCollections.toFixed(2),
        totalAllocatedAmount: totalAllocatedAmount.toFixed(2),
        totalUnallocatedAdvances: totalUnallocatedAdvances.toFixed(2),
      },
      byPaymentMode: Array.from(modeMap.values()).map(m => ({
        paymentMode: m.paymentMode,
        transactionCount: m.transactionCount,
        netCollected: m.netCollected.toFixed(2),
        allocatedAmount: m.allocatedAmount.toFixed(2),
        unallocatedAdvances: m.unallocatedAdvances.toFixed(2),
      })),
      byCustomer: Array.from(customerMap.values())
        .sort((a, b) => b.netCollected.cmp(a.netCollected))
        .map(c => ({
          customerId: c.customerId,
          customerCode: c.customerCode,
          customerLegalName: c.customerLegalName,
          transactionCount: c.transactionCount,
          netCollected: c.netCollected.toFixed(2),
          allocatedAmount: c.allocatedAmount.toFixed(2),
          unallocatedAdvances: c.unallocatedAdvances.toFixed(2),
        })),
      byPeriod: Array.from(periodMap.values()).map(p => ({
        period: p.period,
        transactionCount: p.transactionCount,
        grossReceived: p.grossReceived.toFixed(2),
        reversedAmount: p.reversedAmount.toFixed(2),
        netCollected: p.netCollected.toFixed(2),
        unallocatedAdvances: p.unallocatedAdvances.toFixed(2),
      })),
    };
  }
}
