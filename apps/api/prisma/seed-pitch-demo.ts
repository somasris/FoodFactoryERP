import { prisma } from '../src/services/prisma.service';
import { seedPitchMasterData } from './demo-pitch/master-data';
import { loadDemoActors, runPitchDemoWorkflows } from './demo-pitch/workflow-runner';
import { verifyPitchDemo } from './demo-pitch/verify-demo';

/**
 * Safely deletes ONLY records created by the `PITCH-*` demo dataset.
 * Never touches baseline COMP-01, FAC-TRICHY-01, warehouses, users, or user-created data.
 */
async function resetPitchDemoData() {
  console.info('🧹 Resetting PITCH-* demo dataset (preserving baseline & user data)...');

  const pitchCustomers = await prisma.customer.findMany({ where: { code: { startsWith: 'PITCH-' } }, select: { id: true } });
  const custIds = pitchCustomers.map(c => c.id);

  const pitchSuppliers = await prisma.supplier.findMany({ where: { code: { startsWith: 'PITCH-' } }, select: { id: true } });
  const supIds = pitchSuppliers.map(s => s.id);

  const pitchItems = await prisma.inventoryItem.findMany({ where: { code: { startsWith: 'PITCH-' } }, select: { id: true } });
  const itemIds = pitchItems.map(i => i.id);

  const pitchBatches = await prisma.productionBatch.findMany({ where: { idempotencyKey: { startsWith: 'PITCH-' } }, select: { id: true } });
  const batchIds = pitchBatches.map(b => b.id);

  const pitchWos = await prisma.workOrder.findMany({ where: { idempotencyKey: { startsWith: 'PITCH-' } }, select: { id: true } });
  const woIds = pitchWos.map(w => w.id);

  const pitchPlans = await prisma.productionPlan.findMany({ where: { idempotencyKey: { startsWith: 'PITCH-' } }, select: { id: true } });
  const planIds = pitchPlans.map(p => p.id);

  const pitchReceipts = itemIds.length > 0
    ? await prisma.inventoryReceipt.findMany({
        where: {
          OR: [
            { idempotencyKey: { startsWith: 'PITCH-' } },
            { lines: { some: { inventoryItemId: { in: itemIds } } } },
          ],
        },
        select: { id: true },
      })
    : [];
  const receiptIds = pitchReceipts.map(r => r.id);

  const pitchIssues = itemIds.length > 0
    ? await prisma.inventoryIssue.findMany({
        where: { lines: { some: { inventoryItemId: { in: itemIds } } } },
        select: { id: true },
      })
    : [];
  const issueIds = pitchIssues.map(i => i.id);

  if (custIds.length > 0) {
    await prisma.paymentAllocation.deleteMany({ where: { payment: { customerId: { in: custIds } } } });
    await prisma.customerPayment.deleteMany({ where: { customerId: { in: custIds } } });
    await prisma.creditNote.deleteMany({ where: { customerId: { in: custIds } } });
    await prisma.salesInvoice.deleteMany({ where: { customerId: { in: custIds } } });
    await prisma.salesOrder.deleteMany({ where: { customerId: { in: custIds } } });
  }

  if (supIds.length > 0) {
    await prisma.supplierInvoiceReceiptMatch.deleteMany({ where: { supplierInvoice: { supplierId: { in: supIds } } } });
    await prisma.supplierInvoice.deleteMany({ where: { supplierId: { in: supIds } } });
  }

  if (batchIds.length > 0) {
    await prisma.productionBatchCosting.deleteMany({ where: { productionBatchId: { in: batchIds } } });
    await prisma.qualityInspection.deleteMany({ where: { productionBatchId: { in: batchIds } } });
    await prisma.productionBatch.deleteMany({ where: { id: { in: batchIds } } });
  }
  if (woIds.length > 0) await prisma.workOrder.deleteMany({ where: { id: { in: woIds } } });
  if (planIds.length > 0) await prisma.productionPlan.deleteMany({ where: { id: { in: planIds } } });

  if (itemIds.length > 0) {
    await prisma.inventoryTransactionLine.deleteMany({ where: { inventoryItemId: { in: itemIds } } });
    await prisma.inventoryTransaction.deleteMany({
      where: {
        OR: [
          ...(receiptIds.length > 0 ? [{ referenceId: { in: receiptIds } }] : []),
          ...(batchIds.length > 0 ? [{ referenceId: { in: batchIds } }] : []),
          ...(issueIds.length > 0 ? [{ referenceId: { in: issueIds } }] : []),
        ],
      },
    });
    if (receiptIds.length > 0) {
      await prisma.inventoryReceipt.deleteMany({ where: { id: { in: receiptIds } } });
    }
    if (issueIds.length > 0) {
      await prisma.inventoryIssue.deleteMany({ where: { id: { in: issueIds } } });
    }
    await prisma.inventoryBalance.deleteMany({ where: { inventoryItemId: { in: itemIds } } });
    await prisma.inventoryBatch.deleteMany({ where: { inventoryItemId: { in: itemIds } } });
  }

  await prisma.bOM.deleteMany({ where: { code: { startsWith: 'PITCH-' } } });
  if (itemIds.length > 0) await prisma.inventoryItem.deleteMany({ where: { id: { in: itemIds } } });
  await prisma.productVariant.deleteMany({ where: { sku: { startsWith: 'PITCH-' } } });
  await prisma.product.deleteMany({ where: { code: { startsWith: 'PITCH-' } } });
  await prisma.rawMaterial.deleteMany({ where: { code: { startsWith: 'PITCH-' } } });
  await prisma.productCategory.deleteMany({ where: { code: { startsWith: 'PITCH-' } } });
  await prisma.rawMaterialCategory.deleteMany({ where: { code: { startsWith: 'PITCH-' } } });
  if (custIds.length > 0) await prisma.customer.deleteMany({ where: { id: { in: custIds } } });
  if (supIds.length > 0) await prisma.supplier.deleteMany({ where: { id: { in: supIds } } });
  await prisma.auditLog.deleteMany({ where: { userAgent: 'pitch-demo-seed' } });

  console.info('✅ PITCH-* demo dataset removed cleanly.');
}

