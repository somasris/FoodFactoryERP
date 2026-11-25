import { AuditAction, Prisma } from '@prisma/client';
import { prisma } from '../../services/prisma.service';
import { AppError } from '../../middleware/error.middleware';

const SENSITIVE_KEYS = new Set([
  'password',
  'passwordhash',
  'token',
  'tokenhash',
  'refreshtoken',
  'accesstoken',
  'secret',
  'apikey',
  'privatekey',
  'jwt',
  'authorization',
]);

export function redactSensitiveData(val: unknown): unknown {
  if (val === null || val === undefined) return val;
  if (Array.isArray(val)) return val.map(redactSensitiveData);
  if (typeof val === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(val as Record<string, unknown>)) {
      if (SENSITIVE_KEYS.has(k.toLowerCase())) {
        out[k] = '[REDACTED]';
      } else {
        out[k] = redactSensitiveData(v);
      }
    }
    return out;
  }
  return val;
}

export function computeFieldDiffs(
  previousState: unknown,
  newState: unknown,
): Array<{ field: string; previousValue: unknown; newValue: unknown }> {
  if (
    !previousState ||
    !newState ||
    typeof previousState !== 'object' ||
    typeof newState !== 'object' ||
    Array.isArray(previousState) ||
    Array.isArray(newState)
  ) {
    return [];
  }

  const prev = redactSensitiveData(previousState) as Record<string, unknown>;
  const next = redactSensitiveData(newState) as Record<string, unknown>;
  const keys = Array.from(new Set([...Object.keys(prev), ...Object.keys(next)]));
  const diffs: Array<{ field: string; previousValue: unknown; newValue: unknown }> = [];

  for (const key of keys) {
    const pVal = prev[key];
    const nVal = next[key];
    if (JSON.stringify(pVal) !== JSON.stringify(nVal)) {
      diffs.push({
        field: key,
        previousValue: pVal ?? null,
        newValue: nVal ?? null,
      });
    }
  }
  return diffs;
}

export interface AuditListParams {
  search?: string;
  entityType?: string;
  entityId?: string;
  userId?: string;
  action?: string;
  startDate?: string;
  endDate?: string;
  page: number;
  limit: number;
}

export class GovernanceService {
  /**
   * 4.4.1 & 4.4.2 Centralized Audit Trail with redaction & non-fabricated field diffs.
   */
  static async listAuditLogs(params: AuditListParams) {
    const skip = (params.page - 1) * params.limit;
    const where: Prisma.AuditLogWhereInput = {};

    if (params.entityType) where.entityType = params.entityType;
    if (params.entityId) where.entityId = params.entityId;
    if (params.userId) where.userId = params.userId;
    if (params.action) where.action = params.action as AuditAction;
    if (params.startDate || params.endDate) {
      where.createdAt = {};
      if (params.startDate) where.createdAt.gte = new Date(`${params.startDate}T00:00:00.000Z`);
      if (params.endDate) where.createdAt.lte = new Date(`${params.endDate}T23:59:59.999Z`);
    }
    if (params.search) {
      where.OR = [
        { entityType: { contains: params.search, mode: 'insensitive' } },
        { entityId: { contains: params.search, mode: 'insensitive' } },
        { remarks: { contains: params.search, mode: 'insensitive' } },
      ];
    }

    const [items, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        include: {
          user: { select: { id: true, username: true, fullName: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: params.limit,
      }),
      prisma.auditLog.count({ where }),
    ]);

    return {
      items: items.map(log => {
        const redactedPrev = redactSensitiveData(log.previousState);
        const redactedNext = redactSensitiveData(log.newState);
        return {
          id: log.id,
          userId: log.userId,
          user: log.user,
          action: log.action,
          entityType: log.entityType,
          entityId: log.entityId,
          ipAddress: log.ipAddress,
          remarks: log.remarks,
          createdAt: log.createdAt,
          previousState: redactedPrev,
          newState: redactedNext,
          fieldDiffs: computeFieldDiffs(log.previousState, log.newState),
        };
      }),
      pagination: {
        page: params.page,
        limit: params.limit,
        total,
        totalPages: Math.ceil(total / params.limit) || 1,
      },
    };
  }

  static async getAuditLogById(id: string) {
    const log = await prisma.auditLog.findUnique({
      where: { id },
      include: {
        user: { select: { id: true, username: true, fullName: true } },
      },
    });
    if (!log) throw new AppError('Audit log entry not found.', 404);

    return {
      ...log,
      previousState: redactSensitiveData(log.previousState),
      newState: redactSensitiveData(log.newState),
      fieldDiffs: computeFieldDiffs(log.previousState, log.newState),
    };
  }

