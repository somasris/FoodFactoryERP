import { Prisma } from '@prisma/client';
import { prisma } from '../../services/prisma.service';
import { DateRangeQuery } from './compliance.types';
import { buildDateRangeFilter } from '../sales/sales.utils';

const ZERO = new Prisma.Decimal(0);

/**
 * Compute Indian Financial Year (April 1 to March 31) label for a Date in Asia/Kolkata.
 */
export function getIndianFinancialYear(date: Date): string {
  // Convert to IST (+05:30)
  const ist = new Date(date.getTime() + 330 * 60 * 1000);
  const year = ist.getUTCFullYear();
  const month = ist.getUTCMonth() + 1; // 1-12
  if (month >= 4) {
    return `${year}-${String(year + 1).slice(-2)}`;
  }
  return `${year - 1}-${String(year).slice(-2)}`;
}

export function getFyDateBounds(financialYear: string): { start: Date; end: Date } | null {
  const match = /^(\d{4})-(\d{2})$/.exec(financialYear);
  if (!match) return null;
  const startYear = Number(match[1]);
  // April 1 00:00:00 IST = March 31 18:30:00 UTC
  const start = new Date(Date.UTC(startYear, 3, 1, 0, 0, 0) - 330 * 60 * 1000);
  // March 31 23:59:59.999 IST
  const end = new Date(Date.UTC(startYear + 1, 2, 31, 23, 59, 59, 999) - 330 * 60 * 1000);
  return { start, end };
}

