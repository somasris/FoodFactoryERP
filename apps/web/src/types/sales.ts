export type SalesOrderStatus =
  | 'DRAFT'
  | 'SUBMITTED'
  | 'APPROVED'
  | 'REJECTED'
  | 'CONFIRMED'
  | 'PARTIALLY_FULFILLED'
  | 'FULFILLED'
  | 'CANCELLED';

export interface SalesOrderLine {
  id: string;
  lineNumber: number;
  productVariantId: string;
  inventoryItemId: string;
  uomId: string;
  orderedQuantity: string;
  baseQuantity: string;
  reservedBaseQuantity: string;
  fulfilledBaseQuantity: string;
  invoicedBaseQuantity?: string;
  unitPrice: string;
  discountPercent: string;
  taxRateId: string;
  taxPercentage: string;
  taxableAmount: string;
  taxAmount: string;
  lineTotal: string;
  notes?: string | null;
  productVariant?: {
    id: string;
    sku: string;
    name: string;
    defaultSellingPrice: string;
    uomId: string;
    product?: { id: string; code: string; name: string; hsnCode: string };
  };
  uom?: { id: string; code: string; symbol: string };
  taxRate?: { id: string; code: string; name: string; ratePercentage: string };
}

export interface SalesOrderStatusHistoryItem {
  id: string;
  fromStatus: SalesOrderStatus | null;
  toStatus: SalesOrderStatus;
  reason?: string | null;
  createdAt: string;
  changedBy?: { id: string; fullName: string; username: string };
}

export interface SalesOrderFulfillmentItem {
  id: string;
  fulfillmentNumber: string;
  inventoryIssueId: string;
  fulfilledAt: string;
  notes?: string | null;
}

export interface SalesOrder {
  id: string;
  orderNumber: string;
  customerId: string;
  shippingAddressId?: string | null;
  warehouseId: string;
  salesmanId?: string | null;
  orderDate: string;
  expectedDeliveryDate?: string | null;
  status: SalesOrderStatus;
  subtotal: string;
  discountAmount: string;
  taxAmount: string;
  totalAmount: string;
  notes?: string | null;
  deliveryInstructions?: string | null;
  rejectionReason?: string | null;
  cancellationReason?: string | null;
  createdAt: string;
  updatedAt: string;
  customer: {
    id: string;
    code: string;
    legalName: string;
    tradeName?: string | null;
    customerType: string;
    gstin?: string | null;
    phone?: string | null;
    email?: string | null;
  };
  shippingAddress?: {
    id: string;
    addressLine1: string;
    city: string;
    state: string;
    pincode: string;
  } | null;
  warehouse: { id: string; code: string; name: string; warehouseType?: string };
  salesman?: { id: string; fullName: string; username: string } | null;
  lines?: SalesOrderLine[];
  statusHistory?: SalesOrderStatusHistoryItem[];
  fulfillments?: SalesOrderFulfillmentItem[];
  _count?: { lines: number };
}

export interface SalesInvoiceMetrics {
  totalInvoices: number;
  draftInvoices: number;
  issuedInvoices: number;
  cancelledInvoices: number;
  totalInvoicedValue: string;
  invoiceTrends: Array<{ period: string; count: number; totalValue: string }>;
}

export interface SalesDashboardSummary {
  totalOrders: number;
  draftOrders: number;
  pendingApprovals: number;
  approvedOrders: number;
  confirmedOrders: number;
  partiallyFulfilledOrders: number;
  fulfilledOrders: number;
  cancelledOrders: number;
  rejectedOrders: number;
  confirmedSalesValue: string;
  recentOrders: SalesOrder[];
  invoiceMetrics?: SalesInvoiceMetrics;
}

export type SalesInvoiceStatus = 'DRAFT' | 'ISSUED' | 'CANCELLED';

export interface SalesInvoiceLine {
  id: string;
  salesOrderLineId: string;
  lineNumber: number;
  productVariantId: string;
  inventoryItemId: string;
  uomId: string;
  taxRateId: string;
  itemCode: string;
  itemName: string;
  description?: string | null;
  hsnCode: string;
  uomCode: string;
  uomSymbol: string;
  quantity: string;
  baseQuantity: string;
  unitPrice: string;
  discountPercent: string;
  discountAmount: string;
  taxableAmount: string;
  gstRate: string;
  cgstRate: string;
  sgstRate: string;
  igstRate: string;
  cgstAmount: string;
  sgstAmount: string;
  igstAmount: string;
  taxAmount: string;
  lineTotal: string;
}

export interface SalesInvoiceStatusHistoryItem {
  id: string;
  fromStatus: SalesInvoiceStatus | null;
  toStatus: SalesInvoiceStatus;
  reason?: string | null;
  createdAt: string;
  changedBy?: { id: string; fullName: string; username: string };
}

export interface SalesInvoice {
  id: string;
  invoiceNumber: string;
  financialYear: string;
  salesOrderId: string;
  fulfillmentId?: string | null;
  customerId: string;
  billingAddressId?: string | null;
  warehouseId: string;
  companyId: string;
  invoiceDate: string;
  dueDate?: string | null;
  status: SalesInvoiceStatus;
  companyLegalName: string;
  companyGstin: string;
  companyStateCode: string;
  companyAddress: string;
  customerLegalName: string;
  customerGstin?: string | null;
  customerStateCode: string;
  customerBillingAddress: string;
  placeOfSupply: string;
  isInterState: boolean;
  subtotal: string;
  discountAmount: string;
  taxableAmount: string;
  cgstAmount: string;
  sgstAmount: string;
  igstAmount: string;
  taxAmount: string;
  roundOffAmount: string;
  grandTotal: string;
  notes?: string | null;
  termsAndConditions?: string | null;
  cancellationReason?: string | null;
  issuedAt?: string | null;
  cancelledAt?: string | null;
  createdAt: string;
  updatedAt: string;
  salesOrder: { id: string; orderNumber: string; status?: string; orderDate?: string };
  fulfillment?: { id: string; fulfillmentNumber: string; fulfilledAt: string } | null;
  customer: {
    id: string;
    code: string;
    legalName: string;
    tradeName?: string | null;
    gstin?: string | null;
    phone?: string | null;
    email?: string | null;
  };
  warehouse: { id: string; code: string; name: string };
  lines?: SalesInvoiceLine[];
  statusHistory?: SalesInvoiceStatusHistoryItem[];
  _count?: { lines: number };
}
