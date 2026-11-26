import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app';
import { prisma } from '../src/services/prisma.service';
import { hashPassword } from '../src/utils/password';
import { generateAccessToken } from '../src/utils/token';

const app = createApp();

describe('Phase 9 Smart Warehouse, Bin Locations & Barcode Operations Suite', () => {
  let adminToken: string;
  let restrictedToken: string;
  let wh1Id: string;
  let wh2Id: string;
  let zone1Id: string;
  let rack1Id: string;
  let shelf1Id: string;
  let bin1Id: string;
  let bin2Id: string;
  let qBinId: string;
  let itemId: string;
  let uomId: string;
  let acceptedBatchId: string;
  let quarantinedBatchId: string;
  const suffix = Date.now().toString().slice(-6);

  async function buildUser(username: string, roleCode: string) {
    const pw = await hashPassword('Phase9Pass!2026');
    const role = await prisma.role.findUnique({
      where: { code: roleCode },
      include: { permissions: { include: { permission: true } } },
    });
    if (!role) throw new Error(`Role ${roleCode} not found`);

    const user = await prisma.user.upsert({
      where: { username },
      update: { passwordHash: pw, isActive: true, registrationStatus: 'APPROVED' },
      create: {
        email: `${username}@foodfactory.com`,
        username,
        passwordHash: pw,
        fullName: `Phase9 ${roleCode}`,
        isActive: true,
        registrationStatus: 'APPROVED',
        userRoles: { create: { roleId: role.id } },
      },
    });

    const token = generateAccessToken({
      userId: user.id,
      username: user.username,
      email: user.email,
      roles: [roleCode],
      permissions: role.permissions.map(p => p.permission.code),
    });
    return { user, token };
  }

  beforeAll(async () => {
    const admin = await buildUser('p9_admin', 'ADMIN');
    const restricted = await buildUser('p9_restricted', 'PRODUCTION');
    adminToken = admin.token;
    restrictedToken = restricted.token;

    const warehouses = await prisma.warehouse.findMany({ where: { isActive: true }, take: 2 });
    if (warehouses.length < 2) {
      throw new Error('At least 2 active warehouses required in DB');
    }
    wh1Id = warehouses[0].id;
    wh2Id = warehouses[1].id;

    // Ensure restricted user has NO access to wh1
    await prisma.userWarehouseAccess.deleteMany({
      where: { userId: restricted.user.id, warehouseId: wh1Id },
    });

    const uom = await prisma.unitOfMeasure.findFirst({ where: { isActive: true } });
    if (!uom) throw new Error('No active UOM found');
    uomId = uom.id;

    const item = await prisma.inventoryItem.create({
      data: {
        itemType: 'RAW_MATERIAL',
        code: `P9-RM-${suffix}`,
        name: `Phase 9 Sugar ${suffix}`,
        uomId,
        valuationMethod: 'MWAC',
        movingAverageCost: 50,
      },
    });
    itemId = item.id;

    const acceptedBatch = await prisma.inventoryBatch.create({
      data: {
        inventoryItemId: itemId,
        batchNumber: `P9-BAT-ACC-${suffix}`,
        expiryDate: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000),
        qualityStatus: 'ACCEPTED',
        unitCost: 50,
      },
    });
    acceptedBatchId = acceptedBatch.id;

    const quarantinedBatch = await prisma.inventoryBatch.create({
      data: {
        inventoryItemId: itemId,
        batchNumber: `P9-BAT-Q-${suffix}`,
        expiryDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        qualityStatus: 'QUARANTINED',
        unitCost: 50,
      },
    });
    quarantinedBatchId = quarantinedBatch.id;

    // Seed authoritative InventoryBalance for wh1 (50 accepted + 10 quarantined)
    await prisma.inventoryBalance.createMany({
      data: [
        {
          warehouseId: wh1Id,
          inventoryItemId: itemId,
          batchId: acceptedBatchId,
          quantityOnHand: 50,
          quantityReserved: 0,
          unitCost: 50,
          totalValue: 2500,
        },
        {
          warehouseId: wh1Id,
          inventoryItemId: itemId,
          batchId: quarantinedBatchId,
          quantityOnHand: 10,
          quantityReserved: 0,
          unitCost: 50,
          totalValue: 500,
        },
      ],
    });
  });

  it('1. Creates Zone -> Rack -> Shelf -> Bin hierarchy and rejects cross-warehouse parent', async () => {
    const zRes = await request(app)
      .post('/api/v1/warehouse/zones')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ warehouseId: wh1Id, code: `Z9-${suffix}`, name: 'Ambient Zone 9' });
    expect(zRes.status).toBe(201);
    zone1Id = zRes.body.data.id;

    // Cross-warehouse rack must fail
    const badRack = await request(app)
      .post('/api/v1/warehouse/racks')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ warehouseId: wh2Id, zoneId: zone1Id, code: `R-BAD-${suffix}`, name: 'Bad Rack' });
    expect(badRack.status).toBe(400);

    const rRes = await request(app)
      .post('/api/v1/warehouse/racks')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ warehouseId: wh1Id, zoneId: zone1Id, code: `R9-${suffix}`, name: 'Rack 9' });
    expect(rRes.status).toBe(201);
    rack1Id = rRes.body.data.id;

    const sRes = await request(app)
      .post('/api/v1/warehouse/shelves')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ warehouseId: wh1Id, rackId: rack1Id, code: `S9-${suffix}`, name: 'Shelf 1' });
    expect(sRes.status).toBe(201);
    shelf1Id = sRes.body.data.id;

    const b1Res = await request(app)
      .post('/api/v1/warehouse/bins')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        warehouseId: wh1Id,
        shelfId: shelf1Id,
        code: `B9-1-${suffix}`,
        name: 'Bin 1',
        capacityQuantity: '30',
      });
    expect(b1Res.status).toBe(201);
    bin1Id = b1Res.body.data.id;

    const b2Res = await request(app)
      .post('/api/v1/warehouse/bins')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        warehouseId: wh1Id,
        shelfId: shelf1Id,
        code: `B9-2-${suffix}`,
        name: 'Bin 2',
        capacityQuantity: '40',
      });
    expect(b2Res.status).toBe(201);
    bin2Id = b2Res.body.data.id;

    const qRes = await request(app)
      .post('/api/v1/warehouse/bins')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        warehouseId: wh1Id,
        shelfId: shelf1Id,
        code: `B9-Q-${suffix}`,
        name: 'Quarantine Bin',
        locationType: 'QUARANTINE',
        storageCondition: 'QUARANTINE',
        capacityQuantity: '20',
      });
    expect(qRes.status).toBe(201);
    qBinId = qRes.body.data.id;
  });

  it('2. Enforces bin capacity, unallocated stock cap, and balanced partial bin transfers', async () => {
    // Exceeds bin1 capacity of 30
    const overCap = await request(app)
      .post('/api/v1/warehouse/put-away')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        warehouseId: wh1Id,
        toBinId: bin1Id,
        inventoryItemId: itemId,
        batchId: acceptedBatchId,
        quantity: '35',
      });
    expect(overCap.status).toBe(400);

    // Put away 25 into bin1 with idempotencyKey
    const idemKey = `PA-${suffix}`;
    const pa1 = await request(app)
      .post('/api/v1/warehouse/put-away')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        warehouseId: wh1Id,
        toBinId: bin1Id,
        inventoryItemId: itemId,
        batchId: acceptedBatchId,
        quantity: '25',
        idempotencyKey: idemKey,
      });
    expect(pa1.status).toBe(201);

    // Idempotent retry returns same movement without duplicating allocation
    const paRetry = await request(app)
      .post('/api/v1/warehouse/put-away')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        warehouseId: wh1Id,
        toBinId: bin1Id,
        inventoryItemId: itemId,
        batchId: acceptedBatchId,
        quantity: '25',
        idempotencyKey: idemKey,
      });
    expect(paRetry.status).toBe(201);
    expect(paRetry.body.data.id).toBe(pa1.body.data.id);

    // Partial bin-to-bin transfer (10 from bin1 -> bin2)
    const xfer = await request(app)
      .post('/api/v1/warehouse/bin-transfers')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        warehouseId: wh1Id,
        fromBinId: bin1Id,
        toBinId: bin2Id,
        inventoryItemId: itemId,
        batchId: acceptedBatchId,
        quantity: '10',
      });
    expect(xfer.status).toBe(201);

    // Verify balanced total (15 in bin1 + 10 in bin2 = 25, InventoryBalance still 50)
    const allocs = await prisma.binStockAllocation.findMany({
      where: { warehouseId: wh1Id, inventoryItemId: itemId, batchId: acceptedBatchId },
    });
    const sumBins = allocs.reduce((acc, a) => acc + Number(a.quantity), 0);
    expect(sumBins).toBe(25);

    const bal = await prisma.inventoryBalance.findFirst({
      where: { warehouseId: wh1Id, inventoryItemId: itemId, batchId: acceptedBatchId },
    });
    expect(Number(bal?.quantityOnHand)).toBe(50);
  });

  it('3. Generates unique barcodes, supports scan/manual lookup, and blocks unauthorized warehouses', async () => {
    const bcBin = await request(app)
      .post('/api/v1/warehouse/barcodes')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        entityType: 'WAREHOUSE_BIN',
        entityId: bin1Id,
        barcodeValue: `BC-BIN-${suffix}`,
        warehouseId: wh1Id,
      });
    expect(bcBin.status).toBe(201);

    // Duplicate barcodeValue for another entity must fail with 409
    const dupBc = await request(app)
      .post('/api/v1/warehouse/barcodes')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        entityType: 'WAREHOUSE_BIN',
        entityId: bin2Id,
        barcodeValue: `BC-BIN-${suffix}`,
        warehouseId: wh1Id,
      });
    expect(dupBc.status).toBe(409);

    // Scan lookup works for authorized user
    const lookupOk = await request(app)
      .get(`/api/v1/warehouse/barcodes/lookup?code=BC-BIN-${suffix}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(lookupOk.status).toBe(200);
    expect(lookupOk.body.data.entityType).toBe('WAREHOUSE_BIN');

    // Restricted user without wh1 access gets 403
    const lookupDenied = await request(app)
      .get(`/api/v1/warehouse/barcodes/lookup?code=BC-BIN-${suffix}`)
      .set('Authorization', `Bearer ${restrictedToken}`);
    expect(lookupDenied.status).toBe(403);
  });

  it('4. Suggests FEFO/ACCEPTED picking and routes QUARANTINED batches to QUARANTINE bins', async () => {
    // Put away quarantined batch into quarantine bin
    const paQ = await request(app)
      .post('/api/v1/warehouse/put-away')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        warehouseId: wh1Id,
        toBinId: qBinId,
        inventoryItemId: itemId,
        batchId: quarantinedBatchId,
        quantity: '5',
      });
    expect(paQ.status).toBe(201);

    // Put-away suggestion for quarantined batch only suggests QUARANTINE bin
    const sugPaQ = await request(app)
      .get(
        `/api/v1/warehouse/suggestions/put-away?warehouseId=${wh1Id}&inventoryItemId=${itemId}&batchId=${quarantinedBatchId}&quantity=5`,
      )
      .set('Authorization', `Bearer ${adminToken}`);
    expect(sugPaQ.status).toBe(200);
    expect(sugPaQ.body.data.isQuarantined).toBe(true);
    expect(
      sugPaQ.body.data.suggestions.every((s: { locationType: string }) => s.locationType === 'QUARANTINE'),
    ).toBe(true);

    // Picking suggestion excludes quarantined batch and picks accepted batch
    const sugPick = await request(app)
      .get(
        `/api/v1/warehouse/suggestions/picking?warehouseId=${wh1Id}&inventoryItemId=${itemId}&quantity=20`,
      )
      .set('Authorization', `Bearer ${adminToken}`);
    expect(sugPick.status).toBe(200);
    expect(
      sugPick.body.data.suggestions.every(
        (s: { batchId: string }) => s.batchId === acceptedBatchId,
      ),
    ).toBe(true);
  });

  it('5. Extends StockAudit with cycle counting, blind count, recount, and analytics', async () => {
    const planRes = await request(app)
      .post('/api/v1/warehouse/cycle-counts/plans')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: `Bin 1 Blind Cycle ${suffix}`,
        warehouseId: wh1Id,
        frequency: 'MONTHLY',
        isBlindCount: true,
        binId: bin1Id,
        nextRunDate: new Date().toISOString().slice(0, 10),
      });
    expect(planRes.status).toBe(201);
    const planId = planRes.body.data.id;

    const genRes = await request(app)
      .post(`/api/v1/warehouse/cycle-counts/plans/${planId}/generate`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({});
    expect(genRes.status).toBe(201);
    const auditId = genRes.body.data.id;
    // Blind count masks expected quantity
    expect(genRes.body.data.lines[0].expectedBaseQuantity).toBeNull();

    const lineId = genRes.body.data.lines[0].id;
    const count1 = await request(app)
      .post(`/api/v1/warehouse/cycle-counts/audits/${auditId}/count`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ isRecount: false, lines: [{ lineId, countedQuantity: '14' }] });
    expect(count1.status).toBe(200);
    expect(Number(count1.body.data.lines[0].firstCountQuantity)).toBe(14);

    const recount = await request(app)
      .post(`/api/v1/warehouse/cycle-counts/audits/${auditId}/count`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ isRecount: true, lines: [{ lineId, countedQuantity: '15' }] });
    expect(recount.status).toBe(200);
    expect(Number(recount.body.data.lines[0].recountQuantity)).toBe(15);
    expect(Number(recount.body.data.lines[0].varianceBaseQuantity)).toBe(0);

    // Warehouse analytics returns real DB utilization & movement volume
    const analyticsRes = await request(app)
      .get(`/api/v1/warehouse/analytics/${wh1Id}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(analyticsRes.status).toBe(200);
    expect(analyticsRes.body.data.locationUtilization.totalBins).toBeGreaterThanOrEqual(3);
  });
});
