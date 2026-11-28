import { PrismaClient } from '@prisma/client';
import { InventoryReceiptService } from '../../src/modules/inventory/inventory-receipt.service';
import type { UserContext } from '../../src/modules/inventory/inventory.utils';
import type { AuditMeta } from '../../src/modules/master-data/master-data.utils';
import { MaterialFgService } from '../../src/modules/production/material-fg.service';
import { ProductionBatchService } from '../../src/modules/production/production-batch.service';
import { ProductionCostingService } from '../../src/modules/production/production-costing.service';
import { ProductionPlanService } from '../../src/modules/production/production-plan.service';
import { WorkOrderService } from '../../src/modules/production/work-order.service';
import { SupplierInvoiceService } from '../../src/modules/purchases/supplier-invoice.service';
import { CreditNoteService } from '../../src/modules/sales/credit-note.service';
import { CustomerPaymentService } from '../../src/modules/sales/customer-payment.service';
import { SalesInvoiceService } from '../../src/modules/sales/sales-invoice.service';
import { SalesService } from '../../src/modules/sales/sales.service';
import type { PitchMasterContext } from './master-data';

export interface RoleActorSet {
  owner: { user: UserContext; meta: AuditMeta };
  admin: { user: UserContext; meta: AuditMeta };
  salesman: { user: UserContext; meta: AuditMeta };
  production: { user: UserContext; meta: AuditMeta };
}

export async function loadDemoActors(prisma: PrismaClient): Promise<RoleActorSet> {
  const usernames = ['demo_owner', 'demo_admin', 'demo_salesman', 'demo_production'];
  const users = await prisma.user.findMany({
    where: { username: { in: usernames } },
    include: {
      userRoles: {
        include: {
          role: {
            include: {
              permissions: { include: { permission: true } },
            },
          },
        },
      },
    },
  });

  const byUsername = new Map(users.map(u => [u.username, u]));
  const makeActor = (uname: string) => {
    const u = byUsername.get(uname);
    if (!u) throw new Error(`Demo user '${uname}' not found. Ensure DEMO_MODE_ENABLED=true and run db:seed.`);
    const roles = u.userRoles.map(ur => ur.role.code);
    const permissions = Array.from(
      new Set(u.userRoles.flatMap(ur => ur.role.permissions.map(rp => rp.permission.code))),
    );
    return {
      user: { userId: u.id, username: u.username, roles, permissions },
      meta: { userId: u.id, ipAddress: '127.0.0.1', userAgent: 'pitch-demo-seed' },
    };
  };

  return {
    owner: makeActor('demo_owner'),
    admin: makeActor('demo_admin'),
    salesman: makeActor('demo_salesman'),
    production: makeActor('demo_production'),
  };
}

async function ensurePostedReceipt(
  prisma: PrismaClient,
  idempotencyKey: string,
  warehouseId: string,
  supplierRef: string,
  notes: string,
  lines: Array<{
    inventoryItemId: string;
    uomId: string;
    quantity: string;
    unitCost: string;
    batchNumber: string;
    manufacturingDate?: string;
    expiryDate?: string;
    notes?: string;
  }>,
  actor: { user: UserContext; meta: AuditMeta },
) {
  const existing = await prisma.inventoryReceipt.findFirst({
    where: { idempotencyKey },
  });
  if (existing) return existing;

  const created = await InventoryReceiptService.create(
    { warehouseId, supplierRef, notes, lines },
    actor.user,
    actor.meta,
  );
  await InventoryReceiptService.submit(created.id, actor.user, actor.meta);
  await InventoryReceiptService.approve(created.id, actor.user, actor.meta);
  return InventoryReceiptService.post(created.id, idempotencyKey, actor.user, actor.meta);
}

async function ensurePostedMatchedSupplierInvoice(
  prisma: PrismaClient,
  supplierInvoiceNumber: string,
  supplierId: string,
  factoryId: string,
  invoiceDate: string,
  receiptIds: string[],
  lines: Array<{ inventoryItemId: string; uomId: string; quantity: string; unitPrice: string; taxRatePercent: string }>,
  actor: { user: UserContext; meta: AuditMeta },
) {
  const existing = await prisma.supplierInvoice.findFirst({
    where: { supplierId, supplierInvoiceNumber },
  });
  if (existing) return existing;

  const draft = await SupplierInvoiceService.createDraft(
    {
      supplierId,
      factoryId,
      supplierInvoiceNumber,
      invoiceDate,
      itcStatus: 'ELIGIBLE',
      lines,
    },
    actor.user,
    actor.meta,
  );
  await SupplierInvoiceService.postInvoice(draft.id, actor.user, actor.meta);
  return SupplierInvoiceService.matchToReceipts(draft.id, { receiptIds }, actor.user, actor.meta);
}

/**
 * Executes the complete interconnected food manufacturing business workflow:
 * 1. Opening Inventory (RM, Packaging, FG)
 * 2. Supplier Purchases & Invoice Matching (including Benchmark 60kg Flour @ Rs 45)
 * 3. Production Plans, Work Orders, Batches, Consumption, Quality Inspection & Costing
 * 4. Sales Orders, Approvals, Fulfillments, GST Invoices, Customer Payments & Credit Note
 */
