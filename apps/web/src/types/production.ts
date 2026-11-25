export type ProductionPlanStatus =
  | 'DRAFT'
  | 'SUBMITTED'
  | 'APPROVED'
  | 'REJECTED'
  | 'RELEASED'
  | 'COMPLETED'
  | 'CANCELLED';

export interface ProductionDemandOrderLine {
  salesOrderId: string;
  orderNumber: string;
  orderDate: string;
  customerName: string;
  warehouseId: string;
  warehouseCode: string;
  salesOrderLineId: string;
  productVariantId: string;
  sku: string;
  productName: string;
  uomId: string;
  uomSymbol: string;
  remainingOrderQuantity: string;
  alreadyPlannedQuantity: string;
  unplannedQuantity: string;
}

export interface ProductionDemandProductSummary {
  productVariantId: string;
  sku: string;
  productName: string;
  warehouseId: string;
  warehouseCode: string;
  uomSymbol: string;
  grossDemandQuantity: string;
  availableFgQuantity: string;
  netRequirementQuantity: string;
  activeBom: { bomCode: string; versionNumber: number } | null;
  sources: Array<{
    salesOrderId: string;
    orderNumber: string;
    salesOrderLineId: string;
    unplannedQuantity: string;
  }>;
}

export interface ProductionDemandResponse {
  orderDemandLines: ProductionDemandOrderLine[];
  productSummary: ProductionDemandProductSummary[];
}

export interface ProductionPlanItem {
  id: string;
  lineNumber: number;
  productVariantId: string;
  inventoryItemId: string;
  bomId: string;
  bomVersionId: string;
  uomId: string;
  demandQuantity: string;
  availableFgQuantity: string;
  existingPlannedQuantity: string;
  netRequirementQuantity: string;
  plannedQuantity: string;
  workOrderedQuantity?: string;
  yieldPercentage: string;
  expectedWastagePercent: string;
  estimatedMaterialCost: string;
  estimatedOverheadCost: string;
  estimatedTotalCost: string;
  productVariant?: {
    id: string;
    sku: string;
    name: string;
    product?: { id: string; code: string; name: string };
  };
  bom?: { id: string; code: string; name: string };
  bomVersion?: {
    id: string;
    versionNumber: number;
    status: string;
    expectedGoodOutput: string;
    yieldPercentage: string;
    expectedWastagePercent: string;
  };
  uom?: { id: string; code: string; symbol: string };
  demandSources?: Array<{
    id: string;
    salesOrderId: string;
    salesOrderLineId: string;
    allocatedBaseQuantity: string;
    salesOrder?: { id: string; orderNumber: string; status: string };
  }>;
}

export interface ProductionPlanMaterialRequirement {
  id: string;
  inventoryItemId: string;
  itemType: string;
  requiredBaseQuantity: string;
  availableQuantity: string;
  reservedQuantity: string;
  netAvailableQuantity: string;
  shortageQuantity: string;
  unitMwacCost: string;
  estimatedCost: string;
  inventoryItem?: {
    id: string;
    code: string;
    name: string;
    itemType: string;
    uom?: { id: string; code: string; symbol: string };
  };
}

export interface ProductionPlanStatusHistoryItem {
  id: string;
  fromStatus: ProductionPlanStatus | null;
  toStatus: ProductionPlanStatus;
  reason?: string | null;
  createdAt: string;
  changedBy?: { id: string; fullName: string; username: string };
}

export interface ProductionPlan {
  id: string;
  planNumber: string;
  name?: string | null;
  warehouseId: string;
  planDate: string;
  targetStartDate?: string | null;
  targetEndDate?: string | null;
  status: ProductionPlanStatus;
  notes?: string | null;
  rejectionReason?: string | null;
  cancellationReason?: string | null;
  createdAt: string;
  updatedAt: string;
  warehouse: { id: string; code: string; name: string };
  items?: ProductionPlanItem[];
  materialRequirements?: ProductionPlanMaterialRequirement[];
  statusHistory?: ProductionPlanStatusHistoryItem[];
  _count?: { items: number; materialRequirements?: number };
}

export interface ProductionPlanningDashboard {
  totalPlans: number;
  draftPlans: number;
  submittedPlans: number;
  approvedPlans: number;
  releasedPlans: number;
  cancelledPlans: number;
  plansWithShortages: number;
  recentPlans: ProductionPlan[];
}

