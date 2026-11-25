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

export type ProductionCostingStatus = 'DRAFT' | 'CALCULATED' | 'REVIEWED' | 'FINALIZED';
export type ProductionCostEntryType = 'DIRECT_LABOUR' | 'MACHINE_COST' | 'OTHER_DIRECT_EXPENSE';
export type CostEntryApprovalStatus = 'PENDING' | 'APPROVED' | 'REJECTED';
export type OverheadAllocationMethod =
  | 'PER_BATCH'
  | 'PER_UNIT'
  | 'PERCENT_OF_MATERIAL'
  | 'PER_LABOUR_HOUR';

export interface ProductionCostEntryItem {
  id: string;
  productionBatchCostingId: string;
  productionBatchId: string;
  entryType: ProductionCostEntryType;
  description: string;
  quantityOrHours: string;
  rate: string;
  totalAmount: string;
  reference?: string | null;
  approvalStatus: CostEntryApprovalStatus;
  notes?: string | null;
  recordedAt: string;
  recordedBy?: { id: string; fullName: string; username: string };
  approvedBy?: { id: string; fullName: string; username: string } | null;
  approvedAt?: string | null;
}

export interface ProductionOverheadAllocationItem {
  id: string;
  productionBatchCostingId: string;
  productionBatchId: string;
  bomOverheadId?: string | null;
  costType: string;
  description: string;
  allocationMethod: OverheadAllocationMethod;
  basisValue: string;
  rateOrAmount: string;
  allocatedAmount: string;
  isFromBom: boolean;
  createdAt: string;
  recordedBy?: { id: string; fullName: string; username: string };
}

export interface ProductionCostingHistoryItem {
  id: string;
  fromStatus?: ProductionCostingStatus | null;
  toStatus: ProductionCostingStatus;
  action: string;
  notes?: string | null;
  createdAt: string;
  changedBy?: { id: string; fullName: string; username: string };
}

export interface ProductionBatchCosting {
  id: string;
  productionBatchId: string;
  status: ProductionCostingStatus;
  plannedQuantity: string;
  actualGoodQuantity: string;
  acceptedQuantity: string;
  rejectedQuantity: string;
  wastageQuantity: string;
  standardMaterialCost: string;
  standardLabourCost: string;
  standardOverheadCost: string;
  standardTotalCost: string;
  grossMaterialCost: string;
  materialReturnCost: string;
  netMaterialCost: string;
  rawMaterialCost: string;
  packagingMaterialCost: string;
  actualLabourCost: string;
  actualMachineCost: string;
  otherDirectCost: string;
  actualOverheadCost: string;
  wastageAndRejectionCost: string;
  totalActualCost: string;
  goodOutputCost: string;
  costPerAcceptedUnit: string;
  materialVarianceAmount: string;
  materialVariancePercent: string;
  labourVarianceAmount: string;
  labourVariancePercent: string;
  overheadVarianceAmount: string;
  overheadVariancePercent: string;
  totalVarianceAmount: string;
  totalVariancePercent: string;
  fgValuationApplied: boolean;
  fgValuationUnitCost?: string | null;
  fgValuationAdjustmentTxId?: string | null;
  fgValuationAppliedAt?: string | null;
  postFinalizationAdjustmentNote?: string | null;
  calculatedAt?: string | null;
  reviewedAt?: string | null;
  reviewNotes?: string | null;
  finalizedAt?: string | null;
  calculatedBy?: { id: string; fullName: string; username: string } | null;
  reviewedBy?: { id: string; fullName: string; username: string } | null;
  finalizedBy?: { id: string; fullName: string; username: string } | null;
  costEntries?: ProductionCostEntryItem[];
  overheadAllocations?: ProductionOverheadAllocationItem[];
  history?: ProductionCostingHistoryItem[];
  productionBatch?: {
    id: string;
    batchNumber: string;
    status: ProductionBatchStatus;
    completedAt?: string | null;
    productVariant?: { id: string; sku: string; name: string };
    uom?: { symbol: string };
  };
}

export interface MaterialCostLineSummary {
  inventoryItemId: string;
  itemCode: string;
  itemName: string;
  itemType: string;
  baseUomSymbol: string;
  consumedQuantity: string;
  returnedQuantity: string;
  netQuantity: string;
  grossCost: string;
  returnCost: string;
  netCost: string;
  costSource: string;
  batches: Array<{
    batchId: string | null;
    batchNumber: string | null;
    consumedQty: string;
    returnedQty: string;
    unitCost: string;
    netCost: string;
    inventoryIssueId: string | null;
    inventoryTransactionId: string | null;
  }>;
}

export interface BatchCostingDetailResponse {
  batch: ProductionBatch;
  costing: ProductionBatchCosting | null;
  materialBreakdown: {
    grossMaterialCost: string;
    materialReturnCost: string;
    netMaterialCost: string;
    rawMaterialCost: string;
    packagingMaterialCost: string;
    ledgerIssueTotal: string;
    ledgerReturnTotal: string;
    isLedgerReconciled: boolean;
    lines: MaterialCostLineSummary[];
  };
}

export interface CostingDashboardSummary {
  totalBatches: number;
  costedBatchesCount: number;
  pendingCostEntryApprovals: number;
  statusCounts: Record<string, number>;
  totalStandardCost: string;
  totalActualCost: string;
  totalVarianceAmount: string;
  totalVariancePercent: string;
  totalWastageCost: string;
  recentCostings: ProductionBatchCosting[];
}