export class GstComplianceService {
  /**
   * 4.2.1 Centralized GST Sales Compliance Summary using immutable SalesInvoice snapshots.
   * Never recalculates historical tax values using current TaxConfiguration.
   */
  static async getGstSalesSummary(query: DateRangeQuery) {
    const where: Prisma.SalesInvoiceWhereInput = {};
    if (query.financialYear) {
      where.financialYear = query.financialYear;
    }
    if (query.startDate || query.endDate) {
      where.invoiceDate = {};
      if (query.startDate) where.invoiceDate.gte = new Date(`${query.startDate}T00:00:00.000Z`);
      if (query.endDate) where.invoiceDate.lte = new Date(`${query.endDate}T23:59:59.999Z`);
    }

    const invoices = await prisma.salesInvoice.findMany({
      where,
      include: {
        lines: true,
      },
      orderBy: { invoiceDate: 'desc' },
    });

    const issuedInvoices = invoices.filter(i => i.status === 'ISSUED');
    const cancelledInvoices = invoices.filter(i => i.status === 'CANCELLED');
    const draftInvoices = invoices.filter(i => i.status === 'DRAFT');

    let taxableSalesValue = ZERO;
    let totalCgst = ZERO;
    let totalSgst = ZERO;
    let totalIgst = ZERO;
    let totalGstCollected = ZERO;
    let totalGrandTotal = ZERO;
    let intraStateTaxable = ZERO;
    let interStateTaxable = ZERO;

    const hsnMap = new Map<
      string,
      {
        hsnCode: string;
        lineCount: number;
        totalQuantity: Prisma.Decimal;
        taxableAmount: Prisma.Decimal;
        cgstAmount: Prisma.Decimal;
        sgstAmount: Prisma.Decimal;
        igstAmount: Prisma.Decimal;
        taxAmount: Prisma.Decimal;
        totalValue: Prisma.Decimal;
      }
    >();

    const rateMap = new Map<
      string,
      {
        gstRate: string;
        lineCount: number;
        taxableAmount: Prisma.Decimal;
        cgstAmount: Prisma.Decimal;
        sgstAmount: Prisma.Decimal;
        igstAmount: Prisma.Decimal;
        taxAmount: Prisma.Decimal;
      }
    >();

    const monthlyMap = new Map<
      string,
      {
        month: string;
        invoiceCount: number;
        taxableAmount: Prisma.Decimal;
        cgstAmount: Prisma.Decimal;
        sgstAmount: Prisma.Decimal;
        igstAmount: Prisma.Decimal;
        taxAmount: Prisma.Decimal;
        grandTotal: Prisma.Decimal;
      }
    >();

    for (const inv of issuedInvoices) {
      taxableSalesValue = taxableSalesValue.add(inv.taxableAmount);
      totalCgst = totalCgst.add(inv.cgstAmount);
      totalSgst = totalSgst.add(inv.sgstAmount);
      totalIgst = totalIgst.add(inv.igstAmount);
      totalGstCollected = totalGstCollected.add(inv.taxAmount);
      totalGrandTotal = totalGrandTotal.add(inv.grandTotal);

      if (inv.isInterState) {
        interStateTaxable = interStateTaxable.add(inv.taxableAmount);
      } else {
        intraStateTaxable = intraStateTaxable.add(inv.taxableAmount);
      }

      const istDate = new Date(inv.invoiceDate.getTime() + 330 * 60 * 1000);
      const monthKey = istDate.toISOString().slice(0, 7); // YYYY-MM
      const mEntry = monthlyMap.get(monthKey) || {
        month: monthKey,
        invoiceCount: 0,
        taxableAmount: ZERO,
        cgstAmount: ZERO,
        sgstAmount: ZERO,
        igstAmount: ZERO,
        taxAmount: ZERO,
        grandTotal: ZERO,
      };
      mEntry.invoiceCount += 1;
      mEntry.taxableAmount = mEntry.taxableAmount.add(inv.taxableAmount);
      mEntry.cgstAmount = mEntry.cgstAmount.add(inv.cgstAmount);
      mEntry.sgstAmount = mEntry.sgstAmount.add(inv.sgstAmount);
      mEntry.igstAmount = mEntry.igstAmount.add(inv.igstAmount);
      mEntry.taxAmount = mEntry.taxAmount.add(inv.taxAmount);
      mEntry.grandTotal = mEntry.grandTotal.add(inv.grandTotal);
      monthlyMap.set(monthKey, mEntry);

      for (const line of inv.lines) {
        const hsn = line.hsnCode || 'UNSPECIFIED';
        const hEntry = hsnMap.get(hsn) || {
          hsnCode: hsn,
          lineCount: 0,
          totalQuantity: ZERO,
          taxableAmount: ZERO,
          cgstAmount: ZERO,
          sgstAmount: ZERO,
          igstAmount: ZERO,
          taxAmount: ZERO,
          totalValue: ZERO,
        };
        hEntry.lineCount += 1;
        hEntry.totalQuantity = hEntry.totalQuantity.add(line.quantity);
        hEntry.taxableAmount = hEntry.taxableAmount.add(line.taxableAmount);
        hEntry.cgstAmount = hEntry.cgstAmount.add(line.cgstAmount);
        hEntry.sgstAmount = hEntry.sgstAmount.add(line.sgstAmount);
        hEntry.igstAmount = hEntry.igstAmount.add(line.igstAmount);
        hEntry.taxAmount = hEntry.taxAmount.add(line.taxAmount);
        hEntry.totalValue = hEntry.totalValue.add(line.lineTotal);
        hsnMap.set(hsn, hEntry);

        const rateKey = line.gstRate.toFixed(2);
        const rEntry = rateMap.get(rateKey) || {
          gstRate: rateKey,
          lineCount: 0,
          taxableAmount: ZERO,
          cgstAmount: ZERO,
          sgstAmount: ZERO,
          igstAmount: ZERO,
          taxAmount: ZERO,
        };
        rEntry.lineCount += 1;
        rEntry.taxableAmount = rEntry.taxableAmount.add(line.taxableAmount);
        rEntry.cgstAmount = rEntry.cgstAmount.add(line.cgstAmount);
        rEntry.sgstAmount = rEntry.sgstAmount.add(line.sgstAmount);
        rEntry.igstAmount = rEntry.igstAmount.add(line.igstAmount);
        rEntry.taxAmount = rEntry.taxAmount.add(line.taxAmount);
        rateMap.set(rateKey, rEntry);
      }
    }

    const cnDateFilter = buildDateRangeFilter(query.startDate, query.endDate);
    const issuedCreditNotes = await prisma.creditNote.findMany({
      where: {
        status: 'ISSUED',
        ...(query.warehouseId ? { warehouseId: query.warehouseId } : {}),
        ...(query.financialYear ? { financialYear: query.financialYear } : {}),
        ...(cnDateFilter ? { creditNoteDate: cnDateFilter } : {}),
      },
      orderBy: { creditNoteDate: 'desc' },
    });

    const cnTotals = issuedCreditNotes.reduce(
      (acc, cn) => ({
        taxableValue: acc.taxableValue.add(cn.taxableValue),
        cgstAmount: acc.cgstAmount.add(cn.cgstAmount),
        sgstAmount: acc.sgstAmount.add(cn.sgstAmount),
        igstAmount: acc.igstAmount.add(cn.igstAmount),
        taxAmount: acc.taxAmount.add(cn.taxAmount),
        grandTotal: acc.grandTotal.add(cn.grandTotal),
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
      disclaimer:
        'Summary derived from immutable issued SalesInvoice snapshots and issued CreditNotes. Not a direct GSTN portal filing submission.',
      counts: {
        issued: issuedInvoices.length,
        cancelled: cancelledInvoices.length,
        draft: draftInvoices.length,
        issuedCreditNotes: issuedCreditNotes.length,
      },
      totals: {
        taxableSalesValue: taxableSalesValue.toFixed(2),
        cgstAmount: totalCgst.toFixed(2),
        sgstAmount: totalSgst.toFixed(2),
        igstAmount: totalIgst.toFixed(2),
        totalGstCollected: totalGstCollected.toFixed(2),
        grandTotal: totalGrandTotal.toFixed(2),
        intraStateTaxable: intraStateTaxable.toFixed(2),
        interStateTaxable: interStateTaxable.toFixed(2),
      },
      creditNoteTotals: {
        taxableValue: cnTotals.taxableValue.toFixed(2),
        cgstAmount: cnTotals.cgstAmount.toFixed(2),
        sgstAmount: cnTotals.sgstAmount.toFixed(2),
        igstAmount: cnTotals.igstAmount.toFixed(2),
        taxAmount: cnTotals.taxAmount.toFixed(2),
        grandTotal: cnTotals.grandTotal.toFixed(2),
      },
      netSalesTotals: {
        taxableSalesValue: taxableSalesValue.sub(cnTotals.taxableValue).toFixed(2),
        cgstAmount: totalCgst.sub(cnTotals.cgstAmount).toFixed(2),
        sgstAmount: totalSgst.sub(cnTotals.sgstAmount).toFixed(2),
        igstAmount: totalIgst.sub(cnTotals.igstAmount).toFixed(2),
        totalGstCollected: totalGstCollected.sub(cnTotals.taxAmount).toFixed(2),
        grandTotal: totalGrandTotal.sub(cnTotals.grandTotal).toFixed(2),
      },
      hsnSummary: Array.from(hsnMap.values()).map(h => ({
        hsnCode: h.hsnCode,
        lineCount: h.lineCount,
        totalQuantity: h.totalQuantity.toFixed(4),
        taxableAmount: h.taxableAmount.toFixed(2),
        cgstAmount: h.cgstAmount.toFixed(2),
        sgstAmount: h.sgstAmount.toFixed(2),
        igstAmount: h.igstAmount.toFixed(2),
        taxAmount: h.taxAmount.toFixed(2),
        totalValue: h.totalValue.toFixed(2),
      })),
      taxRateSummary: Array.from(rateMap.values()).map(r => ({
        gstRate: r.gstRate,
        lineCount: r.lineCount,
        taxableAmount: r.taxableAmount.toFixed(2),
        cgstAmount: r.cgstAmount.toFixed(2),
        sgstAmount: r.sgstAmount.toFixed(2),
        igstAmount: r.igstAmount.toFixed(2),
        taxAmount: r.taxAmount.toFixed(2),
      })),
      monthlySummary: Array.from(monthlyMap.values())
        .sort((a, b) => a.month.localeCompare(b.month))
        .map(m => ({
          month: m.month,
          invoiceCount: m.invoiceCount,
          taxableAmount: m.taxableAmount.toFixed(2),
          cgstAmount: m.cgstAmount.toFixed(2),
          sgstAmount: m.sgstAmount.toFixed(2),
          igstAmount: m.igstAmount.toFixed(2),
          taxAmount: m.taxAmount.toFixed(2),
          grandTotal: m.grandTotal.toFixed(2),
        })),
      invoices: invoices.map(inv => ({
        id: inv.id,
        invoiceNumber: inv.invoiceNumber,
        financialYear: inv.financialYear,
        invoiceDate: inv.invoiceDate,
        status: inv.status,
        customerLegalName: inv.customerLegalName,
        customerGstin: inv.customerGstin,
        placeOfSupply: inv.placeOfSupply,
        isInterState: inv.isInterState,
        taxableAmount: inv.taxableAmount.toFixed(2),
        cgstAmount: inv.cgstAmount.toFixed(2),
        sgstAmount: inv.sgstAmount.toFixed(2),
        igstAmount: inv.igstAmount.toFixed(2),
        taxAmount: inv.taxAmount.toFixed(2),
        grandTotal: inv.grandTotal.toFixed(2),
      })),
    };
  }

  /**
   * 4.2.2 Purchase Tax Summary (Backed by real SupplierInvoice records):
   * Distinguishes Purchase GST Recorded vs ITC Eligible / Pending Verification / Ineligible.
   * InventoryReceipts are never treated as supplier tax invoices.
   */
  static async getPurchaseTaxSummary(query: DateRangeQuery = {}) {
    const supplierCount = await prisma.supplier.count({ where: { isActive: true } });
    const where: Prisma.SupplierInvoiceWhereInput = {
      status: 'POSTED',
    };
    const dateFilter = buildDateRangeFilter(query.startDate, query.endDate);
    if (dateFilter) where.invoiceDate = dateFilter;

    const invoices = await prisma.supplierInvoice.findMany({
      where,
      orderBy: { invoiceDate: 'desc' },
      include: {
        supplier: { select: { id: true, code: true, legalName: true, gstin: true } },
        factory: { select: { id: true, code: true, name: true } },
      },
    });

    let taxablePurchaseValue = new Prisma.Decimal(0);
    let cgstInput = new Prisma.Decimal(0);
    let sgstInput = new Prisma.Decimal(0);
    let igstInput = new Prisma.Decimal(0);
    let totalInputTax = new Prisma.Decimal(0);
    let itcEligibleTax = new Prisma.Decimal(0);
    let itcPendingTax = new Prisma.Decimal(0);
    let itcIneligibleTax = new Prisma.Decimal(0);

    const bySupplier = new Map<
      string,
      {
        supplierId: string;
        supplierCode: string;
        supplierLegalName: string;
        supplierGstin: string | null;
        invoiceCount: number;
        taxableValue: Prisma.Decimal;
        cgstAmount: Prisma.Decimal;
        sgstAmount: Prisma.Decimal;
        igstAmount: Prisma.Decimal;
        taxAmount: Prisma.Decimal;
        itcEligibleTax: Prisma.Decimal;
        itcPendingTax: Prisma.Decimal;
        itcIneligibleTax: Prisma.Decimal;
      }
    >();

    for (const inv of invoices) {
      const tax = new Prisma.Decimal(inv.taxAmount);
      taxablePurchaseValue = taxablePurchaseValue.add(new Prisma.Decimal(inv.taxableValue));
      cgstInput = cgstInput.add(new Prisma.Decimal(inv.cgstAmount));
      sgstInput = sgstInput.add(new Prisma.Decimal(inv.sgstAmount));
      igstInput = igstInput.add(new Prisma.Decimal(inv.igstAmount));
      totalInputTax = totalInputTax.add(tax);

      if (inv.itcStatus === 'ELIGIBLE') itcEligibleTax = itcEligibleTax.add(tax);
      else if (inv.itcStatus === 'INELIGIBLE') itcIneligibleTax = itcIneligibleTax.add(tax);
      else itcPendingTax = itcPendingTax.add(tax);

      const sup = bySupplier.get(inv.supplierId) ?? {
        supplierId: inv.supplierId,
        supplierCode: inv.supplier.code,
        supplierLegalName: inv.supplierLegalName,
        supplierGstin: inv.supplierGstin,
        invoiceCount: 0,
        taxableValue: new Prisma.Decimal(0),
        cgstAmount: new Prisma.Decimal(0),
        sgstAmount: new Prisma.Decimal(0),
        igstAmount: new Prisma.Decimal(0),
        taxAmount: new Prisma.Decimal(0),
        itcEligibleTax: new Prisma.Decimal(0),
        itcPendingTax: new Prisma.Decimal(0),
        itcIneligibleTax: new Prisma.Decimal(0),
      };
      sup.invoiceCount += 1;
      sup.taxableValue = sup.taxableValue.add(new Prisma.Decimal(inv.taxableValue));
      sup.cgstAmount = sup.cgstAmount.add(new Prisma.Decimal(inv.cgstAmount));
      sup.sgstAmount = sup.sgstAmount.add(new Prisma.Decimal(inv.sgstAmount));
      sup.igstAmount = sup.igstAmount.add(new Prisma.Decimal(inv.igstAmount));
      sup.taxAmount = sup.taxAmount.add(tax);
      if (inv.itcStatus === 'ELIGIBLE') sup.itcEligibleTax = sup.itcEligibleTax.add(tax);
      else if (inv.itcStatus === 'INELIGIBLE') sup.itcIneligibleTax = sup.itcIneligibleTax.add(tax);
      else sup.itcPendingTax = sup.itcPendingTax.add(tax);
      bySupplier.set(inv.supplierId, sup);
    }

    return {
      purchaseInvoicingSupported: true,
      activeSuppliersCount: supplierCount,
      invoiceCount: invoices.length,
      statusNotice:
        'Purchase GST summary is backed by posted SupplierInvoice records. ITC eligibility is tracked separately (ELIGIBLE, PENDING_VERIFICATION, INELIGIBLE).',
      totals: {
        taxablePurchaseValue: taxablePurchaseValue.toFixed(2),
        cgstInput: cgstInput.toFixed(2),
        sgstInput: sgstInput.toFixed(2),
        igstInput: igstInput.toFixed(2),
        totalInputTax: totalInputTax.toFixed(2),
        purchaseGstRecorded: totalInputTax.toFixed(2),
        itcEligible: itcEligibleTax.toFixed(2),
        itcPendingVerification: itcPendingTax.toFixed(2),
        itcIneligible: itcIneligibleTax.toFixed(2),
      },
      suppliers: Array.from(bySupplier.values()).map(s => ({
        supplierId: s.supplierId,
        supplierCode: s.supplierCode,
        supplierLegalName: s.supplierLegalName,
        supplierGstin: s.supplierGstin,
        invoiceCount: s.invoiceCount,
        taxableValue: s.taxableValue.toFixed(2),
        cgstAmount: s.cgstAmount.toFixed(2),
        sgstAmount: s.sgstAmount.toFixed(2),
        igstAmount: s.igstAmount.toFixed(2),
        taxAmount: s.taxAmount.toFixed(2),
        itcEligibleTax: s.itcEligibleTax.toFixed(2),
        itcPendingTax: s.itcPendingTax.toFixed(2),
        itcIneligibleTax: s.itcIneligibleTax.toFixed(2),
      })),
    };
  }
}
