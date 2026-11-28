import { Prisma, PrismaClient } from '@prisma/client';
import { CustomerPaymentService } from '../../src/modules/sales/customer-payment.service';
import { SalesService } from '../../src/modules/sales/sales.service';
import type { UserContext } from '../../src/modules/inventory/inventory.utils';

export interface VerificationCheck {
  name: string;
  passed: boolean;
  expected: string;
  actual: string;
}

export interface PitchDemoVerificationReport {
  counts: Record<string, number>;
  checks: VerificationCheck[];
  allPassed: boolean;
  recordIds: {
    murukkuProductId?: string;
    murukkuVariantId?: string;
    murukkuBomId?: string;
    murukkuBatchId?: string;
    murukkuBatchNumber?: string;
    retailerAOrderId?: string;
    retailerAOrderNumber?: string;
    retailerAInvoiceId?: string;
    retailerAInvoiceNumber?: string;
    distBOrderId?: string;
    distBOrderNumber?: string;
    flourSupplierId?: string;
    flourSupplierInvoiceNumber?: string;
  };
}

export async function verifyPitchDemo(
  prisma: PrismaClient,
  adminUser: UserContext,
): Promise<PitchDemoVerificationReport> {
  const counts: Record<string, number> = {
    customers: await prisma.customer.count({ where: { code: { startsWith: 'PITCH-' } } }),
    suppliers: await prisma.supplier.count({ where: { code: { startsWith: 'PITCH-' } } }),
    productCategories: await prisma.productCategory.count({ where: { code: { startsWith: 'PITCH-' } } }),
    rawMaterialCategories: await prisma.rawMaterialCategory.count({ where: { code: { startsWith: 'PITCH-' } } }),
    products: await prisma.product.count({ where: { code: { startsWith: 'PITCH-' } } }),
    rawMaterials: await prisma.rawMaterial.count({ where: { code: { startsWith: 'PITCH-' } } }),
    boms: await prisma.bOM.count({ where: { code: { startsWith: 'PITCH-' } } }),
    bomVersions: await prisma.bOMVersion.count({ where: { bom: { code: { startsWith: 'PITCH-' } } } }),
    inventoryReceipts: await prisma.inventoryReceipt.count({ where: { idempotencyKey: { startsWith: 'PITCH-' } } }),
    supplierInvoices: await prisma.supplierInvoice.count({ where: { supplier: { code: { startsWith: 'PITCH-' } } } }),
    productionPlans: await prisma.productionPlan.count({ where: { idempotencyKey: { startsWith: 'PITCH-' } } }),
    workOrders: await prisma.workOrder.count({ where: { idempotencyKey: { startsWith: 'PITCH-' } } }),
    productionBatches: await prisma.productionBatch.count({ where: { idempotencyKey: { startsWith: 'PITCH-' } } }),
    salesOrders: await prisma.salesOrder.count({ where: { customer: { code: { startsWith: 'PITCH-' } } } }),
    salesInvoices: await prisma.salesInvoice.count({ where: { idempotencyKey: { startsWith: 'PITCH-' } } }),
    customerPayments: await prisma.customerPayment.count({ where: { idempotencyKey: { startsWith: 'PITCH-' } } }),
    paymentAllocations: await prisma.paymentAllocation.count({ where: { payment: { idempotencyKey: { startsWith: 'PITCH-' } } } }),
    creditNotes: await prisma.creditNote.count({ where: { idempotencyKey: { startsWith: 'PITCH-' } } }),
    auditLogs: await prisma.auditLog.count({ where: { userAgent: 'pitch-demo-seed' } }),
  };

  const checks: VerificationCheck[] = [];
  const check = (name: string, expected: string, actual: string, passed: boolean) => {
    checks.push({ name, expected, actual, passed });
  };

  // 1. Murukku FG Stock == 88 packets
  const murItem = await prisma.inventoryItem.findUnique({ where: { code: 'PITCH-MUR-200G' } });
  const whFg = await prisma.warehouse.findUnique({ where: { code: 'WH-FG-01' } });
  const murBalAgg = murItem && whFg
    ? await prisma.inventoryBalance.aggregate({
        where: { inventoryItemId: murItem.id, warehouseId: whFg.id },
        _sum: { quantityOnHand: true, quantityReserved: true },
      })
    : null;
  const murOnHand = Number(murBalAgg?._sum.quantityOnHand ?? 0);
  check('Murukku 200g FG Stock On Hand', '88', String(murOnHand), murOnHand === 88);

  // 2. Murukku Batch 1 Costing == 5855.00 & 188 good packets (Rs 31.14/pkt)
  const batch1 = await prisma.productionBatch.findFirst({
    where: { idempotencyKey: 'PITCH-BATCH-MUR-01' },
    include: { costing: true },
  });
  const totalBatchCost = Number(batch1?.costing?.totalActualCost ?? 0);
  const unitBatchCost = Number(batch1?.costing?.costPerAcceptedUnit ?? 0);
  const grossUnitCost = totalBatchCost > 0 ? totalBatchCost / 188 : 0;
  check('Murukku Batch 1 Total Cost', '5855.00', totalBatchCost.toFixed(2), totalBatchCost === 5855);
  check(
    'Murukku Batch 1 Cost/Packet (App / Gross)',
    '29.2750 / 31.14',
    `${unitBatchCost.toFixed(4)} / ${grossUnitCost.toFixed(2)}`,
    Math.abs(unitBatchCost - 29.275) < 0.01 && Math.abs(grossUnitCost - 31.14) < 0.02,
  );

  // 3. Retailer A Invoice == 7875.00, Paid == 4000.00, Outstanding == 3875.00
  const inv1 = await prisma.salesInvoice.findFirst({
    where: { idempotencyKey: 'PITCH-INV-RETAILER-A' },
    include: { paymentAllocations: true },
  });
  const inv1Grand = Number(inv1?.grandTotal ?? 0);
  const inv1Paid = (inv1?.paymentAllocations ?? []).reduce((s, a) => s + Number(a.allocatedAmount), 0);
  const custA = await prisma.customer.findUnique({ where: { code: 'PITCH-CUST-01' } });
  const custAOutstanding = custA ? await CustomerPaymentService.getCustomerOutstanding(custA.id, adminUser) : null;
  const inv1Bal = Number(custAOutstanding?.outstandingAmount ?? 0);
  check('Retailer A Invoice Total', '7875.00', inv1Grand.toFixed(2), inv1Grand === 7875);
  check('Retailer A Paid / Outstanding', '4000.00 / 3875.00', `${inv1Paid.toFixed(2)} / ${inv1Bal.toFixed(2)}`, inv1Paid === 4000 && inv1Bal === 3875);

  // 4. Distributor B Shortage == INSUFFICIENT (short by 32)
  const custB = await prisma.customer.findUnique({ where: { code: 'PITCH-CUST-02' } });
  const soB = custB
    ? await prisma.salesOrder.findFirst({ where: { customerId: custB.id, notes: { contains: 'Distributor B' } } })
    : null;
  let distShortageActual = 'NOT_FOUND';
  let distShortageOk = false;
  if (soB) {
    const detail = await SalesService.getOrderById(soB.id, adminUser);
    const avail = detail.stockAvailability;
    const shortQty = avail?.lines?.[0]?.shortageQuantity ?? 'N/A';
    distShortageActual = `${avail?.status} (short: ${shortQty})`;
    distShortageOk = avail?.status === 'INSUFFICIENT' && Number(shortQty) === 32;
  }
  check('Distributor B Stock Availability', 'INSUFFICIENT (short: 32)', distShortageActual, distShortageOk);

  // 5. Supplier Flour Invoice == 2700 + 135 GST = 2835, MATCHED
  const flourSup = await prisma.supplier.findUnique({ where: { code: 'PITCH-SUP-01' } });
  const flourSinv = flourSup
    ? await prisma.supplierInvoice.findFirst({ where: { supplierId: flourSup.id, supplierInvoiceNumber: 'SLFM/2026-27/1042' } })
    : null;
  check(
    'Benchmark Flour Supplier Invoice',
    '2700.00 + 135.00 GST (MATCHED)',
    flourSinv ? `${Number(flourSinv.taxableValue).toFixed(2)} + ${Number(flourSinv.taxAmount).toFixed(2)} GST (${flourSinv.matchingStatus})` : 'MISSING',
    Boolean(flourSinv && Number(flourSinv.taxableValue) === 2700 && Number(flourSinv.taxAmount) === 135 && flourSinv.matchingStatus === 'MATCHED'),
  );

  // 6. Inventory Ledger vs Balance Reconciliation for all PITCH-* items
  const pitchItems = await prisma.inventoryItem.findMany({ where: { code: { startsWith: 'PITCH-' } } });
  let ledgerMismatchCount = 0;
  for (const item of pitchItems) {
    const balAgg = await prisma.inventoryBalance.aggregate({
      where: { inventoryItemId: item.id },
      _sum: { quantityOnHand: true },
    });
    const txLines = await prisma.inventoryTransactionLine.findMany({
      where: { inventoryItemId: item.id },
      include: { transaction: { select: { transactionType: true } } },
    });
    let ledgerSum = new Prisma.Decimal(0);
    for (const l of txLines) {
      const qty = new Prisma.Decimal(l.baseQuantity).abs();
      if (['RECEIPT', 'TRANSFER_IN', 'ADJUSTMENT_IN'].includes(l.transaction.transactionType)) {
        ledgerSum = ledgerSum.add(qty);
      } else if (['ISSUE', 'TRANSFER_OUT', 'ADJUSTMENT_OUT'].includes(l.transaction.transactionType)) {
        ledgerSum = ledgerSum.sub(qty);
      }
    }
    const balSum = new Prisma.Decimal(balAgg._sum.quantityOnHand ?? 0);
    if (!ledgerSum.toDecimalPlaces(4).equals(balSum.toDecimalPlaces(4))) {
      ledgerMismatchCount++;
    }
  }
  check('Inventory Ledger vs Balance Reconciliation', '0 mismatches', `${ledgerMismatchCount} mismatches`, ledgerMismatchCount === 0);

  // 7. No negative balances
  const negativeBals = await prisma.inventoryBalance.count({
    where: { inventoryItem: { code: { startsWith: 'PITCH-' } }, quantityOnHand: { lt: 0 } },
  });
  check('No Negative Inventory Balances', '0', String(negativeBals), negativeBals === 0);

  const murProduct = await prisma.product.findUnique({ where: { code: 'PITCH-FG-MUR200' } });
  const murVariant = await prisma.productVariant.findUnique({ where: { sku: 'PITCH-MUR-200G' } });
  const murBom = await prisma.bOM.findUnique({ where: { code: 'PITCH-BOM-MUR200' } });
  const soA = custA
    ? await prisma.salesOrder.findFirst({ where: { customerId: custA.id, notes: { contains: 'Retailer A' } } })
    : null;

  return {
    counts,
    checks,
    allPassed: checks.every(c => c.passed),
    recordIds: {
      murukkuProductId: murProduct?.id,
      murukkuVariantId: murVariant?.id,
      murukkuBomId: murBom?.id,
      murukkuBatchId: batch1?.id,
      murukkuBatchNumber: batch1?.batchNumber,
      retailerAOrderId: soA?.id,
      retailerAOrderNumber: soA?.orderNumber,
      retailerAInvoiceId: inv1?.id,
      retailerAInvoiceNumber: inv1?.invoiceNumber,
      distBOrderId: soB?.id,
      distBOrderNumber: soB?.orderNumber,
      flourSupplierId: flourSup?.id,
      flourSupplierInvoiceNumber: flourSinv?.internalInvoiceNumber,
    },
  };
}
