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

  await prisma.$transaction(
    async tx => {
    const pitchCustomers = await tx.customer.findMany({ where: { code: { startsWith: 'PITCH-' } }, select: { id: true } });
    const custIds = pitchCustomers.map(c => c.id);

    const pitchSuppliers = await tx.supplier.findMany({ where: { code: { startsWith: 'PITCH-' } }, select: { id: true } });
    const supIds = pitchSuppliers.map(s => s.id);

    const pitchItems = await tx.inventoryItem.findMany({ where: { code: { startsWith: 'PITCH-' } }, select: { id: true } });
    const itemIds = pitchItems.map(i => i.id);

    const pitchBatches = await tx.productionBatch.findMany({ where: { idempotencyKey: { startsWith: 'PITCH-' } }, select: { id: true } });
    const batchIds = pitchBatches.map(b => b.id);

    const pitchWos = await tx.workOrder.findMany({ where: { idempotencyKey: { startsWith: 'PITCH-' } }, select: { id: true } });
    const woIds = pitchWos.map(w => w.id);

    const pitchPlans = await tx.productionPlan.findMany({ where: { idempotencyKey: { startsWith: 'PITCH-' } }, select: { id: true } });
    const planIds = pitchPlans.map(p => p.id);

    const pitchReceipts = itemIds.length > 0
      ? await tx.inventoryReceipt.findMany({
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
      ? await tx.inventoryIssue.findMany({
          where: { lines: { some: { inventoryItemId: { in: itemIds } } } },
          select: { id: true },
        })
      : [];
    const issueIds = pitchIssues.map(i => i.id);

    if (custIds.length > 0) {
      await tx.paymentAllocation.deleteMany({ where: { payment: { customerId: { in: custIds } } } });
      await tx.customerPayment.deleteMany({ where: { customerId: { in: custIds } } });
      await tx.creditNote.deleteMany({ where: { customerId: { in: custIds } } });
      await tx.salesInvoice.deleteMany({ where: { customerId: { in: custIds } } });
      await tx.salesOrder.deleteMany({ where: { customerId: { in: custIds } } });
    }

    if (supIds.length > 0) {
      await tx.supplierInvoiceReceiptMatch.deleteMany({ where: { supplierInvoice: { supplierId: { in: supIds } } } });
      await tx.supplierInvoice.deleteMany({ where: { supplierId: { in: supIds } } });
    }

    if (batchIds.length > 0) {
      await tx.productionBatchCosting.deleteMany({ where: { productionBatchId: { in: batchIds } } });
      await tx.qualityInspection.deleteMany({ where: { productionBatchId: { in: batchIds } } });
      await tx.productionBatch.deleteMany({ where: { id: { in: batchIds } } });
    }
    if (woIds.length > 0) await tx.workOrder.deleteMany({ where: { id: { in: woIds } } });
    if (planIds.length > 0) await tx.productionPlan.deleteMany({ where: { id: { in: planIds } } });

    if (itemIds.length > 0) {
      await tx.inventoryTransactionLine.deleteMany({ where: { inventoryItemId: { in: itemIds } } });
      await tx.inventoryTransaction.deleteMany({
        where: {
          OR: [
            ...(receiptIds.length > 0 ? [{ referenceId: { in: receiptIds } }] : []),
            ...(batchIds.length > 0 ? [{ referenceId: { in: batchIds } }] : []),
            ...(issueIds.length > 0 ? [{ referenceId: { in: issueIds } }] : []),
          ],
        },
      });
      if (receiptIds.length > 0) {
        await tx.inventoryReceipt.deleteMany({ where: { id: { in: receiptIds } } });
      }
      if (issueIds.length > 0) {
        await tx.inventoryIssue.deleteMany({ where: { id: { in: issueIds } } });
      }
      await tx.inventoryBalance.deleteMany({ where: { inventoryItemId: { in: itemIds } } });
      await tx.inventoryBatch.deleteMany({ where: { inventoryItemId: { in: itemIds } } });
    }

    await tx.bOM.deleteMany({ where: { code: { startsWith: 'PITCH-' } } });
    if (itemIds.length > 0) await tx.inventoryItem.deleteMany({ where: { id: { in: itemIds } } });
    await tx.productVariant.deleteMany({ where: { sku: { startsWith: 'PITCH-' } } });
    await tx.product.deleteMany({ where: { code: { startsWith: 'PITCH-' } } });
    await tx.rawMaterial.deleteMany({ where: { code: { startsWith: 'PITCH-' } } });
    await tx.productCategory.deleteMany({ where: { code: { startsWith: 'PITCH-' } } });
    await tx.rawMaterialCategory.deleteMany({ where: { code: { startsWith: 'PITCH-' } } });
    if (custIds.length > 0) await tx.customer.deleteMany({ where: { id: { in: custIds } } });
    if (supIds.length > 0) await tx.supplier.deleteMany({ where: { id: { in: supIds } } });
    await tx.auditLog.deleteMany({ where: { userAgent: 'pitch-demo-seed' } });
    },
    { timeout: 30000 },
  );

  console.info('✅ PITCH-* demo dataset removed cleanly.');
}

async function main() {
  const isVerifyOnly = process.argv.includes('--verify-only');
  const isReset = process.argv.includes('--reset');

  if (isReset) {
    await resetPitchDemoData();
    return;
  }

  const actors = await loadDemoActors(prisma);

  if (!isVerifyOnly) {
    console.info('🌱 Seeding FoodFactoryERP Pitch-Ready Interconnected Demo Dataset...');
    const ctx = await seedPitchMasterData(prisma, actors.admin.meta);
    await runPitchDemoWorkflows(prisma, ctx, actors);
    console.info('✅ Demo workflows completed.');
  }

  const report = await verifyPitchDemo(prisma, actors.admin.user);
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