export async function runPitchDemoWorkflows(
  prisma: PrismaClient,
  ctx: PitchMasterContext,
  actors: RoleActorSet,
) {
  const today = new Date().toISOString().slice(0, 10);
  const mfgDate = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const exp90 = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const exp180 = new Date(Date.now() + 180 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  // ---------------------------------------------------------------------------
  // 1. OPENING INVENTORY (via InventoryReceiptService)
  // ---------------------------------------------------------------------------
  const openingRmItems = [
    { key: 'FLR', item: ctx.rawMaterials.FLOUR, uomId: ctx.uomKgId, qty: '100', cost: '42', batch: 'PITCH-OP-FLR-01', notes: 'Benchmark opening flour' },
    { key: 'OIL', item: ctx.rawMaterials.OIL, uomId: ctx.uomLId, qty: '30', cost: '140', batch: 'PITCH-OP-OIL-01', notes: 'Benchmark opening oil' },
    { key: 'SPC', item: ctx.rawMaterials.SPICE, uomId: ctx.uomKgId, qty: '5', cost: '200', batch: 'PITCH-OP-SPC-01', notes: 'Benchmark opening spice mix' },
    { key: 'BSN', item: ctx.rawMaterials.BESAN, uomId: ctx.uomKgId, qty: '80', cost: '78', batch: 'PITCH-OP-BSN-01' },
    { key: 'RAG', item: ctx.rawMaterials.RAGI, uomId: ctx.uomKgId, qty: '60', cost: '65', batch: 'PITCH-OP-RAG-01' },
    { key: 'BAN', item: ctx.rawMaterials.BANANA, uomId: ctx.uomKgId, qty: '50', cost: '48', batch: 'PITCH-OP-BAN-01' },
  ];
  for (const rm of openingRmItems) {
    await ensurePostedReceipt(
      prisma,
      `PITCH-OPEN-RM-${rm.key}`,
      ctx.whRmId,
      `OPENING-RM-${rm.key}`,
      `Opening raw material stock: ${rm.item.name}`,
      [{ inventoryItemId: rm.item.inventoryItemId, uomId: rm.uomId, quantity: rm.qty, unitCost: rm.cost, batchNumber: rm.batch, notes: rm.notes }],
      actors.admin,
    );
  }

  await ensurePostedReceipt(
    prisma,
    'PITCH-OPEN-PKG-01',
    ctx.whPkgId,
    'OPENING-PKG-2026',
    'Opening packaging stock for Trichy plant',
    [
      { inventoryItemId: ctx.rawMaterials.POUCH.inventoryItemId, uomId: ctx.uomPcsId, quantity: '500', unitCost: '2.50', batchNumber: 'PITCH-OP-PCH-01', notes: 'Benchmark opening pouches' },
      { inventoryItemId: ctx.rawMaterials.CARTON.inventoryItemId, uomId: ctx.uomPcsId, quantity: '30', unitCost: '15', batchNumber: 'PITCH-OP-CTN-01', notes: 'Benchmark opening cartons' },
    ],
    actors.admin,
  );

  const openingFgItems = [
    { key: 'MUR', prod: ctx.products.MURUKKU, qty: '50', cost: '30', batch: 'PITCH-OP-MUR-01', exp: exp90, notes: 'Benchmark opening Murukku 200g' },
    { key: 'RIB', prod: ctx.products.RIBBON, qty: '60', cost: '31', batch: 'PITCH-OP-RIB-01', exp: exp90 },
    { key: 'MIX', prod: ctx.products.MIXTURE, qty: '80', cost: '35', batch: 'PITCH-OP-MIX-01', exp: exp90 },
    { key: 'RAG', prod: ctx.products.RAGI, qty: '40', cost: '82', batch: 'PITCH-OP-RAG-01', exp: exp180 },
    { key: 'BAN', prod: ctx.products.BANANA, qty: '70', cost: '42', batch: 'PITCH-OP-BAN-01', exp: exp90 },
  ];
  for (const fg of openingFgItems) {
    await ensurePostedReceipt(
      prisma,
      `PITCH-OPEN-FG-${fg.key}`,
      ctx.whFgId,
      `OPENING-FG-${fg.key}`,
      `Opening finished goods stock: ${fg.prod.name}`,
      [{ inventoryItemId: fg.prod.inventoryItemId, uomId: ctx.uomPcsId, quantity: fg.qty, unitCost: fg.cost, batchNumber: fg.batch, manufacturingDate: mfgDate, expiryDate: fg.exp, notes: fg.notes }],
      actors.admin,
    );
  }

  // ---------------------------------------------------------------------------
  // 2. BENCHMARK PURCHASE: 60 kg Flour @ Rs 45/kg -> Rs 2,700 + Rs 135 GST
  // ---------------------------------------------------------------------------
  const purFlourReceipt = await ensurePostedReceipt(
    prisma,
    'PITCH-PUR-FLOUR-01',
    ctx.whRmId,
    'SLFM/2026-27/1042',
    'Benchmark purchase: 60 kg Flour from Sri Lakshmi Flour Mills',
    [
      { inventoryItemId: ctx.rawMaterials.FLOUR.inventoryItemId, uomId: ctx.uomKgId, quantity: '60', unitCost: '45', batchNumber: 'PITCH-PUR-FLR-01' },
    ],
    actors.admin,
  );

  await ensurePostedMatchedSupplierInvoice(
    prisma,
    'SLFM/2026-27/1042',
    ctx.suppliers.FLOUR_MILL.id,
    ctx.factoryId,
    today,
    [purFlourReceipt.id],
    [{ inventoryItemId: ctx.rawMaterials.FLOUR.inventoryItemId, uomId: ctx.uomKgId, quantity: '60', unitPrice: '45', taxRatePercent: '5' }],
    actors.admin,
  );

  // ---------------------------------------------------------------------------
  // 3. BENCHMARK PRODUCTION: Murukku 200g (200 planned -> 188 good, 6 damaged pouches)
  //    Must execute BEFORE additional oil/packaging purchases so exact MWAC
  //    (43.125 Flour, 140 Oil, 200 Spice, 2.50 Pouch, 15 Carton -> Rs 4,055) holds!
  // ---------------------------------------------------------------------------
  let plan1 = await prisma.productionPlan.findFirst({
    where: { idempotencyKey: 'PITCH-PLAN-MUR-01' },
    include: { items: true },
  });
  if (!plan1) {
    const createdPlan1 = await ProductionPlanService.createPlan(
      {
        name: 'November Murukku 200g Production Plan',
        warehouseId: ctx.whFgId,
        planDate: today,
        targetStartDate: today,
        targetEndDate: today,
        notes: 'Benchmark Murukku 200g production batch',
        idempotencyKey: 'PITCH-PLAN-MUR-01',
        items: [{ productVariantId: ctx.products.MURUKKU.variantId, plannedQuantity: '200', manualDemandQuantity: '200', demandSources: [] }],
      },
      actors.production.user,
      actors.production.meta,
    );
    await ProductionPlanService.submitPlan(createdPlan1.id, actors.production.user, actors.production.meta);
    await ProductionPlanService.approvePlan(createdPlan1.id, actors.admin.user, actors.admin.meta);
    await ProductionPlanService.releasePlan(createdPlan1.id, actors.production.user, actors.production.meta);
    plan1 = await prisma.productionPlan.findUniqueOrThrow({ where: { id: createdPlan1.id }, include: { items: true } });
  }

  let wo1 = await prisma.workOrder.findFirst({ where: { idempotencyKey: 'PITCH-WO-MUR-01' } });
  if (!wo1) {
    const createdWo1 = await WorkOrderService.createWorkOrder(
      {
        productionPlanId: plan1.id,
        productionPlanItemId: plan1.items[0].id,
        plannedQuantity: '200',
        priority: 'HIGH',
        productionLine: 'Line A - Traditional Fryer',
        assignedToId: actors.production.user.userId,
        notes: 'Murukku 200g Benchmark Work Order',
        idempotencyKey: 'PITCH-WO-MUR-01',
      },
      actors.production.user,
      actors.production.meta,
    );
    await WorkOrderService.submitWorkOrder(createdWo1.id, actors.production.user, actors.production.meta);
    await WorkOrderService.approveWorkOrder(createdWo1.id, actors.admin.user, actors.admin.meta);
    await WorkOrderService.releaseWorkOrder(createdWo1.id, actors.production.user, actors.production.meta);
    wo1 = createdWo1;
  }

  let batch1 = await prisma.productionBatch.findFirst({ where: { idempotencyKey: 'PITCH-BATCH-MUR-01' } });
  if (!batch1) {
    const createdBatch1 = await ProductionBatchService.createBatch(
      {
        workOrderId: wo1.id,
        plannedQuantity: '200',
        notes: 'Benchmark Murukku 200g Batch',
        idempotencyKey: 'PITCH-BATCH-MUR-01',
      },
      actors.production.user,
      actors.production.meta,
    );
    await ProductionBatchService.startBatch(createdBatch1.id, actors.production.user, actors.production.meta);
    await ProductionBatchService.consumeMaterials(
      createdBatch1.id,
      {
        idempotencyKey: 'PITCH-CONS-MUR-01',
        lines: [
          { inventoryItemId: ctx.rawMaterials.FLOUR.inventoryItemId, warehouseId: ctx.whRmId, uomId: ctx.uomKgId, quantity: '40' },
          { inventoryItemId: ctx.rawMaterials.OIL.inventoryItemId, warehouseId: ctx.whRmId, uomId: ctx.uomLId, quantity: '10.5' },
          { inventoryItemId: ctx.rawMaterials.SPICE.inventoryItemId, warehouseId: ctx.whRmId, uomId: ctx.uomKgId, quantity: '1.2' },
          { inventoryItemId: ctx.rawMaterials.POUCH.inventoryItemId, warehouseId: ctx.whPkgId, uomId: ctx.uomPcsId, quantity: '194' },
          { inventoryItemId: ctx.rawMaterials.CARTON.inventoryItemId, warehouseId: ctx.whPkgId, uomId: ctx.uomPcsId, quantity: '9' },
        ],
      },
      actors.production.user,
      actors.production.meta,
    );
    await ProductionBatchService.recordOutput(
      createdBatch1.id,
      {
        goodQuantity: '188',
        rejectedQuantity: '0',
        wastageQuantity: '12',
        wastageReason: '6 damaged pouches and 6 packets equivalent frying loss',
      },
      actors.production.user,
      actors.production.meta,
    );
    const comp1 = await ProductionBatchService.completeBatch(
      createdBatch1.id,
      { goodQuantity: '188', manufacturingDate: today },
      actors.production.user,
      actors.production.meta,
    );
    await MaterialFgService.inspectQuality(
      comp1.qualityInspection!.id,
      { decision: 'ACCEPTED', notes: 'Crispness, moisture and seal integrity verified' },
      actors.production.user,
      actors.production.meta,
    );

    // Costing: Labour Rs 1,200 + Gas/Electricity Rs 600 -> Total Rs 5,855 (Rs 31.14/pkt)
    const ce1 = await ProductionCostingService.addCostEntry(
      createdBatch1.id,
      { entryType: 'DIRECT_LABOUR', description: 'Frying & Packing Crew Labour', quantityOrHours: '1', rate: '1200' },
      actors.production.user,
      actors.production.meta,
    );
    const ce2 = await ProductionCostingService.addCostEntry(
      createdBatch1.id,
      { entryType: 'OTHER_DIRECT_EXPENSE', description: 'Gas & Electricity Utilities', quantityOrHours: '1', rate: '600' },
      actors.production.user,
      actors.production.meta,
    );
    await ProductionCostingService.reviewCostEntry(ce1.id, { decision: 'APPROVED' }, actors.admin.user, actors.admin.meta);
    await ProductionCostingService.reviewCostEntry(ce2.id, { decision: 'APPROVED' }, actors.admin.user, actors.admin.meta);
    await ProductionCostingService.calculateBatchCosting(
      createdBatch1.id,
      { includeBomOverheads: false },
      actors.admin.user,
      actors.admin.meta,
    );
    await ProductionCostingService.reviewBatchCosting(
      createdBatch1.id,
      { remarks: 'Reviewed benchmark batch costing' },
      actors.admin.user,
      actors.admin.meta,
    );
    await ProductionCostingService.finalizeBatchCosting(
      createdBatch1.id,
      { remarks: 'Finalized Murukku 200g benchmark costing' },
      actors.owner.user,
      actors.owner.meta,
    );
    batch1 = await prisma.productionBatch.findUniqueOrThrow({ where: { id: createdBatch1.id } });
  }

  // ---------------------------------------------------------------------------
  // 4. ADDITIONAL PURCHASES (Scenario E - after Benchmark Batch 1 so MWAC stays exact)
  // ---------------------------------------------------------------------------
  const purOilReceipt = await ensurePostedReceipt(
    prisma,
    'PITCH-PUR-OIL-01',
    ctx.whRmId,
    'SEO/2026-27/308',
    'Refined Sunflower Oil replenishment from Southern Edible Oils',
    [{ inventoryItemId: ctx.rawMaterials.OIL.inventoryItemId, uomId: ctx.uomLId, quantity: '50', unitCost: '142', batchNumber: 'PITCH-PUR-OIL-01' }],
    actors.admin,
  );
  await ensurePostedMatchedSupplierInvoice(
    prisma,
    'SEO/2026-27/308',
    ctx.suppliers.EDIBLE_OIL.id,
    ctx.factoryId,
    today,
    [purOilReceipt.id],
    [{ inventoryItemId: ctx.rawMaterials.OIL.inventoryItemId, uomId: ctx.uomLId, quantity: '50', unitPrice: '142', taxRatePercent: '5' }],
    actors.admin,
  );

  const purPkgReceipt = await ensurePostedReceipt(
    prisma,
    'PITCH-PUR-PKG-01',
    ctx.whPkgId,
    'APS/2026-27/815',
    'Printed pouches & cartons from Annapoorna Packaging Solutions',
    [
      { inventoryItemId: ctx.rawMaterials.POUCH.inventoryItemId, uomId: ctx.uomPcsId, quantity: '400', unitCost: '2.50', batchNumber: 'PITCH-PUR-PCH-01' },
      { inventoryItemId: ctx.rawMaterials.CARTON.inventoryItemId, uomId: ctx.uomPcsId, quantity: '40', unitCost: '15', batchNumber: 'PITCH-PUR-CTN-01' },
    ],
    actors.admin,
  );
  await ensurePostedMatchedSupplierInvoice(
    prisma,
    'APS/2026-27/815',
    ctx.suppliers.PACKAGING.id,
    ctx.factoryId,
    today,
    [purPkgReceipt.id],
    [
      { inventoryItemId: ctx.rawMaterials.POUCH.inventoryItemId, uomId: ctx.uomPcsId, quantity: '400', unitPrice: '2.50', taxRatePercent: '18' },
      { inventoryItemId: ctx.rawMaterials.CARTON.inventoryItemId, uomId: ctx.uomPcsId, quantity: '40', unitPrice: '15', taxRatePercent: '18' },
    ],
    actors.admin,
  );

  const purSpiceReceipt = await ensurePostedReceipt(
    prisma,
    'PITCH-PUR-SPC-01',
    ctx.whRmId,
    'KSI/2026-27/519',
    'Spices & Besan from Kongu Spices & Ingredients',
    [
      { inventoryItemId: ctx.rawMaterials.SPICE.inventoryItemId, uomId: ctx.uomKgId, quantity: '20', unitCost: '195', batchNumber: 'PITCH-PUR-SPC-01' },
      { inventoryItemId: ctx.rawMaterials.BESAN.inventoryItemId, uomId: ctx.uomKgId, quantity: '40', unitCost: '80', batchNumber: 'PITCH-PUR-BSN-01' },
    ],
    actors.admin,
  );
  await ensurePostedMatchedSupplierInvoice(
    prisma,
    'KSI/2026-27/519',
    ctx.suppliers.SPICES.id,
    ctx.factoryId,
    today,
    [purSpiceReceipt.id],
    [
      { inventoryItemId: ctx.rawMaterials.SPICE.inventoryItemId, uomId: ctx.uomKgId, quantity: '20', unitPrice: '195', taxRatePercent: '5' },
      { inventoryItemId: ctx.rawMaterials.BESAN.inventoryItemId, uomId: ctx.uomKgId, quantity: '40', unitPrice: '80', taxRatePercent: '5' },
    ],
    actors.admin,
  );

  // ---------------------------------------------------------------------------
  // 5. ADDITIONAL PRODUCTION BATCHES (Scenario D: Ribbon Pakoda, Spicy Mixture, Ragi WIP)
  // ---------------------------------------------------------------------------
  let plan2 = await prisma.productionPlan.findFirst({
    where: { idempotencyKey: 'PITCH-PLAN-SAV-02' },
    include: { items: true },
  });
  if (!plan2) {
    const createdPlan2 = await ProductionPlanService.createPlan(
      {
        name: 'Ribbon Pakoda & Spicy Mixture Weekly Plan',
        warehouseId: ctx.whFgId,
        planDate: today,
        targetStartDate: today,
        targetEndDate: today,
        idempotencyKey: 'PITCH-PLAN-SAV-02',
        items: [
          { productVariantId: ctx.products.RIBBON.variantId, plannedQuantity: '150', manualDemandQuantity: '150', demandSources: [] },
          { productVariantId: ctx.products.MIXTURE.variantId, plannedQuantity: '120', manualDemandQuantity: '120', demandSources: [] },
        ],
      },
      actors.production.user,
      actors.production.meta,
    );
    await ProductionPlanService.submitPlan(createdPlan2.id, actors.production.user, actors.production.meta);
    await ProductionPlanService.approvePlan(createdPlan2.id, actors.admin.user, actors.admin.meta);
    await ProductionPlanService.releasePlan(createdPlan2.id, actors.production.user, actors.production.meta);
    plan2 = await prisma.productionPlan.findUniqueOrThrow({ where: { id: createdPlan2.id }, include: { items: true } });
  }

  // Batch 2: Ribbon Pakoda (uses BOM v2!)
  let wo2 = await prisma.workOrder.findFirst({ where: { idempotencyKey: 'PITCH-WO-RIB-02' } });
  if (!wo2) {
    const ribItem = plan2.items.find(i => i.productVariantId === ctx.products.RIBBON.variantId)!;
    const createdWo2 = await WorkOrderService.createWorkOrder(
      {
        productionPlanId: plan2.id,
        productionPlanItemId: ribItem.id,
        plannedQuantity: '150',
        priority: 'NORMAL',
        productionLine: 'Line B - Extruder',
        assignedToId: actors.production.user.userId,
        idempotencyKey: 'PITCH-WO-RIB-02',
      },
      actors.production.user,
      actors.production.meta,
    );
    await WorkOrderService.submitWorkOrder(createdWo2.id, actors.production.user, actors.production.meta);
    await WorkOrderService.approveWorkOrder(createdWo2.id, actors.admin.user, actors.admin.meta);
    await WorkOrderService.releaseWorkOrder(createdWo2.id, actors.production.user, actors.production.meta);
    wo2 = createdWo2;
  }

  if (!(await prisma.productionBatch.findFirst({ where: { idempotencyKey: 'PITCH-BATCH-RIB-02' } }))) {
    const b2 = await ProductionBatchService.createBatch(
      { workOrderId: wo2.id, plannedQuantity: '150', idempotencyKey: 'PITCH-BATCH-RIB-02' },
      actors.production.user,
      actors.production.meta,
    );
    await ProductionBatchService.startBatch(b2.id, actors.production.user, actors.production.meta);
    await ProductionBatchService.consumeMaterials(
      b2.id,
      {
        idempotencyKey: 'PITCH-CONS-RIB-02',
        lines: [
          { inventoryItemId: ctx.rawMaterials.BESAN.inventoryItemId, warehouseId: ctx.whRmId, uomId: ctx.uomKgId, quantity: '22' },
          { inventoryItemId: ctx.rawMaterials.FLOUR.inventoryItemId, warehouseId: ctx.whRmId, uomId: ctx.uomKgId, quantity: '10' },
          { inventoryItemId: ctx.rawMaterials.OIL.inventoryItemId, warehouseId: ctx.whRmId, uomId: ctx.uomLId, quantity: '7' },
          { inventoryItemId: ctx.rawMaterials.SPICE.inventoryItemId, warehouseId: ctx.whRmId, uomId: ctx.uomKgId, quantity: '1.2' },
          { inventoryItemId: ctx.rawMaterials.POUCH.inventoryItemId, warehouseId: ctx.whPkgId, uomId: ctx.uomPcsId, quantity: '148' },
          { inventoryItemId: ctx.rawMaterials.CARTON.inventoryItemId, warehouseId: ctx.whPkgId, uomId: ctx.uomPcsId, quantity: '7' },
        ],
      },
      actors.production.user,
      actors.production.meta,
    );
    await ProductionBatchService.recordOutput(
      b2.id,
      { goodQuantity: '145', rejectedQuantity: '0', wastageQuantity: '5', wastageReason: 'Extruder startup trimmings' },
      actors.production.user,
      actors.production.meta,
    );
    const comp2 = await ProductionBatchService.completeBatch(b2.id, { goodQuantity: '145', manufacturingDate: today }, actors.production.user, actors.production.meta);
    await MaterialFgService.inspectQuality(comp2.qualityInspection!.id, { decision: 'ACCEPTED', notes: 'Approved Ribbon Pakoda batch' }, actors.production.user, actors.production.meta);
    const ceRib = await ProductionCostingService.addCostEntry(b2.id, { entryType: 'DIRECT_LABOUR', description: 'Line B Labour', quantityOrHours: '1', rate: '900' }, actors.production.user, actors.production.meta);
    await ProductionCostingService.reviewCostEntry(ceRib.id, { decision: 'APPROVED' }, actors.admin.user, actors.admin.meta);
    await ProductionCostingService.calculateBatchCosting(b2.id, { includeBomOverheads: false }, actors.admin.user, actors.admin.meta);
    await ProductionCostingService.reviewBatchCosting(b2.id, { remarks: 'Reviewed Ribbon Pakoda batch' }, actors.admin.user, actors.admin.meta);
    await ProductionCostingService.finalizeBatchCosting(b2.id, { remarks: 'Finalized Ribbon Pakoda batch' }, actors.owner.user, actors.owner.meta);
  }

  // Batch 3: Spicy Mixture (uses same Plan 2, second Work Order -> 120 planned, 116 good)
  let wo3 = await prisma.workOrder.findFirst({ where: { idempotencyKey: 'PITCH-WO-MIX-03' } });
  if (!wo3) {
    const mixItem = plan2.items.find(i => i.productVariantId === ctx.products.MIXTURE.variantId)!;
    const createdWo3 = await WorkOrderService.createWorkOrder(
      {
        productionPlanId: plan2.id,
        productionPlanItemId: mixItem.id,
        plannedQuantity: '120',
        priority: 'NORMAL',
        productionLine: 'Line B - Extruder',
        assignedToId: actors.production.user.userId,
        idempotencyKey: 'PITCH-WO-MIX-03',
      },
      actors.production.user,
      actors.production.meta,
    );
    await WorkOrderService.submitWorkOrder(createdWo3.id, actors.production.user, actors.production.meta);
    await WorkOrderService.approveWorkOrder(createdWo3.id, actors.admin.user, actors.admin.meta);
    await WorkOrderService.releaseWorkOrder(createdWo3.id, actors.production.user, actors.production.meta);
    wo3 = createdWo3;
  }

  if (!(await prisma.productionBatch.findFirst({ where: { idempotencyKey: 'PITCH-BATCH-MIX-03' } }))) {
    const b3 = await ProductionBatchService.createBatch(
      { workOrderId: wo3.id, plannedQuantity: '120', idempotencyKey: 'PITCH-BATCH-MIX-03' },
      actors.production.user,
      actors.production.meta,
    );
    await ProductionBatchService.startBatch(b3.id, actors.production.user, actors.production.meta);
    await ProductionBatchService.consumeMaterials(
      b3.id,
      {
        idempotencyKey: 'PITCH-CONS-MIX-03',
        lines: [
          { inventoryItemId: ctx.rawMaterials.BESAN.inventoryItemId, warehouseId: ctx.whRmId, uomId: ctx.uomKgId, quantity: '20' },
          { inventoryItemId: ctx.rawMaterials.OIL.inventoryItemId, warehouseId: ctx.whRmId, uomId: ctx.uomLId, quantity: '6' },
          { inventoryItemId: ctx.rawMaterials.SPICE.inventoryItemId, warehouseId: ctx.whRmId, uomId: ctx.uomKgId, quantity: '1.5' },
          { inventoryItemId: ctx.rawMaterials.POUCH.inventoryItemId, warehouseId: ctx.whPkgId, uomId: ctx.uomPcsId, quantity: '118' },
          { inventoryItemId: ctx.rawMaterials.CARTON.inventoryItemId, warehouseId: ctx.whPkgId, uomId: ctx.uomPcsId, quantity: '6' },
        ],
      },
      actors.production.user,
      actors.production.meta,
    );
    await ProductionBatchService.recordOutput(
      b3.id,
      { goodQuantity: '116', rejectedQuantity: '0', wastageQuantity: '4', wastageReason: 'Sieve fines loss' },
      actors.production.user,
      actors.production.meta,
    );
    const comp3 = await ProductionBatchService.completeBatch(b3.id, { goodQuantity: '116', manufacturingDate: today }, actors.production.user, actors.production.meta);
    await MaterialFgService.inspectQuality(comp3.qualityInspection!.id, { decision: 'ACCEPTED', notes: 'Approved Spicy Mixture batch' }, actors.production.user, actors.production.meta);
    const ceMix = await ProductionCostingService.addCostEntry(b3.id, { entryType: 'DIRECT_LABOUR', description: 'Blending & Packing Labour', quantityOrHours: '1', rate: '800' }, actors.production.user, actors.production.meta);
    await ProductionCostingService.reviewCostEntry(ceMix.id, { decision: 'APPROVED' }, actors.admin.user, actors.admin.meta);
    await ProductionCostingService.calculateBatchCosting(b3.id, { includeBomOverheads: false }, actors.admin.user, actors.admin.meta);
  }

  // Plan 3 / WO 4 / Batch 4: Ragi Health Mix (IN_PROGRESS on shop floor)
  let plan3 = await prisma.productionPlan.findFirst({
    where: { idempotencyKey: 'PITCH-PLAN-RAG-03' },
    include: { items: true },
  });
  if (!plan3) {
    const createdPlan3 = await ProductionPlanService.createPlan(
      {
        name: 'Ragi Health Mix Roasting Plan',
        warehouseId: ctx.whFgId,
        planDate: today,
        targetStartDate: today,
        targetEndDate: today,
        idempotencyKey: 'PITCH-PLAN-RAG-03',
        items: [{ productVariantId: ctx.products.RAGI.variantId, plannedQuantity: '100', manualDemandQuantity: '100', demandSources: [] }],
      },
      actors.production.user,
      actors.production.meta,
    );
    await ProductionPlanService.submitPlan(createdPlan3.id, actors.production.user, actors.production.meta);
    await ProductionPlanService.approvePlan(createdPlan3.id, actors.admin.user, actors.admin.meta);
    await ProductionPlanService.releasePlan(createdPlan3.id, actors.production.user, actors.production.meta);
    plan3 = await prisma.productionPlan.findUniqueOrThrow({ where: { id: createdPlan3.id }, include: { items: true } });
  }

  let wo4 = await prisma.workOrder.findFirst({ where: { idempotencyKey: 'PITCH-WO-RAG-04' } });
  if (!wo4) {
    const createdWo4 = await WorkOrderService.createWorkOrder(
      {
        productionPlanId: plan3.id,
        productionPlanItemId: plan3.items[0].id,
        plannedQuantity: '100',
        priority: 'NORMAL',
        productionLine: 'Line C - Roaster',
        assignedToId: actors.production.user.userId,
        idempotencyKey: 'PITCH-WO-RAG-04',
      },
      actors.production.user,
      actors.production.meta,
    );
    await WorkOrderService.submitWorkOrder(createdWo4.id, actors.production.user, actors.production.meta);
    await WorkOrderService.approveWorkOrder(createdWo4.id, actors.admin.user, actors.admin.meta);
    await WorkOrderService.releaseWorkOrder(createdWo4.id, actors.production.user, actors.production.meta);
    wo4 = createdWo4;
  }

  if (!(await prisma.productionBatch.findFirst({ where: { idempotencyKey: 'PITCH-BATCH-RAG-04' } }))) {
    const b4 = await ProductionBatchService.createBatch(
      { workOrderId: wo4.id, plannedQuantity: '100', idempotencyKey: 'PITCH-BATCH-RAG-04' },
      actors.production.user,
      actors.production.meta,
    );
    await ProductionBatchService.startBatch(b4.id, actors.production.user, actors.production.meta);
    await ProductionBatchService.consumeMaterials(
      b4.id,
      {
        idempotencyKey: 'PITCH-CONS-RAG-04',
        lines: [
          { inventoryItemId: ctx.rawMaterials.RAGI.inventoryItemId, warehouseId: ctx.whRmId, uomId: ctx.uomKgId, quantity: '45' },
          { inventoryItemId: ctx.rawMaterials.FLOUR.inventoryItemId, warehouseId: ctx.whRmId, uomId: ctx.uomKgId, quantity: '5' },
          { inventoryItemId: ctx.rawMaterials.POUCH.inventoryItemId, warehouseId: ctx.whPkgId, uomId: ctx.uomPcsId, quantity: '100' },
          { inventoryItemId: ctx.rawMaterials.CARTON.inventoryItemId, warehouseId: ctx.whPkgId, uomId: ctx.uomPcsId, quantity: '5' },
        ],
      },
      actors.production.user,
      actors.production.meta,
    );
  }

  // ---------------------------------------------------------------------------
  // 6. SALES ORDERS, INVOICES, PAYMENTS & CREDIT NOTE
  // ---------------------------------------------------------------------------
  // SO 1: Benchmark Retailer A (Sri Annapoorna Stores) — 150 Murukku 200g -> Rs 7,875 -> Rs 4,000 paid
  let so1 = await prisma.salesOrder.findFirst({ where: { idempotencyKey: 'PITCH-SO-RETAILER-A' }, include: { lines: true } });
  if (!so1) {
    const c1 = await SalesService.createOrder(
      {
        customerId: ctx.customers.RETAILER_A.id,
        warehouseId: ctx.whFgId,
        orderDate: today,
        notes: 'Benchmark Retailer A order: 150 packets Murukku 200g',
        idempotencyKey: 'PITCH-SO-RETAILER-A',
        lines: [{ productVariantId: ctx.products.MURUKKU.variantId, uomId: ctx.uomPcsId, orderedQuantity: '150' }],
      },
      actors.salesman.user,
      actors.salesman.meta,
    );
    await SalesService.submitOrder(c1.id, actors.salesman.user, actors.salesman.meta);
    await SalesService.approveOrder(c1.id, actors.admin.user, actors.admin.meta);
    await SalesService.confirmOrder(c1.id, 'PITCH-CONF-SO-1', actors.admin.user, actors.admin.meta);
    await SalesService.fulfillOrder(
      c1.id,
      { idempotencyKey: 'PITCH-FUL-SO-1', lines: [{ salesOrderLineId: c1.lines[0].id, quantity: '150' }] },
      actors.admin.user,
      actors.admin.meta,
    );
    so1 = await prisma.salesOrder.findUniqueOrThrow({ where: { id: c1.id }, include: { lines: true } });
  }

  let inv1 = await prisma.salesInvoice.findFirst({ where: { idempotencyKey: 'PITCH-INV-RETAILER-A' }, include: { lines: true } });
  if (!inv1) {
    const cInv1 = await SalesInvoiceService.createInvoiceFromOrder(
      so1.id,
      { invoiceDate: today, idempotencyKey: 'PITCH-INV-RETAILER-A' },
      actors.admin.user,
      actors.admin.meta,
    );
    await SalesInvoiceService.issueInvoice(cInv1.id, actors.admin.user, actors.admin.meta);
    inv1 = await prisma.salesInvoice.findUniqueOrThrow({ where: { id: cInv1.id }, include: { lines: true } });

    await CustomerPaymentService.createPayment(
      {
        customerId: ctx.customers.RETAILER_A.id,
        amount: '4000',
        paymentDate: today,
        paymentMode: 'BANK_TRANSFER',
        transactionReference: 'UTR-PITCH-RETAILER-A-01',
        notes: 'Part payment against Murukku 200g invoice',
        idempotencyKey: 'PITCH-PAY-RETAILER-A-01',
        allocations: [{ salesInvoiceId: inv1.id, allocatedAmount: '4000' }],
      },
      actors.salesman.user,
      actors.salesman.meta,
    );
  }

  // SO 2: Benchmark Distributor B (Kaveri Wholesale Mart) — 120 Murukku 200g -> APPROVED (Shortage: 88 avail, 32 short)
  const so2 = await prisma.salesOrder.findFirst({ where: { idempotencyKey: 'PITCH-SO-DIST-B' } });
  if (!so2) {
    const c2 = await SalesService.createOrder(
      {
        customerId: ctx.customers.DIST_B.id,
        warehouseId: ctx.whFgId,
        orderDate: today,
        notes: 'Benchmark Distributor B order: 120 packets Murukku 200g (88 available, 32 short)',
        idempotencyKey: 'PITCH-SO-DIST-B',
        lines: [{ productVariantId: ctx.products.MURUKKU.variantId, uomId: ctx.uomPcsId, orderedQuantity: '120' }],
      },
      actors.salesman.user,
      actors.salesman.meta,
    );
    await SalesService.submitOrder(c2.id, actors.salesman.user, actors.salesman.meta);
    await SalesService.approveOrder(c2.id, actors.admin.user, actors.admin.meta);
  }

  // Helper for additional fulfilled + invoiced orders
  async function ensureFulfilledOrderAndInvoice(
    orderKey: string,
    invKey: string,
    customerId: string,
    notes: string,
    lines: Array<{ productVariantId: string; quantity: string }>,
  ) {
    let so = await prisma.salesOrder.findFirst({ where: { idempotencyKey: orderKey }, include: { lines: true } });
    if (!so) {
      const created = await SalesService.createOrder(
        {
          customerId,
          warehouseId: ctx.whFgId,
          orderDate: today,
          notes,
          idempotencyKey: orderKey,
          lines: lines.map(l => ({ productVariantId: l.productVariantId, uomId: ctx.uomPcsId, orderedQuantity: l.quantity })),
        },
        actors.salesman.user,
        actors.salesman.meta,
      );
      await SalesService.submitOrder(created.id, actors.salesman.user, actors.salesman.meta);
      await SalesService.approveOrder(created.id, actors.admin.user, actors.admin.meta);
      await SalesService.confirmOrder(created.id, `${orderKey}-CONF`, actors.admin.user, actors.admin.meta);
      await SalesService.fulfillOrder(
        created.id,
        {
          idempotencyKey: `${orderKey}-FUL`,
          lines: created.lines.map((ol: { id: string }, idx: number) => ({
            salesOrderLineId: ol.id,
            quantity: lines[idx].quantity,
          })),
        },
        actors.admin.user,
        actors.admin.meta,
      );
      so = await prisma.salesOrder.findUniqueOrThrow({ where: { id: created.id }, include: { lines: true } });
    }

    let inv = await prisma.salesInvoice.findFirst({ where: { idempotencyKey: invKey }, include: { lines: true } });
    if (!inv) {
      const createdInv = await SalesInvoiceService.createInvoiceFromOrder(
        so.id,
        { invoiceDate: today, idempotencyKey: invKey },
        actors.admin.user,
        actors.admin.meta,
      );
      await SalesInvoiceService.issueInvoice(createdInv.id, actors.admin.user, actors.admin.meta);
      inv = await prisma.salesInvoice.findUniqueOrThrow({ where: { id: createdInv.id }, include: { lines: true } });
    }
    return { so, inv };
  }

  // SO 3 (Scenario A): Green Basket Retailers — 80 Ribbon Pakoda 200g -> Rs 4,620 -> Fully Paid
  const { inv: inv3 } = await ensureFulfilledOrderAndInvoice(
    'PITCH-SO-GREEN-03',
    'PITCH-INV-GREEN-03',
    ctx.customers.GREEN_BASKET.id,
    'Scenario A: Fully settled retail order for Ribbon Pakoda 200g',
    [{ productVariantId: ctx.products.RIBBON.variantId, quantity: '80' }],
  );
  if (!(await prisma.customerPayment.findUnique({ where: { idempotencyKey: 'PITCH-PAY-GREEN-03' } }))) {
    await CustomerPaymentService.createPayment(
      {
        customerId: ctx.customers.GREEN_BASKET.id,
        amount: inv3.grandTotal.toString(),
        paymentDate: today,
        paymentMode: 'UPI',
        transactionReference: 'UPI-PITCH-GB-03',
        notes: 'Full settlement for Ribbon Pakoda invoice',
        idempotencyKey: 'PITCH-PAY-GREEN-03',
        allocations: [{ salesInvoiceId: inv3.id, allocatedAmount: inv3.grandTotal.toString() }],
      },
      actors.salesman.user,
      actors.salesman.meta,
    );
  }

  // SO 4 (Scenario B & F): Lakshmi Supermarket — 100 Spicy Mixture 200g -> Rs 6,825 -> 2 partial payments (3000 + 2500) + Credit Note (10 pkts = Rs 682.50)
  const { inv: inv4 } = await ensureFulfilledOrderAndInvoice(
    'PITCH-SO-LAKSHMI-04',
    'PITCH-INV-LAKSHMI-04',
    ctx.customers.LAKSHMI_MART.id,
    'Scenario B & F: Multiple partial payments and transit damage credit note',
    [{ productVariantId: ctx.products.MIXTURE.variantId, quantity: '100' }],
  );
  if (!(await prisma.customerPayment.findUnique({ where: { idempotencyKey: 'PITCH-PAY-LAKSHMI-04A' } }))) {
    await CustomerPaymentService.createPayment(
      {
        customerId: ctx.customers.LAKSHMI_MART.id,
        amount: '3000',
        paymentDate: today,
        paymentMode: 'NEFT_RTGS',
        transactionReference: 'NEFT-PITCH-LM-04A',
        notes: 'First installment payment',
        idempotencyKey: 'PITCH-PAY-LAKSHMI-04A',
        allocations: [{ salesInvoiceId: inv4.id, allocatedAmount: '3000' }],
      },
      actors.salesman.user,
      actors.salesman.meta,
    );
  }
  if (!(await prisma.customerPayment.findUnique({ where: { idempotencyKey: 'PITCH-PAY-LAKSHMI-04B' } }))) {
    await CustomerPaymentService.createPayment(
      {
        customerId: ctx.customers.LAKSHMI_MART.id,
        amount: '2500',
        paymentDate: today,
        paymentMode: 'UPI',
        transactionReference: 'UPI-PITCH-LM-04B',
        notes: 'Second installment payment',
        idempotencyKey: 'PITCH-PAY-LAKSHMI-04B',
        allocations: [{ salesInvoiceId: inv4.id, allocatedAmount: '2500' }],
      },
      actors.salesman.user,
      actors.salesman.meta,
    );
  }
  if (!(await prisma.creditNote.findUnique({ where: { idempotencyKey: 'PITCH-CN-LAKSHMI-04' } }))) {
    const cn = await CreditNoteService.createDraft(
      {
        salesInvoiceId: inv4.id,
        creditNoteDate: today,
        reason: '10 packets damaged in outer carton during Chennai transit',
        idempotencyKey: 'PITCH-CN-LAKSHMI-04',
        lines: [{ originalInvoiceLineId: inv4.lines[0].id, quantity: '10' }],
      },
      actors.admin.user,
      actors.admin.meta,
    );
    await CreditNoteService.issueCreditNote(cn.id, actors.admin.user, actors.admin.meta);
  }

  // SO 5 & SO 6 (Scenario C): Chennai Food Distributors — Multiple orders across products
  const { inv: inv5 } = await ensureFulfilledOrderAndInvoice(
    'PITCH-SO-CHENNAI-05',
    'PITCH-INV-CHENNAI-05',
    ctx.customers.CHENNAI_DIST.id,
    'Scenario C (Order 1): Ragi Health Mix 500g wholesale order',
    [{ productVariantId: ctx.products.RAGI.variantId, quantity: '60' }],
  );
  if (!(await prisma.customerPayment.findUnique({ where: { idempotencyKey: 'PITCH-PAY-CHENNAI-05' } }))) {
    await CustomerPaymentService.createPayment(
      {
        customerId: ctx.customers.CHENNAI_DIST.id,
        amount: inv5.grandTotal.toString(),
        paymentDate: today,
        paymentMode: 'BANK_TRANSFER',
        transactionReference: 'RTGS-PITCH-CFD-05',
        notes: 'Full payment for Ragi Health Mix order',
        idempotencyKey: 'PITCH-PAY-CHENNAI-05',
        allocations: [{ salesInvoiceId: inv5.id, allocatedAmount: inv5.grandTotal.toString() }],
      },
      actors.admin.user,
      actors.admin.meta,
    );
  }

  const { inv: inv6 } = await ensureFulfilledOrderAndInvoice(
    'PITCH-SO-CHENNAI-06',
    'PITCH-INV-CHENNAI-06',
    ctx.customers.CHENNAI_DIST.id,
    'Scenario C (Order 2): Banana Chips 200g (12% GST)',
    [{ productVariantId: ctx.products.BANANA.variantId, quantity: '50' }],
  );
  if (!(await prisma.customerPayment.findUnique({ where: { idempotencyKey: 'PITCH-PAY-CHENNAI-06' } }))) {
    await CustomerPaymentService.createPayment(
      {
        customerId: ctx.customers.CHENNAI_DIST.id,
        amount: '2000',
        paymentDate: today,
        paymentMode: 'CHEQUE',
        transactionReference: 'CHQ-PITCH-CFD-06',
        notes: 'Advance cheque against Banana Chips invoice',
        idempotencyKey: 'PITCH-PAY-CHENNAI-06',
        allocations: [{ salesInvoiceId: inv6.id, allocatedAmount: '2000' }],
      },
      actors.admin.user,
      actors.admin.meta,
    );
  }

  return { batch1Id: batch1.id, so1Id: so1.id, inv1Id: inv1.id };
}