  /**
   * 4.4.3 Centralized Approval Governance across existing module lifecycle histories.
   */
  static async getApprovalHistory(params: { status?: string; module?: string }) {
    const [
      salesOrders,
      productionPlans,
      workOrders,
      variances,
      costings,
      inspections,
      adjustments,
      stockAudits,
    ] = await Promise.all([
      prisma.salesOrder.findMany({
        where: { status: { in: ['SUBMITTED', 'APPROVED', 'REJECTED'] } },
        select: {
          id: true,
          orderNumber: true,
          status: true,
          submittedAt: true,
          approvedAt: true,
          rejectedAt: true,
          rejectionReason: true,
        },
        orderBy: { updatedAt: 'desc' },
        take: 25,
      }),
      prisma.productionPlan.findMany({
        where: { status: { in: ['SUBMITTED', 'APPROVED', 'REJECTED'] } },
        select: {
          id: true,
          planNumber: true,
          status: true,
          submittedAt: true,
          approvedAt: true,
          rejectedAt: true,
          rejectionReason: true,
        },
        orderBy: { updatedAt: 'desc' },
        take: 25,
      }),
      prisma.workOrder.findMany({
        where: { status: { in: ['SUBMITTED', 'APPROVED', 'REJECTED'] } },
        select: {
          id: true,
          workOrderNumber: true,
          status: true,
          submittedAt: true,
          approvedAt: true,
          rejectedAt: true,
          rejectionReason: true,
        },
        orderBy: { updatedAt: 'desc' },
        take: 25,
      }),
      prisma.productionBatchVarianceApproval.findMany({
        include: {
          productionBatch: { select: { batchNumber: true } },
          approvedBy: { select: { username: true, fullName: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: 25,
      }),
      prisma.productionBatchCosting.findMany({
        where: { status: { in: ['CALCULATED', 'REVIEWED', 'FINALIZED'] } },
        include: {
          productionBatch: { select: { batchNumber: true } },
          reviewedBy: { select: { username: true, fullName: true } },
          finalizedBy: { select: { username: true, fullName: true } },
        },
        orderBy: { updatedAt: 'desc' },
        take: 25,
      }),
      prisma.qualityInspection.findMany({
        select: {
          id: true,
          inspectionNumber: true,
          decision: true,
          inspectedAt: true,
          notes: true,
          inspector: { select: { username: true, fullName: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: 25,
      }),
      prisma.inventoryAdjustment.findMany({
        where: { status: { in: ['SUBMITTED', 'APPROVED', 'POSTED'] } },
        select: {
          id: true,
          adjustmentNumber: true,
          status: true,
          approvedAt: true,
          postedAt: true,
        },
        orderBy: { updatedAt: 'desc' },
        take: 25,
      }),
      prisma.stockAudit.findMany({
        where: { status: { in: ['SUBMITTED', 'APPROVED', 'REJECTED', 'POSTED'] } },
        select: {
          id: true,
          auditNumber: true,
          status: true,
          reviewedAt: true,
          reviewReason: true,
        },
        orderBy: { updatedAt: 'desc' },
        take: 25,
      }),
    ]);

    type ApprovalItem = {
      module: string;
      entityType: string;
      entityId: string;
      documentNumber: string;
      status: string;
      decisionStatus: 'PENDING' | 'APPROVED' | 'REJECTED';
      actor: string | null;
      timestamp: Date | null;
      reason: string | null;
    };

    const items: ApprovalItem[] = [
      ...salesOrders.map(so => ({
        module: 'Sales',
        entityType: 'SalesOrder',
        entityId: so.id,
        documentNumber: so.orderNumber,
        status: so.status,
        decisionStatus: (so.status === 'SUBMITTED'
          ? 'PENDING'
          : so.status === 'REJECTED'
            ? 'REJECTED'
            : 'APPROVED') as 'PENDING' | 'APPROVED' | 'REJECTED',
        actor: null,
        timestamp: so.approvedAt || so.rejectedAt || so.submittedAt,
        reason: so.rejectionReason,
      })),
      ...productionPlans.map(pp => ({
        module: 'Production Planning',
        entityType: 'ProductionPlan',
        entityId: pp.id,
        documentNumber: pp.planNumber,
        status: pp.status,
        decisionStatus: (pp.status === 'SUBMITTED'
          ? 'PENDING'
          : pp.status === 'REJECTED'
            ? 'REJECTED'
            : 'APPROVED') as 'PENDING' | 'APPROVED' | 'REJECTED',
        actor: null,
        timestamp: pp.approvedAt || pp.rejectedAt || pp.submittedAt,
        reason: pp.rejectionReason,
      })),
      ...workOrders.map(wo => ({
        module: 'Work Orders',
        entityType: 'WorkOrder',
        entityId: wo.id,
        documentNumber: wo.workOrderNumber,
        status: wo.status,
        decisionStatus: (wo.status === 'SUBMITTED'
          ? 'PENDING'
          : wo.status === 'REJECTED'
            ? 'REJECTED'
            : 'APPROVED') as 'PENDING' | 'APPROVED' | 'REJECTED',
        actor: null,
        timestamp: wo.approvedAt || wo.rejectedAt || wo.submittedAt,
        reason: wo.rejectionReason,
      })),
      ...variances.map(v => ({
        module: 'Production Variance',
        entityType: 'ProductionBatchVarianceApproval',
        entityId: v.id,
        documentNumber: v.productionBatch.batchNumber,
        status: v.status,
        decisionStatus: (v.status === 'PENDING'
          ? 'PENDING'
          : v.status === 'REJECTED'
            ? 'REJECTED'
            : 'APPROVED') as 'PENDING' | 'APPROVED' | 'REJECTED',
        actor: v.approvedBy?.username || null,
        timestamp: v.approvedAt || v.createdAt,
        reason: v.reason,
      })),
      ...costings.map(c => ({
        module: 'Production Costing',
        entityType: 'ProductionBatchCosting',
        entityId: c.id,
        documentNumber: c.productionBatch.batchNumber,
        status: c.status,
        decisionStatus: (c.status === 'CALCULATED' ? 'PENDING' : 'APPROVED') as
          | 'PENDING'
          | 'APPROVED',
        actor: c.finalizedBy?.username || c.reviewedBy?.username || null,
        timestamp: c.finalizedAt || c.reviewedAt || c.updatedAt,
        reason: null,
      })),
      ...inspections.map(q => ({
        module: 'Quality',
        entityType: 'QualityInspection',
        entityId: q.id,
        documentNumber: q.inspectionNumber,
        status: q.decision,
        decisionStatus: (q.decision === 'PENDING'
          ? 'PENDING'
          : q.decision === 'REJECTED' || q.decision === 'QUARANTINED'
            ? 'REJECTED'
            : 'APPROVED') as 'PENDING' | 'APPROVED' | 'REJECTED',
        actor: q.inspector?.username || null,
        timestamp: q.inspectedAt,
        reason: q.notes,
      })),
      ...adjustments.map(a => ({
        module: 'Inventory',
        entityType: 'InventoryAdjustment',
        entityId: a.id,
        documentNumber: a.adjustmentNumber,
        status: a.status,
        decisionStatus: (a.status === 'SUBMITTED' ? 'PENDING' : 'APPROVED') as
          | 'PENDING'
          | 'APPROVED',
        actor: null,
        timestamp: a.postedAt || a.approvedAt,
        reason: null,
      })),
      ...stockAudits.map(sa => ({
        module: 'Stock Audit',
        entityType: 'StockAudit',
        entityId: sa.id,
        documentNumber: sa.auditNumber,
        status: sa.status,
        decisionStatus: (sa.status === 'SUBMITTED'
          ? 'PENDING'
          : sa.status === 'REJECTED'
            ? 'REJECTED'
            : 'APPROVED') as 'PENDING' | 'APPROVED' | 'REJECTED',
        actor: null,
        timestamp: sa.reviewedAt,
        reason: sa.reviewReason,
      })),
    ];

    const filtered = items.filter(item => {
      if (params.status && item.decisionStatus !== params.status) return false;
      if (params.module && item.module.toLowerCase() !== params.module.toLowerCase()) return false;
      return true;
    });

    return {
      counts: {
        pending: items.filter(i => i.decisionStatus === 'PENDING').length,
        approved: items.filter(i => i.decisionStatus === 'APPROVED').length,
        rejected: items.filter(i => i.decisionStatus === 'REJECTED').length,
      },
      items: filtered,
    };
  }

  /**
   * 4.4.4 User Activity & Security Monitoring.
   */
  static async getUserActivityLogs(params: { page: number; limit: number; action?: string }) {
    const skip = (params.page - 1) * params.limit;
    const where: Prisma.AuditLogWhereInput = {
      OR: [
        { action: { in: ['LOGIN', 'LOGOUT', 'LOGIN_FAILED', 'SECURITY_ALERT'] } },
        { entityType: { in: ['User', 'UserRole', 'UserSecurity', 'Role', 'RolePermission', 'SystemConfig', 'Company'] } },
      ],
    };
    if (params.action) {
      where.action = params.action as AuditAction;
    }

    const [items, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        include: {
          user: { select: { id: true, username: true, fullName: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: params.limit,
      }),
      prisma.auditLog.count({ where }),
    ]);

    return {
      items: items.map(l => ({
        id: l.id,
        action: l.action,
        entityType: l.entityType,
        entityId: l.entityId,
        user: l.user,
        ipAddress: l.ipAddress,
        remarks: l.remarks,
        createdAt: l.createdAt,
      })),
      pagination: {
        page: params.page,
        limit: params.limit,
        total,
        totalPages: Math.ceil(total / params.limit) || 1,
      },
    };
  }

  /**
   * 4.4.5 Unified Cross-Module Transaction History (preserving entityType & documentNumber).
   */
  static async getUnifiedTransactionHistory() {
    const [salesOrders, invoices, invTxs, batches, returns, inspections] = await Promise.all([
      prisma.salesOrder.findMany({
        select: { id: true, orderNumber: true, status: true, totalAmount: true, orderDate: true },
        orderBy: { orderDate: 'desc' },
        take: 20,
      }),
      prisma.salesInvoice.findMany({
        select: { id: true, invoiceNumber: true, status: true, grandTotal: true, invoiceDate: true },
        orderBy: { invoiceDate: 'desc' },
        take: 20,
      }),
      prisma.inventoryTransaction.findMany({
        select: {
          id: true,
          transactionNumber: true,
          transactionType: true,
          referenceType: true,
          transactionDate: true,
        },
        orderBy: { transactionDate: 'desc' },
        take: 20,
      }),
      prisma.productionBatch.findMany({
        select: { id: true, batchNumber: true, status: true, createdAt: true },
        orderBy: { createdAt: 'desc' },
        take: 20,
      }),
      prisma.productionBatchReturn.findMany({
        select: {
          id: true,
          returnedQuantity: true,
          returnedAt: true,
          productionBatch: { select: { batchNumber: true } },
        },
        orderBy: { returnedAt: 'desc' },
        take: 20,
      }),
      prisma.qualityInspection.findMany({
        select: { id: true, inspectionNumber: true, decision: true, inspectedAt: true },
        orderBy: { inspectedAt: 'desc' },
        take: 20,
      }),
    ]);

    const items = [
      ...salesOrders.map(o => ({
        entityType: 'SalesOrder',
        entityId: o.id,
        documentNumber: o.orderNumber,
        subType: o.status,
        amountOrQty: `₹${o.totalAmount.toFixed(2)}`,
        timestamp: o.orderDate,
      })),
      ...invoices.map(i => ({
        entityType: 'SalesInvoice',
        entityId: i.id,
        documentNumber: i.invoiceNumber,
        subType: i.status,
        amountOrQty: `₹${i.grandTotal.toFixed(2)}`,
        timestamp: i.invoiceDate,
      })),
      ...invTxs.map(t => ({
        entityType: 'InventoryTransaction',
        entityId: t.id,
        documentNumber: t.transactionNumber,
        subType: `${t.transactionType} (${t.referenceType})`,
        amountOrQty: '-',
        timestamp: t.transactionDate,
      })),
      ...batches.map(b => ({
        entityType: 'ProductionBatch',
        entityId: b.id,
        documentNumber: b.batchNumber,
        subType: b.status,
        amountOrQty: '-',
        timestamp: b.createdAt,
      })),
      ...returns.map(r => ({
        entityType: 'ProductionBatchReturn',
        entityId: r.id,
        documentNumber: `RET-${r.productionBatch.batchNumber}`,
        subType: 'MATERIAL_RETURN',
        amountOrQty: r.returnedQuantity.toFixed(4),
        timestamp: r.returnedAt,
      })),
      ...inspections.map(q => ({
        entityType: 'QualityInspection',
        entityId: q.id,
        documentNumber: q.inspectionNumber,
        subType: q.decision,
        amountOrQty: '-',
        timestamp: q.inspectedAt,
      })),
    ].sort((a, b) => new Date(b.timestamp ?? 0).getTime() - new Date(a.timestamp ?? 0).getTime());

    return { items: items.slice(0, 100) };
  }

  /**
   * 4.4.6 Redacted CSV Export of Audit Logs.
   */
  static async exportAuditLogsCsv(params: AuditListParams): Promise<Buffer> {
    const data = await this.listAuditLogs({ ...params, page: 1, limit: 500 });
    const escapeCsv = (v: unknown) => {
      const s = v === null || v === undefined ? '' : String(v);
      const safe = /^[=+\-@]/.test(s) ? `'${s}` : s;
      return `"${safe.replace(/"/g, '""')}"`;
    };
    const header = ['Timestamp', 'Action', 'Entity Type', 'Entity ID', 'User', 'IP Address', 'Remarks']
      .map(escapeCsv)
      .join(',');
    const rows = data.items.map(l =>
      [
        l.createdAt.toISOString(),
        l.action,
        l.entityType,
        l.entityId,
        l.user?.username || 'system',
        l.ipAddress || '',
        l.remarks || '',
      ]
        .map(escapeCsv)
        .join(','),
    );
    return Buffer.from(`\uFEFF${[header, ...rows].join('\r\n')}`, 'utf8');
  }
}