export interface CostVarianceReportResponse {
  summary: {
    batchCount: number;
    standardTotalCost: string;
    actualTotalCost: string;
    materialVarianceAmount: string;
    labourVarianceAmount: string;
    overheadVarianceAmount: string;
    totalVarianceAmount: string;
    totalVariancePercent: string;
  };
  rows: ProductionBatchCosting[];
}

export type ReportPeriod = 'today' | 'week' | 'month' | 'fy' | 'custom';
export type TrendGranularity = 'daily' | 'weekly' | 'monthly';

export interface ProductionReportQuery {
  period?: ReportPeriod;
  fromDate?: string;
  toDate?: string;
  productId?: string;
  productCategoryId?: string;
  productVariantId?: string;
  warehouseId?: string;
  status?: string;
  priority?: string;
  search?: string;
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  granularity?: TrendGranularity;
}

export interface ProductionAnalyticsDashboard {
  dateRange: {
    period: string;
    financialYear: string;
    fromDate: string;
    toDate: string;
  };
  kpis: {
    totalProductionPlans: number;
    pendingProductionPlans: number;
    totalWorkOrders: number;
    activeWorkOrders: number;
    completedWorkOrders: number;
    totalProductionBatches: number;
    batchesInProgress: number;
    completedBatches: number;
    plannedProductionQuantity: string;
    actualProducedQuantity: string;
    acceptedFinishedGoodsQuantity: string;
    rejectedQuantity: string;
    overallYieldPercentage: string;
    materialWastagePercentage: string;
    costAccess: boolean;
    totalActualProductionCost: string | null;
    averageCostPerAcceptedUnit: string | null;
    productionCostVariance: string | null;
  };
}

export interface ProductionTrendPoint {
  period: string;
  plannedQuantity: string;
  actualQuantity: string;
  rejectedQuantity: string;
  wastageQuantity: string;
  yieldPercent: string;
  wastagePercent: string;
  completedBatches: number;
  totalCost: string | null;
}

export interface ProductionTrendsResponse {
  granularity: TrendGranularity;
  series: ProductionTrendPoint[];
}

export interface PlanVsActualRow {
  planId: string;
  planNumber: string;
  planName?: string | null;
  planDate: string;
  planStatus: string;
  warehouseName: string;
  productName: string;
  sku: string;
  variantName: string;
  uomSymbol: string;
  plannedQuantity: string;
  workOrderedQuantity: string;
  actualProducedQuantity: string;
  acceptedQuantity: string;
  rejectedQuantity: string;
  remainingQuantity: string;
  completionPercent: string;
  varianceClassification: string;
  startedAt?: string | null;
  completedAt?: string | null;
}

export interface WorkOrderPerformanceRow {
  id: string;
  workOrderNumber: string;
  productionPlanNumber: string;
  productName: string;
  sku: string;
  warehouseName: string;
  uomSymbol: string;
  plannedQuantity: string;
  allocatedBatchQuantity: string;
  actualGoodQuantity: string;
  scrapQuantity: string;
  status: string;
  priority: string;
  plannedStartDate?: string | null;
  plannedEndDate?: string | null;
  executionDurationHours?: string | null;
  delayDays: number;
  isOverdue: boolean;
  batchCount: number;
}

export interface BatchYieldReportRow {
  id: string;
  batchNumber: string;
  workOrderNumber: string;
  productName: string;
  sku: string;
  bomVersionNumber: number;
  uomSymbol: string;
  plannedQuantity: string;
  actualOutputQuantity: string;
  acceptedQuantity: string;
  rejectedQuantity: string;
  scrapQuantity: string;
  actualYieldPercent: string;
  expectedYieldPercent: string;
  yieldVariancePercent: string;
  isLowYield: boolean;
  productionDurationHours?: string | null;
  status: string;
  expiryDate?: string | null;
}

export interface MaterialConsumptionReportRow {
  productionBatchId: string;
  batchNumber: string;
  productName: string;
  inventoryItemId: string;
  itemCode: string;
  itemName: string;
  itemType: string;
  uomSymbol: string;
  warehouseName: string;
  sourceBatchNumbers: string;
  bomPlannedQuantity: string;
  actualConsumedQuantity: string;
  returnedQuantity: string;
  netConsumption: string;
  expectedWastage: string;
  actualWastage: string;
  consumptionVariance: string;
  wastagePercent: string;
  materialCost: string;
}

export interface ProductionQualityReportRow {
  id: string;
  inspectionNumber: string;
  productionBatchNumber: string;
  inventoryBatchNumber: string;
  productName: string;
  uomSymbol: string;
  decision: string;
  qualityStatus: string;
  inspectedQuantity: string;
  acceptedQuantity: string;
  rejectedQuantity: string;
  quarantinedQuantity: string;
  pendingQuantity: string;
  defectCategory?: string | null;
  manufacturingDate?: string | null;
  expiryDate?: string | null;
}

export interface ProductionCostAnalyticsRow {
  id: string;
  productionBatchId: string;
  batchNumber: string;
  productName: string;
  uomSymbol: string;
  status: ProductionCostingStatus;
  isFinalized: boolean;
  standardMaterialCost: string;
  actualMaterialCost: string;
  labourCost: string;
  machineCost: string;
  directExpenses: string;
  overheadCost: string;
  standardTotalCost: string;
  totalActualCost: string;
  costVariance: string;
  costVariancePercent: string;
  acceptedGoodQuantity: string;
  costPerAcceptedUnit: string;
  wastageAndRejectionCost: string;
}