export interface MaterialAvailabilityDetail {
  inventoryItemId: string;
  itemCode: string;
  itemName: string;
  itemType: string;
  uomSymbol: string;
  requiredBaseQuantity: string;
  availableQuantity: string;
  reservedQuantity: string;
  netAvailableQuantity: string;
  shortageQuantity: string;
  warehouses: Array<{
    warehouseId: string;
    warehouseCode: string;
    warehouseName: string;
    batchNumber: string | null;
    expiryDate: string | null;
    onHand: string;
    reserved: string;
    netAvailable: string;
  }>;
}

export type WorkOrderStatus =
  | 'DRAFT'
  | 'SUBMITTED'
  | 'APPROVED'
  | 'REJECTED'
  | 'RELEASED'
  | 'IN_PROGRESS'
  | 'COMPLETED'
  | 'CANCELLED';

export type WorkOrderPriority = 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT';

export interface WorkOrderMaterialRequirement {
  inventoryItemId: string;
  itemCode: string;
  itemName: string;
  itemType: string;
  uomCode: string;
  uomSymbol: string;
  requiredQuantity: string;
  availableQuantity: string;
  reservedQuantity: string;
  netAvailableQuantity: string;
  shortageQuantity: string;
  warehouses: string[];
}

export interface WorkOrderScheduleConflict {
  workOrderId: string;
  workOrderNumber: string;
  status: WorkOrderStatus;
  reason: string;
}

export interface WorkOrderStatusHistoryItem {
  id: string;
  fromStatus: WorkOrderStatus | null;
  toStatus: WorkOrderStatus;
  reason?: string | null;
  createdAt: string;
  changedBy?: { id: string; fullName: string; username: string };
}

export interface WorkOrder {
  id: string;
  workOrderNumber: string;
  financialYear: string;
  productionPlanId: string;
  productionPlanItemId: string;
  productVariantId: string;
  inventoryItemId: string;
  bomId: string;
  bomVersionId: string;
  warehouseId: string;
  uomId: string;
  plannedQuantity: string;
  allocatedBatchQuantity?: string;
  actualGoodQuantity?: string;
  actualScrapQuantity?: string;
  completedQuantity: string;
  status: WorkOrderStatus;
  priority: WorkOrderPriority;
  plannedStartDate?: string | null;
  plannedEndDate?: string | null;
  productionLine?: string | null;
  assignedToId?: string | null;
  notes?: string | null;
  instructions?: string | null;
  rejectionReason?: string | null;
  cancellationReason?: string | null;
  createdAt: string;
  updatedAt: string;
  productionPlan?: { id: string; planNumber: string; name?: string | null; status: ProductionPlanStatus };
  productionPlanItem?: {
    id: string;
    lineNumber: number;
    plannedQuantity: string;
    workOrderedQuantity: string;
  };
  productVariant?: {
    id: string;
    sku: string;
    name: string;
    product?: { id: string; code: string; name: string };
  };
  bom?: { id: string; code: string; name: string };
  bomVersion?: {
    id: string;
    versionNumber: number;
    status: string;
    expectedGoodOutput: string;
    yieldPercentage: string;
    expectedWastagePercent: string;
  };
  warehouse?: { id: string; code: string; name: string };
  uom?: { id: string; code: string; symbol: string };
  assignedTo?: { id: string; fullName: string; username: string } | null;
  materialRequirements?: WorkOrderMaterialRequirement[];
  scheduleConflicts?: WorkOrderScheduleConflict[];
  statusHistory?: WorkOrderStatusHistoryItem[];
}

export interface WorkOrderDashboardSummary {
  totalWorkOrders: number;
  draftCount: number;
  submittedCount: number;
  approvedCount: number;
  releasedCount: number;
  inProgressCount: number;
  completedCount: number;
  cancelledCount: number;
  urgentCount: number;
  recentWorkOrders: WorkOrder[];
}

export type ProductionBatchStatus =
  | 'CREATED'
  | 'IN_PROGRESS'
  | 'PAUSED'
  | 'COMPLETED'
  | 'CANCELLED';

export interface ProductionBatchExpectedMaterial {
  bomItemId: string;
  inventoryItemId: string;
  itemCode: string;
  itemName: string;
  itemType: string;
  uomId: string;
  uomCode: string;
  uomSymbol: string;
  expectedQuantity: string;
  consumedQuantity: string;
  remainingQuantity: string;
}

