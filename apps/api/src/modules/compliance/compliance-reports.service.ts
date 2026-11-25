import { AuditAction, ComplianceDocVerificationStatus, Prisma } from '@prisma/client';
import { prisma } from '../../services/prisma.service';
import { AppError } from '../../middleware/error.middleware';
import { AuditMeta } from '../master-data/master-data.utils';
import {
  CreateComplianceDocInput,
  VerifyComplianceDocInput,
} from './compliance.types';

export class ComplianceReportsService {
  /**
   * 4.2.4 Production Cost Compliance Report.
   * Integrates Phase 3.6 ProductionBatchCosting without altering finalized historical costs.
   */
  static async getProductionCostCompliance(params: { status?: string; startDate?: string; endDate?: string }) {
    const where: Prisma.ProductionBatchCostingWhereInput = {};
    if (params.status) {
      where.status = params.status as Prisma.EnumProductionCostingStatusFilter;
    }
    if (params.startDate || params.endDate) {
      where.createdAt = {};
      if (params.startDate) where.createdAt.gte = new Date(`${params.startDate}T00:00:00.000Z`);
      if (params.endDate) where.createdAt.lte = new Date(`${params.endDate}T23:59:59.999Z`);
    }

    const costings = await prisma.productionBatchCosting.findMany({
      where,
      include: {
        productionBatch: {
          select: {
            id: true,
            batchNumber: true,
            status: true,
            completedAt: true,
            workOrder: {
              select: {
                workOrderNumber: true,
                inventoryItem: { select: { id: true, name: true, code: true } },
              },
            },
          },
        },
        history: {
          orderBy: { createdAt: 'desc' },
          take: 5,
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    const ZERO = new Prisma.Decimal(0);
    let finalizedTotalCost = ZERO;
    let provisionalTotalCost = ZERO;
    let finalizedCount = 0;
    let provisionalCount = 0;

    const items = costings.map(c => {
      const isFinalized = c.status === 'FINALIZED';
      if (isFinalized) {
        finalizedTotalCost = finalizedTotalCost.add(c.totalActualCost);
        finalizedCount += 1;
      } else {
        provisionalTotalCost = provisionalTotalCost.add(c.totalActualCost);
        provisionalCount += 1;
      }

      return {
        id: c.id,
        batchId: c.productionBatchId,
        batchNumber: c.productionBatch.batchNumber,
        workOrderNumber: c.productionBatch.workOrder.workOrderNumber,
        productName: c.productionBatch.workOrder.inventoryItem.name,
        sku: c.productionBatch.workOrder.inventoryItem.code,
        status: c.status,
        costingClassification: isFinalized ? 'FINALIZED' : 'PROVISIONAL',
        fgValuationApplied: c.fgValuationApplied,
        materialCost: c.netMaterialCost.toFixed(2),
        labourCost: c.actualLabourCost.toFixed(2),
        machineCost: c.actualMachineCost.toFixed(2),
        overheadCost: c.actualOverheadCost.toFixed(2),
        wastageCost: c.wastageAndRejectionCost.toFixed(2),
        totalProductionCost: c.totalActualCost.toFixed(2),
        acceptedGoodQuantity: c.acceptedQuantity.toFixed(4),
        unitCostPerAcceptedUnit: c.costPerAcceptedUnit.toFixed(4),
        finalizedAt: c.finalizedAt,
      };
    });

    return {
      summary: {
        totalRecords: items.length,
        finalizedCount,
        provisionalCount,
        finalizedTotalCost: finalizedTotalCost.toFixed(2),
        provisionalTotalCost: provisionalTotalCost.toFixed(2),
      },
      items,
    };
  }

  /**
   * 4.2.5 Batch Traceability & Recall Report.
   * Connects RM batch -> ProductionBatch -> FG InventoryBatch -> QualityInspection -> SalesOrderFulfillment -> SalesInvoice.
   */
  static async getTraceabilityReport(params: { batchNumber?: string; search?: string }) {
    const where: Prisma.InventoryBatchWhereInput = {};
    if (params.batchNumber) {
      where.batchNumber = { contains: params.batchNumber, mode: 'insensitive' };
    } else if (params.search) {
      where.OR = [
        { batchNumber: { contains: params.search, mode: 'insensitive' } },
        { inventoryItem: { name: { contains: params.search, mode: 'insensitive' } } },
        { inventoryItem: { code: { contains: params.search, mode: 'insensitive' } } },
      ];
    }

    const batches = await prisma.inventoryBatch.findMany({
      where,
      include: {
        inventoryItem: {
          select: { id: true, code: true, name: true, itemType: true },
        },
        qualityInspections: {
          orderBy: { createdAt: 'desc' },
          take: 3,
          select: {
            id: true,
            inspectionNumber: true,
            decision: true,
            inspectedAt: true,
            inspectedQuantity: true,
            goodQuantity: true,
            rejectedQuantity: true,
          },
        },
        consumedInBatches: {
          include: {
            productionBatch: {
              select: {
                id: true,
                batchNumber: true,
                status: true,
              },
            },
          },
        },
        producedFromBatches: {
          select: {
            id: true,
            batchNumber: true,
            status: true,
            consumptions: {
              include: {
                batch: { select: { id: true, batchNumber: true } },
                inventoryItem: { select: { code: true, name: true } },
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    return {
      items: batches.map(b => ({
        batchId: b.id,
        batchNumber: b.batchNumber,
        itemCode: b.inventoryItem.code,
        itemName: b.inventoryItem.name,
        itemType: b.inventoryItem.itemType,
        qualityStatus: b.qualityStatus,
        manufacturingDate: b.manufacturingDate,
        expiryDate: b.expiryDate,
        inspections: b.qualityInspections,
        consumedInProductionBatches: b.consumedInBatches.map(c => ({
          productionBatchId: c.productionBatch.id,
          productionBatchNumber: c.productionBatch.batchNumber,
          quantity: c.consumedQuantity.toFixed(4),
        })),
        producedFromBatches: b.producedFromBatches.flatMap(pb =>
          pb.consumptions.map(c => ({
            productionBatchNumber: pb.batchNumber,
            materialCode: c.inventoryItem.code,
            materialName: c.inventoryItem.name,
            sourceBatchNumber: c.batch?.batchNumber || 'UNBATCHED',
          })),
        ),
      })),
    };
  }

  /**
   * 4.2.6 Compliance Document Metadata Foundation.
   */
  static async listDocuments(params: { category?: string; verificationStatus?: string }) {
    const where: Prisma.ComplianceDocumentWhereInput = {};
    if (params.category) where.category = params.category;
    if (params.verificationStatus) {
      where.verificationStatus = params.verificationStatus as ComplianceDocVerificationStatus;
    }

    return prisma.complianceDocument.findMany({
      where,
      include: {
        uploadedBy: { select: { id: true, username: true, fullName: true } },
        verifiedBy: { select: { id: true, username: true, fullName: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  static async createDocument(input: CreateComplianceDocInput, userId: string, meta: AuditMeta) {
    const doc = await prisma.complianceDocument.create({
      data: {
        category: input.category,
        referenceNumber: input.referenceNumber,
        documentDate: new Date(input.documentDate),
        expiryDate: input.expiryDate ? new Date(input.expiryDate) : null,
        entityType: input.entityType || null,
        entityId: input.entityId || null,
        fileName: input.fileName,
        mimeType: input.mimeType,
        fileSizeBytes: input.fileSizeBytes,
        fileReference: input.fileReference,
        uploadedById: userId,
        remarks: input.remarks || null,
      },
      include: {
        uploadedBy: { select: { id: true, username: true, fullName: true } },
      },
    });

    await prisma.auditLog.create({
      data: {
        userId: meta.userId,
        action: AuditAction.CREATE,
        entityType: 'ComplianceDocument',
        entityId: doc.id,
        newState: {
          category: doc.category,
          referenceNumber: doc.referenceNumber,
          fileName: doc.fileName,
        },
        ipAddress: meta.ipAddress || null,
        userAgent: meta.userAgent || null,
      },
    });

    return doc;
  }

  static async verifyDocument(
    id: string,
    input: VerifyComplianceDocInput,
    userId: string,
    meta: AuditMeta,
  ) {
    const existing = await prisma.complianceDocument.findUnique({ where: { id } });
    if (!existing) throw new AppError('Compliance document not found.', 404);

    const updated = await prisma.complianceDocument.update({
      where: { id },
      data: {
        verificationStatus:
          input.status === 'VERIFIED'
            ? ComplianceDocVerificationStatus.VERIFIED
            : ComplianceDocVerificationStatus.REJECTED,
        verifiedById: userId,
        verifiedAt: new Date(),
        remarks: input.remarks ?? existing.remarks,
      },
      include: {
        uploadedBy: { select: { id: true, username: true, fullName: true } },
        verifiedBy: { select: { id: true, username: true, fullName: true } },
      },
    });

    await prisma.auditLog.create({
      data: {
        userId: meta.userId,
        action: input.status === 'VERIFIED' ? AuditAction.APPROVE : AuditAction.REJECT,
        entityType: 'ComplianceDocument',
        entityId: id,
        previousState: { verificationStatus: existing.verificationStatus },
        newState: { verificationStatus: updated.verificationStatus },
        ipAddress: meta.ipAddress || null,
        userAgent: meta.userAgent || null,
      },
    });

    return updated;
  }
}
