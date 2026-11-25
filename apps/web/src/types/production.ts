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
