import { prisma } from '../../services/prisma.service';
import { getAuthorizedWarehouseIds } from '../inventory/inventory.utils';
import { SyncUserContext } from '../sync/sync.service';
import { SearchResultItem } from './search.types';

function hasPerm(user: SyncUserContext, perm: string): boolean {
  if (user.roles.includes('OWNER')) return true;
  return user.permissions.includes(perm);
}

export class GlobalSearchService {
  static async search(
    user: SyncUserContext,
    query: string,
    limit: number,
  ): Promise<{ query: string; total: number; results: SearchResultItem[] }> {
    const q = query.trim();
    if (!q) {
      return { query: '', total: 0, results: [] };
    }

    const perCategory = Math.min(5, limit);
    const allowedWh = await getAuthorizedWarehouseIds(user, 'READ');
    const whFilter = allowedWh ? { warehouseId: { in: allowedWh } } : {};

    const tasks: Array<Promise<SearchResultItem[]>> = [];

    if (hasPerm(user, 'sales.orders.read')) {
      tasks.push(
        prisma.salesOrder
          .findMany({
            where: {
              ...whFilter,
              OR: [
                { orderNumber: { contains: q, mode: 'insensitive' } },
                { customer: { legalName: { contains: q, mode: 'insensitive' } } },
              ],
            },
            take: perCategory,
            orderBy: { updatedAt: 'desc' },
            select: {
              id: true,
              orderNumber: true,
              status: true,
              customer: { select: { legalName: true } },
            },
          })
          .then(rows =>
            rows.map(r => ({
              category: 'Sales',
              entityType: 'SALES_ORDER',
              entityId: r.id,
              title: r.orderNumber,
              subtitle: r.customer?.legalName ?? 'Customer Order',
              documentNumber: r.orderNumber,
              status: r.status,
              navigationPath: `/sales/orders/${r.id}`,
            })),
          ),
      );
    }

    if (hasPerm(user, 'customers.read')) {
      tasks.push(
        prisma.customer
          .findMany({
            where: {
              OR: [
                { code: { contains: q, mode: 'insensitive' } },
                { legalName: { contains: q, mode: 'insensitive' } },
                { tradeName: { contains: q, mode: 'insensitive' } },
              ],
            },
            take: perCategory,
            orderBy: { updatedAt: 'desc' },
            select: { id: true, code: true, legalName: true, isActive: true },
          })
          .then(rows =>
            rows.map(r => ({
              category: 'Sales',
              entityType: 'CUSTOMER',
              entityId: r.id,
              title: r.legalName,
              subtitle: `Customer • ${r.code}`,
              documentNumber: r.code,
              status: r.isActive ? 'ACTIVE' : 'INACTIVE',
              navigationPath: '/master-data/customers',
            })),
          ),
      );
    }

    if (hasPerm(user, 'sales.invoices.read')) {
      tasks.push(
        prisma.salesInvoice
          .findMany({
            where: {
              invoiceNumber: { contains: q, mode: 'insensitive' },
              ...(allowedWh ? { salesOrder: { warehouseId: { in: allowedWh } } } : {}),
            },
            take: perCategory,
            orderBy: { updatedAt: 'desc' },
            select: { id: true, invoiceNumber: true, status: true },
          })
          .then(rows =>
            rows.map(r => ({
              category: 'Sales',
              entityType: 'SALES_INVOICE',
              entityId: r.id,
              title: r.invoiceNumber,
              subtitle: 'Sales Invoice',
              documentNumber: r.invoiceNumber,
              status: r.status,
              navigationPath: `/sales/invoices/${r.id}`,
            })),
          ),
      );
    }

    if (hasPerm(user, 'master_data.read')) {
      tasks.push(
        prisma.product
          .findMany({
            where: {
              OR: [
                { code: { contains: q, mode: 'insensitive' } },
                { name: { contains: q, mode: 'insensitive' } },
              ],
            },
            take: perCategory,
            select: { id: true, code: true, name: true, isActive: true },
          })
          .then(rows =>
            rows.map(r => ({
              category: 'Master Data',
              entityType: 'PRODUCT',
              entityId: r.id,
              title: r.name,
              subtitle: `Finished Good • ${r.code}`,
              documentNumber: r.code,
              status: r.isActive ? 'ACTIVE' : 'INACTIVE',
              navigationPath: '/master-data/products',
            })),
          ),
      );

      tasks.push(
        prisma.rawMaterial
          .findMany({
            where: {
              OR: [
                { code: { contains: q, mode: 'insensitive' } },
                { name: { contains: q, mode: 'insensitive' } },
              ],
            },
            take: perCategory,
            select: { id: true, code: true, name: true, isActive: true },
          })
          .then(rows =>
            rows.map(r => ({
              category: 'Inventory',
              entityType: 'RAW_MATERIAL',
              entityId: r.id,
              title: r.name,
              subtitle: `Raw Material • ${r.code}`,
              documentNumber: r.code,
              status: r.isActive ? 'ACTIVE' : 'INACTIVE',
              navigationPath: '/master-data/raw-materials',
            })),
          ),
      );
    }

    if (hasPerm(user, 'inventory.read')) {
      tasks.push(
        prisma.inventoryBatch
          .findMany({
            where: {
              batchNumber: { contains: q, mode: 'insensitive' },
              ...(allowedWh ? { balances: { some: { warehouseId: { in: allowedWh } } } } : {}),
            },
            take: perCategory,
            orderBy: { updatedAt: 'desc' },
            select: {
              id: true,
              batchNumber: true,
              qualityStatus: true,
              inventoryItem: { select: { name: true, code: true } },
            },
          })
          .then(rows =>
            rows.map(r => ({
              category: 'Inventory',
              entityType: 'INVENTORY_BATCH',
              entityId: r.id,
              title: r.batchNumber,
              subtitle: `${r.inventoryItem.name} (${r.inventoryItem.code})`,
              documentNumber: r.batchNumber,
              status: r.qualityStatus,
              navigationPath: '/inventory/batches',
            })),
          ),
      );

      tasks.push(
        prisma.inventoryReceipt
          .findMany({
            where: {
              ...whFilter,
              receiptNumber: { contains: q, mode: 'insensitive' },
            },
            take: perCategory,
            orderBy: { updatedAt: 'desc' },
            select: { id: true, receiptNumber: true, status: true },
          })
          .then(rows =>
            rows.map(r => ({
              category: 'Inventory',
              entityType: 'INVENTORY_RECEIPT',
              entityId: r.id,
              title: r.receiptNumber,
              subtitle: 'Inventory Receipt',
              documentNumber: r.receiptNumber,
              status: r.status,
              navigationPath: '/inventory/receipts',
            })),
          ),
      );

      tasks.push(
        prisma.inventoryIssue
          .findMany({
            where: {
              ...whFilter,
              issueNumber: { contains: q, mode: 'insensitive' },
            },
            take: perCategory,
            orderBy: { updatedAt: 'desc' },
            select: { id: true, issueNumber: true, status: true },
          })
          .then(rows =>
            rows.map(r => ({
              category: 'Inventory',
              entityType: 'INVENTORY_ISSUE',
              entityId: r.id,
              title: r.issueNumber,
              subtitle: 'Inventory Issue',
              documentNumber: r.issueNumber,
              status: r.status,
              navigationPath: '/inventory/issues',
            })),
          ),
      );
    }

    if (hasPerm(user, 'warehouses.read') || hasPerm(user, 'master_data.read')) {
      tasks.push(
        prisma.warehouse
          .findMany({
            where: {
              ...(allowedWh ? { id: { in: allowedWh } } : {}),
              OR: [
                { code: { contains: q, mode: 'insensitive' } },
                { name: { contains: q, mode: 'insensitive' } },
              ],
            },
            take: perCategory,
            select: { id: true, code: true, name: true, isActive: true },
          })
          .then(rows =>
            rows.map(r => ({
              category: 'Master Data',
              entityType: 'WAREHOUSE',
              entityId: r.id,
              title: r.name,
              subtitle: `Warehouse • ${r.code}`,
              documentNumber: r.code,
              status: r.isActive ? 'ACTIVE' : 'INACTIVE',
              navigationPath: '/master-data/warehouses',
            })),
          ),
      );
    }

    if (hasPerm(user, 'bom.read') || hasPerm(user, 'master_data.read')) {
      tasks.push(
        prisma.bOM
          .findMany({
            where: {
              OR: [
                { code: { contains: q, mode: 'insensitive' } },
                { name: { contains: q, mode: 'insensitive' } },
              ],
            },
            take: perCategory,
            select: { id: true, code: true, name: true, isActive: true },
          })
          .then(rows =>
            rows.map(r => ({
              category: 'Production',
              entityType: 'BOM',
              entityId: r.id,
              title: r.name,
              subtitle: `BOM • ${r.code}`,
              documentNumber: r.code,
              status: r.isActive ? 'ACTIVE' : 'INACTIVE',
              navigationPath: '/production/boms',
            })),
          ),
      );
    }

    if (hasPerm(user, 'production.plans.read')) {
      tasks.push(
        prisma.productionPlan
          .findMany({
            where: {
              ...whFilter,
              OR: [
                { planNumber: { contains: q, mode: 'insensitive' } },
                { name: { contains: q, mode: 'insensitive' } },
              ],
            },
            take: perCategory,
            orderBy: { updatedAt: 'desc' },
            select: { id: true, planNumber: true, name: true, status: true },
          })
          .then(rows =>
            rows.map(r => ({
              category: 'Production',
              entityType: 'PRODUCTION_PLAN',
              entityId: r.id,
              title: r.planNumber,
              subtitle: r.name ?? 'Production Plan',
              documentNumber: r.planNumber,
              status: r.status,
              navigationPath: `/production/plans/${r.id}`,
            })),
          ),
      );
    }

    if (hasPerm(user, 'production.work_orders.read')) {
      tasks.push(
        prisma.workOrder
          .findMany({
            where: {
              ...whFilter,
              workOrderNumber: { contains: q, mode: 'insensitive' },
            },
            take: perCategory,
            orderBy: { updatedAt: 'desc' },
            select: {
              id: true,
              workOrderNumber: true,
              status: true,
              productVariant: { select: { name: true } },
            },
          })
          .then(rows =>
            rows.map(r => ({
              category: 'Production',
              entityType: 'WORK_ORDER',
              entityId: r.id,
              title: r.workOrderNumber,
              subtitle: r.productVariant?.name ?? 'Work Order',
              documentNumber: r.workOrderNumber,
              status: r.status,
              navigationPath: `/production/work-orders/${r.id}`,
            })),
          ),
      );
    }

    if (hasPerm(user, 'production.batches.read')) {
      tasks.push(
        prisma.productionBatch
          .findMany({
            where: {
              ...whFilter,
              batchNumber: { contains: q, mode: 'insensitive' },
            },
            take: perCategory,
            orderBy: { updatedAt: 'desc' },
            select: {
              id: true,
              batchNumber: true,
              status: true,
              product: { select: { name: true } },
            },
          })
          .then(rows =>
            rows.map(r => ({
              category: 'Production',
              entityType: 'PRODUCTION_BATCH',
              entityId: r.id,
              title: r.batchNumber,
              subtitle: r.product?.name ?? 'Production Batch',
              documentNumber: r.batchNumber,
              status: r.status,
              navigationPath: `/production/batches/${r.id}`,
            })),
          ),
      );
    }

    if (hasPerm(user, 'production.quality.read')) {
      tasks.push(
        prisma.qualityInspection
          .findMany({
            where: {
              inspectionNumber: { contains: q, mode: 'insensitive' },
              ...(allowedWh ? { productionBatch: { warehouseId: { in: allowedWh } } } : {}),
            },
            take: perCategory,
            orderBy: { updatedAt: 'desc' },
            select: { id: true, inspectionNumber: true, decision: true },
          })
          .then(rows =>
            rows.map(r => ({
              category: 'Production',
              entityType: 'QUALITY_INSPECTION',
              entityId: r.id,
              title: r.inspectionNumber,
              subtitle: 'Quality Inspection',
              documentNumber: r.inspectionNumber,
              status: r.decision,
              navigationPath: '/production/quality',
            })),
          ),
      );
    }

    if (hasPerm(user, 'administration.users.read') || hasPerm(user, 'users.read')) {
      tasks.push(
        prisma.user
          .findMany({
            where: {
              OR: [
                { username: { contains: q, mode: 'insensitive' } },
                { fullName: { contains: q, mode: 'insensitive' } },
              ],
            },
            take: perCategory,
            select: { id: true, username: true, fullName: true, isActive: true },
          })
          .then(rows =>
            rows.map(r => ({
              category: 'Administration',
              entityType: 'USER',
              entityId: r.id,
              title: r.fullName,
              subtitle: `@${r.username}`,
              documentNumber: r.username,
              status: r.isActive ? 'ACTIVE' : 'INACTIVE',
              navigationPath: '/admin/users',
            })),
          ),
      );
    }

    if (hasPerm(user, 'administration.factories.read')) {
      tasks.push(
        prisma.factory
          .findMany({
            where: {
              OR: [
                { code: { contains: q, mode: 'insensitive' } },
                { name: { contains: q, mode: 'insensitive' } },
              ],
            },
            take: perCategory,
            select: { id: true, code: true, name: true, isActive: true },
          })
          .then(rows =>
            rows.map(r => ({
              category: 'Administration',
              entityType: 'FACTORY',
              entityId: r.id,
              title: r.name,
              subtitle: `Factory • ${r.code}`,
              documentNumber: r.code,
              status: r.isActive ? 'ACTIVE' : 'INACTIVE',
              navigationPath: '/admin/factories',
            })),
          ),
      );
    }

    const nested = await Promise.all(tasks);
    const results = nested.flat().slice(0, limit);
    return {
      query: q,
      total: results.length,
      results,
    };
  }
}