async function withDbRetry<T>(fn: () => Promise<T>, retries = 5): Promise<T> {
  try {
    return await fn();
  } catch (err: unknown) {
    const code = (err as { code?: string })?.code;
    const msg = (err as { message?: string })?.message ?? '';
    if (
      retries > 0 &&
      (code === 'P1017' ||
        code === 'P1001' ||
        code === 'P2024' ||
        msg.includes('Server has closed the connection') ||
        msg.includes("Can't reach database server") ||
        msg.includes('Timed out fetching a new connection') ||
        msg.includes('ConnectionReset'))
    ) {
      console.warn(`⚠️ Transient DB connection error (${code || 'IO'}), reconnecting in 3s... (${retries} left)`);
      await prisma.$disconnect().catch(() => undefined);
      await new Promise(r => setTimeout(r, 3000));
      await prisma.$connect().catch(() => undefined);
      return withDbRetry(fn, retries - 1);
    }
    throw err;
  }
}

async function main() {
  const isVerifyOnly = process.argv.includes('--verify-only');
  const isReset = process.argv.includes('--reset');

  if (isReset) {
    await resetPitchDemoData();
    return;
  }

  const actors = await withDbRetry(() => loadDemoActors(prisma));

  if (!isVerifyOnly) {
    console.info('🌱 Seeding FoodFactoryERP Pitch-Ready Interconnected Demo Dataset...');
    const ctx = await withDbRetry(() => seedPitchMasterData(prisma, actors.admin.meta));
    await withDbRetry(() => runPitchDemoWorkflows(prisma, ctx, actors));
    console.info('✅ Demo workflows completed.');
  }

  const report = await withDbRetry(() => verifyPitchDemo(prisma, actors.admin.user));
  console.info('\n📊 Pitch Demo Dataset Summary:');
  console.table(report.counts);
  console.info('\n🔍 Verification & Reconciliation Checks:');
  console.table(report.checks);
  console.info('\n🔑 Key Demo Record IDs:', JSON.stringify(report.recordIds, null, 2));

  if (!report.allPassed) {
    console.error('❌ One or more verification checks failed!');
    process.exit(1);
  }
  console.info('\n🎉 All pitch demo checks passed!');
}

main()
  .catch(err => {
    console.error('❌ Pitch demo seed error:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
