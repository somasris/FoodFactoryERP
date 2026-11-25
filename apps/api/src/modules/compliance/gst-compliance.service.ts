import { Prisma } from '@prisma/client';
import { prisma } from '../../services/prisma.service';
import { DateRangeQuery } from './compliance.types';

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

    return {
      disclaimer:
        'Summary derived from immutable issued SalesInvoice snapshots. Not a direct GSTN portal filing submission.',
      counts: {
        issued: issuedInvoices.length,
        cancelled: cancelledInvoices.length,
        draft: draftInvoices.length,
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
   * 4.2.2 Purchase Tax Summary:
   * Explicitly reports unavailable supplier tax invoice data without inventing ITC
   * and without treating raw material InventoryReceipts as supplier tax invoices.
   */
  static async getPurchaseTaxSummary() {
    const supplierCount = await prisma.supplier.count({ where: { isActive: true } });
    return {
      purchaseInvoicingSupported: false,
      activeSuppliersCount: supplierCount,
      statusNotice:
        'Supplier tax invoices and GST Input Tax Credit (ITC) ledgers are not implemented in the current ERP scope. Raw material inventory receipts are excluded from GST tax credit reporting to preserve statutory accuracy.',
      totals: {
        taxablePurchaseValue: '0.00',
        cgstInput: '0.00',
        sgstInput: '0.00',
        igstInput: '0.00',
        totalInputTax: '0.00',
      },
      suppliers: [],
    };
  }
}