export interface ProductionBatchConsumption {
  id: string;
  inventoryItemId: string;
  warehouseId: string;
  batchId?: string | null;
  uomId: string;
  plannedQuantity: string;
  consumedQuantity: string;
  baseQuantity: string;
  unitCost: string;
  totalCost: string;
  inventoryIssueId?: string | null;
  inventoryTransactionId?: string | null;
  consumedAt: string;
  notes?: string | null;
  inventoryItem?: { id: string; code: string; name: string; itemType: string };
  warehouse?: { id: string; code: string; name: string };
  batch?: { id: string; batchNumber: string; expiryDate?: string | null } | null;
  uom?: { id: string; code: string; symbol: string };
  consumedBy?: { id: string; fullName: string; username: string };
}

export interface ProductionBatchStatusHistoryItem {
  id: string;
  fromStatus: ProductionBatchStatus | null;
  toStatus: ProductionBatchStatus;
  reason?: string | null;
  createdAt: string;
  changedBy?: { id: string; fullName: string; username: string };
}

export interface ProductionExecutionEntryItem {
  id: string;
  entryType: string;
  goodQuantity?: string | null;
  rejectedQuantity?: string | null;
  wastageQuantity?: string | null;
  reason?: string | null;
  notes?: string | null;
  createdAt: string;
  recordedBy?: { id: string; fullName: string; username: string };
}

export interface ProductionBatch {
  id: string;
  batchNumber: string;
  financialYear: string;
  workOrderId: string;
  productId: string;
  productVariantId: string;
  inventoryItemId: string;
  bomId: string;
  bomVersionId: string;
  warehouseId: string;
  uomId: string;
  plannedQuantity: string;
  actualGoodQuantity: string;
  rejectedQuantity: string;
  wastageQuantity: string;
  actualYieldPercent: string;
  completionPercent: string;
  wastageReason?: string | null;
  notes?: string | null;
  status: ProductionBatchStatus;
  operatorId: string;
  startedAt?: string | null;
  pausedAt?: string | null;
  completedAt?: string | null;
  cancelledAt?: string | null;
  cancellationReason?: string | null;
  manufacturingDate?: string | null;
  expiryDate?: string | null;
  materialsReserved: boolean;
  finishedGoodsBatchId?: string | null;
  finishedGoodsReceiptId?: string | null;
  finishedGoodsTransactionId?: string | null;
  createdAt: string;
  updatedAt: string;
  workOrder?: {
    id: string;
    workOrderNumber: string;
    status: WorkOrderStatus;
    plannedQuantity: string;
    allocatedBatchQuantity: string;
    actualGoodQuantity: string;
    actualScrapQuantity: string;
  };
  product?: { id: string; code: string; name: string };
  productVariant?: { id: string; sku: string; name: string };
  bom?: { id: string; code: string; name: string };
  bomVersion?: {
    id: string;
    versionNumber: number;
    status: string;
    expectedGoodOutput: string;
    yieldPercentage: string;
    expectedWastagePercent: string;
  };
  warehouse?: { id: string; code: string; name: string };
  uom?: { id: string; code: string; symbol: string };
  operator?: { id: string; fullName: string; username: string };
  finishedGoodsBatch?: {
    id: string;
    batchNumber: string;
    manufacturingDate?: string | null;
    expiryDate?: string | null;
    unitCost: string;
  } | null;
  expectedMaterials?: ProductionBatchExpectedMaterial[];
  consumptions?: ProductionBatchConsumption[];
  statusHistory?: ProductionBatchStatusHistoryItem[];
  executionEntries?: ProductionExecutionEntryItem[];
}

export interface ProductionExecutionDashboard {
  totalBatches: number;
  createdCount: number;
  inProgressCount: number;
  pausedCount: number;
  completedCount: number;
  cancelledCount: number;
  releasedWorkOrdersCount: number;
  recentBatches: ProductionBatch[];
}

export type QualityStatus = 'PENDING_INSPECTION' | 'ACCEPTED' | 'QUARANTINED' | 'REJECTED';
export type InspectionDecision = 'PENDING' | 'ACCEPTED' | 'PARTIALLY_ACCEPTED' | 'QUARANTINED' | 'REJECTED';
export type VarianceApprovalStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

