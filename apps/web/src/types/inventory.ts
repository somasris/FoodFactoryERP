export type InventoryDocStatus = 'DRAFT' | 'SUBMITTED' | 'APPROVED' | 'POSTED' | 'CANCELLED';
export type TransferDocStatus = 'DRAFT' | 'APPROVED' | 'IN_TRANSIT' | 'RECEIVED' | 'CANCELLED';
export type PickingStrategy = 'FIFO' | 'FEFO';
export type AdjustmentReason =
  | 'PHYSICAL_COUNT'
  | 'DAMAGE'
  | 'SPOILAGE'
  | 'EXPIRY'
  | 'SHRINKAGE'
  | 'OPENING_STOCK'
  | 'OTHER';

export interface WarehouseRef {
  id: string;
  code: string;
  name: string;
  warehouseType?: string;
}

export interface UomRef {
  id: string;
  code: string;
  symbol: string;
}

export interface InventoryItemSummary {
  id: string;
  code: string;
  name: string;
  itemType: 'RAW_MATERIAL' | 'PACKAGING' | 'FINISHED_GOODS';
  valuationMethod?: 'MWAC' | 'BATCH_ACTUAL' | 'STANDARD';
  movingAverageCost?: string;
  uom?: UomRef;
}

export interface InventoryBatchRecord {
  id: string;
  inventoryItemId: string;
  batchNumber: string;
  manufacturingDate?: string | null;
  expiryDate?: string | null;
  receivedDate: string;
  unitCost: string;
  supplierBatchRef?: string | null;
  totalOnHand?: string;
  expiryState?: 'EXPIRED' | 'EXPIRING_SOON' | 'VALID' | 'NO_EXPIRY';
  inventoryItem?: InventoryItemSummary;
  balances?: Array<{
    id: string;
    warehouseId: string;
    quantityOnHand: string;
    quantityReserved: string;
    warehouse: WarehouseRef;
  }>;
}

export interface InventoryBalanceRecord {
  id: string;
  warehouseId: string;
  inventoryItemId: string;
  batchId?: string | null;
  quantityOnHand: string;
  quantityReserved: string;
  availableQuantity: string;
  unitCost: string;
  totalValue: string;
  isExpired: boolean;
  lastTransactionAt?: string | null;
  warehouse: WarehouseRef;
  inventoryItem: InventoryItemSummary;
  batch?: {
    id: string;
    batchNumber: string;
    manufacturingDate?: string | null;
    expiryDate?: string | null;
    receivedDate: string;
    unitCost: string;
  } | null;
}

export interface InventoryValuationRecord {
  id: string;
  code: string;
  name: string;
  itemType: 'RAW_MATERIAL' | 'PACKAGING' | 'FINISHED_GOODS';
  valuationMethod: 'MWAC' | 'BATCH_ACTUAL' | 'STANDARD';
  movingAverageCost: string;
  uom: UomRef;
  totalQuantityOnHand: string;
  totalStockValue: string;
}

export interface InventoryTransactionLineRecord {
  id: string;
  lineNumber: number;
  inventoryItemId: string;
  batchId?: string | null;
  quantity: string;
  baseQuantity: string;
  unitCost: string;
  totalCost: string;
  balanceAfter: string;
  mwacAfter?: string | null;
  inventoryItem?: { id: string; code: string; name: string };
  batch?: { id: string; batchNumber: string } | null;
  uom?: UomRef;
  baseUom?: UomRef;
}

export interface InventoryTransactionRecord {
  id: string;
  transactionNumber: string;
  transactionType:
    | 'RECEIPT'
    | 'ISSUE'
    | 'TRANSFER_OUT'
    | 'TRANSFER_IN'
    | 'ADJUSTMENT_IN'
    | 'ADJUSTMENT_OUT'
    | 'REVERSAL';
  referenceType: string;
  referenceId: string;
  referenceNumber: string;
  warehouseId: string;
  transactionDate: string;
  remarks?: string | null;
  warehouse: WarehouseRef;
  postedBy?: { id: string; fullName: string; username: string };
  reversedTransaction?: { id: string; transactionNumber: string } | null;
  reversalOf?: { id: string; transactionNumber: string } | null;
  lines?: InventoryTransactionLineRecord[];
  _count?: { lines: number };
}

export interface InventoryDashboardSummary {
  totalStockValue: string;
  activeSkuCount: number;
  activeWarehouseCount: number;
  balanceRowCount: number;
  expiringSoonCount: number;
  expiredStockCount: number;
  pendingDocuments: {
    receipts: number;
    issues: number;
    inTransitTransfers: number;
    adjustments: number;
  };
  recentTransactions: InventoryTransactionRecord[];
}

export interface InventoryReceiptRecord {
  id: string;
  receiptNumber: string;
  warehouseId: string;
  status: InventoryDocStatus;
  receiptDate: string;
  supplierRef?: string | null;
  notes?: string | null;
  createdAt: string;
  warehouse: WarehouseRef;
  lines: Array<{
    id: string;
    lineNumber: number;
    inventoryItemId: string;
    uomId: string;
    quantity: string;
    baseQuantity: string;
    unitCost: string;
    totalCost: string;
    batchNumber?: string | null;
    manufacturingDate?: string | null;
    expiryDate?: string | null;
    inventoryItem?: InventoryItemSummary;
    uom?: UomRef;
  }>;
}

export interface InventoryIssueRecord {
  id: string;
  issueNumber: string;
  warehouseId: string;
  status: InventoryDocStatus;
  pickingStrategy: PickingStrategy;
  issueDate: string;
  departmentRef?: string | null;
  purpose?: string | null;
  notes?: string | null;
  createdAt: string;
  warehouse: WarehouseRef;
  lines: Array<{
    id: string;
    lineNumber: number;
    inventoryItemId: string;
    uomId: string;
    requestedQuantity: string;
    baseQuantity: string;
    unitCost: string;
    totalCost: string;
    batchId?: string | null;
    inventoryItem?: InventoryItemSummary;
    uom?: UomRef;
    batch?: { id: string; batchNumber: string; expiryDate?: string | null } | null;
  }>;
}

export interface InventoryTransferRecord {
  id: string;
  transferNumber: string;
  sourceWarehouseId: string;
  destinationWarehouseId: string;
  status: TransferDocStatus;
  transferDate: string;
  notes?: string | null;
  createdAt: string;
  sourceWarehouse: WarehouseRef;
  destinationWarehouse: WarehouseRef;
  lines: Array<{
    id: string;
    lineNumber: number;
    inventoryItemId: string;
    uomId: string;
    quantity: string;
    baseQuantity: string;
    dispatchedBaseQuantity: string;
    receivedBaseQuantity: string;
    unitCost: string;
    totalCost: string;
    batchId?: string | null;
    inventoryItem?: InventoryItemSummary;
    uom?: UomRef;
    batch?: { id: string; batchNumber: string } | null;
  }>;
}

export interface InventoryAdjustmentRecord {
  id: string;
  adjustmentNumber: string;
  warehouseId: string;
  status: InventoryDocStatus;
  adjustmentDate: string;
  reason: AdjustmentReason;
  notes?: string | null;
  createdAt: string;
  warehouse: WarehouseRef;
  lines: Array<{
    id: string;
    lineNumber: number;
    inventoryItemId: string;
    uomId: string;
    quantityDelta: string;
    baseQuantityDelta: string;
    unitCost: string;
    totalCost: string;
    batchId?: string | null;
    inventoryItem?: InventoryItemSummary;
    uom?: UomRef;
    batch?: { id: string; batchNumber: string } | null;
  }>;
}
