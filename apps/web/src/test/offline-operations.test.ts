import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { inventoryService } from '../services/inventory.service';
import { salesService } from '../services/sales.service';
import { productionService } from '../services/production.service';
import { setActiveOfflineUserId } from '../offline/offline-cache';
import { offlineRepo } from '../offline/offline-repository';

describe('Sprint 5: Offline Business Operations Queueing', () => {
  const userId = 'ops-user-1';

  beforeEach(async () => {
    setActiveOfflineUserId(userId);
    await offlineRepo.clearUserDataOnLogout(userId, true);
    Object.defineProperty(window.navigator, 'onLine', { value: false, configurable: true });
  });

  afterEach(() => {
    Object.defineProperty(window.navigator, 'onLine', { value: true, configurable: true });
  });

  it('queues inventory receipt, issue, adjustment, and transfer drafts offline', async () => {
    const rcp = await inventoryService.receipts.create({ warehouseId: 'wh-1', lines: [] });
    const iss = await inventoryService.issues.create({ warehouseId: 'wh-1', lines: [] });
    const adj = await inventoryService.adjustments.create({ warehouseId: 'wh-1', lines: [] });
    const trf = await inventoryService.transfers.create({
      sourceWarehouseId: 'wh-1',
      destinationWarehouseId: 'wh-2',
      lines: [],
    });

    expect(rcp.message).toContain('Queued offline');
    expect((rcp.data as { status: string }).status).toBe('DRAFT');
    expect((iss.data as { isOfflineQueued?: boolean }).isOfflineQueued).toBe(true);
    expect((adj.data as { isOfflineQueued?: boolean }).isOfflineQueued).toBe(true);
    expect((trf.data as { isOfflineQueued?: boolean }).isOfflineQueued).toBe(true);

    const ops = await offlineRepo.listOperationsByUser(userId, 'PENDING');
    expect(ops.map(o => o.operationType)).toEqual([
      'INVENTORY_RECEIPT_DRAFT',
      'INVENTORY_ISSUE_DRAFT',
      'INVENTORY_ADJUSTMENT_DRAFT',
      'WAREHOUSE_TRANSFER_DRAFT',
    ]);
  });

  it('queues sales order draft, production plan, batch progress, consumption, return, and quality observation', async () => {
    await salesService.orders.create({ customerId: 'c1', warehouseId: 'wh-1', lines: [] });
    await productionService.plans.create({ warehouseId: 'wh-1', items: [] });
    await productionService.batches.recordOutput('batch-1', { goodQuantity: 10 });
    await productionService.batches.consume('batch-1', { items: [] });
    await productionService.reconciliation.returnMaterials('batch-1', { items: [] });
    await productionService.quality.inspect('insp-1', { decision: 'ACCEPTED', notes: 'OK' });

    const ops = await offlineRepo.listOperationsByUser(userId, 'PENDING');
    expect(ops.map(o => o.operationType)).toEqual([
      'SALES_ORDER_DRAFT_CREATE',
      'PRODUCTION_PLAN_DRAFT',
      'BATCH_PROGRESS_LOG',
      'BATCH_MATERIAL_CONSUMPTION_DRAFT',
      'BATCH_MATERIAL_RETURN_DRAFT',
      'QUALITY_OBSERVATION_DRAFT',
    ]);
  });
});