export interface BatchVarianceApproval {
  id: string;
  inventoryItemId: string;
  expectedQuantity: string;
  actualQuantity: string;
  varianceQuantity: string;
  variancePercent: string;
  thresholdPercent: string;
  status: VarianceApprovalStatus;
  reason: string;
  approvedAt?: string | null;
  approvedBy?: { id: string; fullName: string; username: string } | null;
}

export interface BatchReconciliationLine {
  inventoryItemId: string;
  itemCode: string;
  itemName: string;
  uomId: string;
  uomSymbol: string;
  bomStandardQuantity: string;
  expectedWastage: string;
  expectedTotalQuantity: string;
  actualConsumedQuantity: string;
  returnedQuantity: string;
  netConsumedQuantity: string;
  quantityVariance: string;
  variancePercent: string;
  thresholdPercent: string;
  exceedsThreshold: boolean;
  approval?: BatchVarianceApproval | null;
}

export interface BatchReturnItem {
  id: string;
  inventoryItemId: string;
  warehouseId: string;
  batchId?: string | null;
  uomId: string;
  returnedQuantity: string;
  baseQuantity: string;
  reason: string;
  returnedAt: string;
  warehouse?: { id: string; code: string; name: string };
  batch?: { id: string; batchNumber: string } | null;
  returnedBy?: { id: string; fullName: string; username: string };
}

export interface BatchReconciliation {
  batchId: string;
  batchNumber: string;
  status: ProductionBatchStatus;
  workOrder?: { id: string; workOrderNumber: string };
  productVariant?: { id: string; sku: string; name: string };
  uom?: { id: string; code: string; symbol: string };
  plannedQuantity: string;
  actualGoodQuantity: string;
  expectedOutputWastage: string;
  actualOutputWastage: string;
  thresholdPercent: string;
  lines: BatchReconciliationLine[];
  returns: BatchReturnItem[];
}

export interface QualityInspectionItem {
  id: string;
  inspectionNumber: string;
  productionBatchId: string;
  inventoryBatchId: string;
  warehouseId: string;
  inspectedQuantity: string;
  goodQuantity: string;
  rejectedQuantity: string;
  decision: InspectionDecision;
  defectCategory?: string | null;
  notes?: string | null;
  evidenceRef?: string | null;
  inspectedAt?: string | null;
  releasedAt?: string | null;
  releaseNotes?: string | null;
  productionBatch?: {
    id: string;
    batchNumber: string;
    productVariant?: { id: string; sku: string; name: string };
    uom?: { id: string; code: string; symbol: string };
  };
  inventoryBatch?: {
    id: string;
    batchNumber: string;
    qualityStatus: QualityStatus;
    manufacturingDate?: string | null;
    expiryDate?: string | null;
  };
  warehouse?: { id: string; code: string; name: string };
  inspector?: { id: string; fullName: string; username: string } | null;
  releasedBy?: { id: string; fullName: string; username: string } | null;
}

export interface RecallLookupMatch {
  id: string;
  batchNumber: string;
  qualityStatus: QualityStatus;
  manufacturingDate?: string | null;
  expiryDate?: string | null;
  inventoryItem?: { id: string; code: string; name: string; itemType: string };
  producedFromBatches?: Array<{
    id: string;
    batchNumber: string;
    workOrder?: { id: string; workOrderNumber: string };
    qualityInspection?: QualityInspectionItem | null;
    consumptions?: Array<{
      id: string;
      baseQuantity: string;
      inventoryItem?: { id: string; code: string; name: string };
      batch?: { id: string; batchNumber: string; expiryDate?: string | null } | null;
    }>;
  }>;
  consumedInBatches?: Array<{
    id: string;
    baseQuantity: string;
    productionBatch?: {
      id: string;
      batchNumber: string;
      workOrder?: { id: string; workOrderNumber: string };
      finishedGoodsBatch?: {
        id: string;
        batchNumber: string;
        qualityStatus: QualityStatus;
        manufacturingDate?: string | null;
        expiryDate?: string | null;
      } | null;
    };
  }>;
  transactionLines?: Array<{
    id: string;
    quantity: string;
    transaction?: {
      id: string;
      transactionNumber: string;
      referenceId: string;
      referenceNumber: string;
      transactionDate: string;
    };
  }>;
}

export interface RecallLookupResponse {
  query: string;
  matches: RecallLookupMatch[];
}
