import { Router } from 'express';
import { authenticate, requirePermissions } from '../../middleware/auth.middleware';
import { InventoryController } from './inventory.controller';

export const inventoryRouter: Router = Router();

// All Inventory routes require valid JWT authentication
inventoryRouter.use(authenticate);

// Dashboard, Balances, Batches, Valuation, Transactions
inventoryRouter.get('/dashboard', requirePermissions('inventory.read'), InventoryController.dashboard);
inventoryRouter.get('/balances', requirePermissions('inventory.read'), InventoryController.listBalances);
inventoryRouter.get('/batches', requirePermissions('inventory.read'), InventoryController.listBatches);
inventoryRouter.get(
  '/valuation',
  requirePermissions('inventory.valuation.read'),
  InventoryController.listValuation,
);
inventoryRouter.get(
  '/valuation/:itemId/history',
  requirePermissions('inventory.valuation.read'),
  InventoryController.getValuationHistory,
);
inventoryRouter.get(
  '/transactions',
  requirePermissions('inventory.read'),
  InventoryController.listTransactions,
);
inventoryRouter.get(
  '/transactions/:id',
  requirePermissions('inventory.read'),
  InventoryController.getTransactionById,
);
inventoryRouter.post(
  '/transactions/:id/reverse',
  requirePermissions('inventory.adjustment.post'),
  InventoryController.reverseTransaction,
);

// Receipts
inventoryRouter.get('/receipts', requirePermissions('inventory.read'), InventoryController.listReceipts);
inventoryRouter.get('/receipts/:id', requirePermissions('inventory.read'), InventoryController.getReceiptById);
inventoryRouter.post(
  '/receipts',
  requirePermissions('inventory.receipt.create'),
  InventoryController.createReceipt,
);
inventoryRouter.post(
  '/receipts/:id/submit',
  requirePermissions('inventory.receipt.create'),
  InventoryController.submitReceipt,
);
inventoryRouter.post(
  '/receipts/:id/approve',
  requirePermissions('inventory.receipt.approve'),
  InventoryController.approveReceipt,
);
inventoryRouter.post(
  '/receipts/:id/post',
  requirePermissions('inventory.receipt.post'),
  InventoryController.postReceipt,
);
inventoryRouter.post(
  '/receipts/:id/cancel',
  requirePermissions('inventory.receipt.create'),
  InventoryController.cancelReceipt,
);

// Issues
inventoryRouter.get('/issues', requirePermissions('inventory.read'), InventoryController.listIssues);
inventoryRouter.get('/issues/:id', requirePermissions('inventory.read'), InventoryController.getIssueById);
inventoryRouter.post(
  '/issues',
  requirePermissions('inventory.issue.create'),
  InventoryController.createIssue,
);
inventoryRouter.post(
  '/issues/:id/submit',
  requirePermissions('inventory.issue.create'),
  InventoryController.submitIssue,
);
inventoryRouter.post(
  '/issues/:id/approve',
  requirePermissions('inventory.issue.approve'),
  InventoryController.approveIssue,
);
inventoryRouter.post(
  '/issues/:id/post',
  requirePermissions('inventory.issue.post'),
  InventoryController.postIssue,
);
inventoryRouter.post(
  '/issues/:id/cancel',
  requirePermissions('inventory.issue.create'),
  InventoryController.cancelIssue,
);

// Transfers
inventoryRouter.get('/transfers', requirePermissions('inventory.read'), InventoryController.listTransfers);
inventoryRouter.get('/transfers/:id', requirePermissions('inventory.read'), InventoryController.getTransferById);
inventoryRouter.post(
  '/transfers',
  requirePermissions('inventory.transfer.create'),
  InventoryController.createTransfer,
);
inventoryRouter.post(
  '/transfers/:id/approve',
  requirePermissions('inventory.transfer.approve'),
  InventoryController.approveTransfer,
);
inventoryRouter.post(
  '/transfers/:id/dispatch',
  requirePermissions('inventory.transfer.dispatch'),
  InventoryController.dispatchTransfer,
);
inventoryRouter.post(
  '/transfers/:id/receive',
  requirePermissions('inventory.transfer.receive'),
  InventoryController.receiveTransfer,
);
inventoryRouter.post(
  '/transfers/:id/cancel',
  requirePermissions('inventory.transfer.create'),
  InventoryController.cancelTransfer,
);

// Adjustments
inventoryRouter.get('/adjustments', requirePermissions('inventory.read'), InventoryController.listAdjustments);
inventoryRouter.get(
  '/adjustments/:id',
  requirePermissions('inventory.read'),
  InventoryController.getAdjustmentById,
);
inventoryRouter.post(
  '/adjustments',
  requirePermissions('inventory.adjustment.create'),
  InventoryController.createAdjustment,
);
inventoryRouter.post(
  '/adjustments/:id/submit',
  requirePermissions('inventory.adjustment.create'),
  InventoryController.submitAdjustment,
);
inventoryRouter.post(
  '/adjustments/:id/approve',
  requirePermissions('inventory.adjustment.approve'),
  InventoryController.approveAdjustment,
);
inventoryRouter.post(
  '/adjustments/:id/post',
  requirePermissions('inventory.adjustment.post'),
  InventoryController.postAdjustment,
);
inventoryRouter.post(
  '/adjustments/:id/cancel',
  requirePermissions('inventory.adjustment.create'),
  InventoryController.cancelAdjustment,
);
