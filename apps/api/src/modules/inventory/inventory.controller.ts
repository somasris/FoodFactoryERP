import { Request, Response, NextFunction } from 'express';
import { sendSuccess } from '../../utils/response';
import { getAuditMeta, parsePagination } from '../master-data/master-data.utils';
import {
  createAdjustmentSchema,
  createIssueSchema,
  createReceiptSchema,
  createTransferSchema,
  idempotencySchema,
  reverseTransactionSchema,
} from './inventory.types';
import { UserContext } from './inventory.utils';
import { InventoryLedgerService } from './inventory-ledger.service';
import { InventoryReceiptService } from './inventory-receipt.service';
import { InventoryIssueService } from './inventory-issue.service';
import { InventoryTransferService } from './inventory-transfer.service';
import { InventoryAdjustmentService } from './inventory-adjustment.service';

const getUserCtx = (req: Request): UserContext => ({
  userId: req.user!.userId,
  roles: req.user!.roles || [],
});

const getStr = (val: unknown): string | undefined => (typeof val === 'string' && val.trim() ? val.trim() : undefined);

export class InventoryController {
  // --- Dashboard, Balances, Batches, Valuation, Transactions ---
  static async dashboard(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await InventoryLedgerService.getDashboardSummary(getUserCtx(req));
      sendSuccess(res, 'Inventory dashboard summary retrieved successfully', data);
    } catch (error) {
      next(error);
    }
  }

  static async listBalances(req: Request, res: Response, next: NextFunction) {
    try {
      const params = parsePagination(req.query as Record<string, unknown>);
      const data = await InventoryLedgerService.listBalances(params, getUserCtx(req), {
        warehouseId: getStr(req.query.warehouseId),
        inventoryItemId: getStr(req.query.inventoryItemId),
        itemType: getStr(req.query.itemType),
        includeZero: req.query.includeZero === 'true',
      });
      sendSuccess(res, 'Inventory balances retrieved successfully', data);
    } catch (error) {
      next(error);
    }
  }

  static async listBatches(req: Request, res: Response, next: NextFunction) {
    try {
      const params = parsePagination(req.query as Record<string, unknown>);
      const data = await InventoryLedgerService.listBatches(params, getUserCtx(req), {
        warehouseId: getStr(req.query.warehouseId),
        inventoryItemId: getStr(req.query.inventoryItemId),
        expiryStatus: getStr(req.query.expiryStatus),
      });
      sendSuccess(res, 'Inventory batches retrieved successfully', data);
    } catch (error) {
      next(error);
    }
  }

  static async listValuation(req: Request, res: Response, next: NextFunction) {
    try {
      const params = parsePagination(req.query as Record<string, unknown>);
      const data = await InventoryLedgerService.listValuation(params, getUserCtx(req), {
        warehouseId: getStr(req.query.warehouseId),
        itemType: getStr(req.query.itemType),
      });
      sendSuccess(res, 'Inventory valuation retrieved successfully', data);
    } catch (error) {
      next(error);
    }
  }

  static async getValuationHistory(req: Request, res: Response, next: NextFunction) {
    try {
      const params = parsePagination(req.query as Record<string, unknown>);
      const data = await InventoryLedgerService.getValuationHistory(String(req.params.itemId), params);
      sendSuccess(res, 'Item valuation history retrieved successfully', data);
    } catch (error) {
      next(error);
    }
  }

  static async listTransactions(req: Request, res: Response, next: NextFunction) {
    try {
      const params = parsePagination(req.query as Record<string, unknown>);
      const data = await InventoryLedgerService.listTransactions(params, getUserCtx(req), {
        warehouseId: getStr(req.query.warehouseId),
        transactionType: getStr(req.query.transactionType),
        inventoryItemId: getStr(req.query.inventoryItemId),
      });
      sendSuccess(res, 'Inventory transactions retrieved successfully', data);
    } catch (error) {
      next(error);
    }
  }

  static async getTransactionById(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await InventoryLedgerService.getTransactionById(String(req.params.id), getUserCtx(req));
      sendSuccess(res, 'Inventory transaction retrieved successfully', data);
    } catch (error) {
      next(error);
    }
  }

  static async reverseTransaction(req: Request, res: Response, next: NextFunction) {
    try {
      const validated = reverseTransactionSchema.parse(req.body);
      const data = await InventoryLedgerService.reverseTransaction(
        String(req.params.id),
        validated.reason,
        validated.idempotencyKey,
        getUserCtx(req),
        getAuditMeta(req),
      );
      sendSuccess(res, 'Inventory transaction reversed successfully', data, 201);
    } catch (error) {
      next(error);
    }
  }

  // --- Receipts ---
  static async listReceipts(req: Request, res: Response, next: NextFunction) {
    try {
      const params = parsePagination(req.query as Record<string, unknown>);
      const data = await InventoryReceiptService.list(params, getUserCtx(req), {
        warehouseId: getStr(req.query.warehouseId),
        status: getStr(req.query.status),
      });
      sendSuccess(res, 'Inventory receipts retrieved successfully', data);
    } catch (error) {
      next(error);
    }
  }

  static async getReceiptById(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await InventoryReceiptService.getById(String(req.params.id), getUserCtx(req));
      sendSuccess(res, 'Inventory receipt retrieved successfully', data);
    } catch (error) {
      next(error);
    }
  }

  static async createReceipt(req: Request, res: Response, next: NextFunction) {
    try {
      const validated = createReceiptSchema.parse(req.body);
      const data = await InventoryReceiptService.create(validated, getUserCtx(req), getAuditMeta(req));
      sendSuccess(res, 'Inventory receipt created successfully', data, 201);
    } catch (error) {
      next(error);
    }
  }

  static async submitReceipt(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await InventoryReceiptService.submit(String(req.params.id), getUserCtx(req), getAuditMeta(req));
      sendSuccess(res, 'Inventory receipt submitted successfully', data);
    } catch (error) {
      next(error);
    }
  }

  static async approveReceipt(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await InventoryReceiptService.approve(String(req.params.id), getUserCtx(req), getAuditMeta(req));
      sendSuccess(res, 'Inventory receipt approved successfully', data);
    } catch (error) {
      next(error);
    }
  }

  static async postReceipt(req: Request, res: Response, next: NextFunction) {
    try {
      const { idempotencyKey } = idempotencySchema.parse(req.body || {});
      const data = await InventoryReceiptService.post(
        String(req.params.id),
        idempotencyKey,
        getUserCtx(req),
        getAuditMeta(req),
      );
      sendSuccess(res, 'Inventory receipt posted successfully', data);
    } catch (error) {
      next(error);
    }
  }

  static async cancelReceipt(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await InventoryReceiptService.cancel(String(req.params.id), getUserCtx(req), getAuditMeta(req));
      sendSuccess(res, 'Inventory receipt cancelled successfully', data);
    } catch (error) {
      next(error);
    }
  }

  // --- Issues ---
  static async listIssues(req: Request, res: Response, next: NextFunction) {
    try {
      const params = parsePagination(req.query as Record<string, unknown>);
      const data = await InventoryIssueService.list(params, getUserCtx(req), {
        warehouseId: getStr(req.query.warehouseId),
        status: getStr(req.query.status),
      });
      sendSuccess(res, 'Inventory issues retrieved successfully', data);
    } catch (error) {
      next(error);
    }
  }

  static async getIssueById(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await InventoryIssueService.getById(String(req.params.id), getUserCtx(req));
      sendSuccess(res, 'Inventory issue retrieved successfully', data);
    } catch (error) {
      next(error);
    }
  }

  static async createIssue(req: Request, res: Response, next: NextFunction) {
    try {
      const validated = createIssueSchema.parse(req.body);
      const data = await InventoryIssueService.create(validated, getUserCtx(req), getAuditMeta(req));
      sendSuccess(res, 'Inventory issue created successfully', data, 201);
    } catch (error) {
      next(error);
    }
  }

  static async submitIssue(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await InventoryIssueService.submit(String(req.params.id), getUserCtx(req), getAuditMeta(req));
      sendSuccess(res, 'Inventory issue submitted successfully', data);
    } catch (error) {
      next(error);
    }
  }

  static async approveIssue(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await InventoryIssueService.approve(String(req.params.id), getUserCtx(req), getAuditMeta(req));
      sendSuccess(res, 'Inventory issue approved successfully', data);
    } catch (error) {
      next(error);
    }
  }

  static async postIssue(req: Request, res: Response, next: NextFunction) {
    try {
      const { idempotencyKey } = idempotencySchema.parse(req.body || {});
      const data = await InventoryIssueService.post(
        String(req.params.id),
        idempotencyKey,
        getUserCtx(req),
        getAuditMeta(req),
      );
      sendSuccess(res, 'Inventory issue posted successfully', data);
    } catch (error) {
      next(error);
    }
  }

  static async cancelIssue(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await InventoryIssueService.cancel(String(req.params.id), getUserCtx(req), getAuditMeta(req));
      sendSuccess(res, 'Inventory issue cancelled successfully', data);
    } catch (error) {
      next(error);
    }
  }

  // --- Transfers ---
  static async listTransfers(req: Request, res: Response, next: NextFunction) {
    try {
      const params = parsePagination(req.query as Record<string, unknown>);
      const data = await InventoryTransferService.list(params, getUserCtx(req), {
        warehouseId: getStr(req.query.warehouseId),
        status: getStr(req.query.status),
      });
      sendSuccess(res, 'Warehouse transfers retrieved successfully', data);
    } catch (error) {
      next(error);
    }
  }

  static async getTransferById(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await InventoryTransferService.getById(String(req.params.id), getUserCtx(req));
      sendSuccess(res, 'Warehouse transfer retrieved successfully', data);
    } catch (error) {
      next(error);
    }
  }

  static async createTransfer(req: Request, res: Response, next: NextFunction) {
    try {
      const validated = createTransferSchema.parse(req.body);
      const data = await InventoryTransferService.create(validated, getUserCtx(req), getAuditMeta(req));
      sendSuccess(res, 'Warehouse transfer created successfully', data, 201);
    } catch (error) {
      next(error);
    }
  }

  static async approveTransfer(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await InventoryTransferService.approve(String(req.params.id), getUserCtx(req), getAuditMeta(req));
      sendSuccess(res, 'Warehouse transfer approved successfully', data);
    } catch (error) {
      next(error);
    }
  }

  static async dispatchTransfer(req: Request, res: Response, next: NextFunction) {
    try {
      const { idempotencyKey } = idempotencySchema.parse(req.body || {});
      const data = await InventoryTransferService.dispatch(
        String(req.params.id),
        idempotencyKey,
        getUserCtx(req),
        getAuditMeta(req),
      );
      sendSuccess(res, 'Warehouse transfer dispatched successfully', data);
    } catch (error) {
      next(error);
    }
  }

  static async receiveTransfer(req: Request, res: Response, next: NextFunction) {
    try {
      const { idempotencyKey } = idempotencySchema.parse(req.body || {});
      const data = await InventoryTransferService.receive(
        String(req.params.id),
        idempotencyKey,
        getUserCtx(req),
        getAuditMeta(req),
      );
      sendSuccess(res, 'Warehouse transfer received successfully', data);
    } catch (error) {
      next(error);
    }
  }

  static async cancelTransfer(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await InventoryTransferService.cancel(String(req.params.id), getUserCtx(req), getAuditMeta(req));
      sendSuccess(res, 'Warehouse transfer cancelled successfully', data);
    } catch (error) {
      next(error);
    }
  }

  // --- Adjustments ---
  static async listAdjustments(req: Request, res: Response, next: NextFunction) {
    try {
      const params = parsePagination(req.query as Record<string, unknown>);
      const data = await InventoryAdjustmentService.list(params, getUserCtx(req), {
        warehouseId: getStr(req.query.warehouseId),
        status: getStr(req.query.status),
      });
      sendSuccess(res, 'Inventory adjustments retrieved successfully', data);
    } catch (error) {
      next(error);
    }
  }

  static async getAdjustmentById(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await InventoryAdjustmentService.getById(String(req.params.id), getUserCtx(req));
      sendSuccess(res, 'Inventory adjustment retrieved successfully', data);
    } catch (error) {
      next(error);
    }
  }

  static async createAdjustment(req: Request, res: Response, next: NextFunction) {
    try {
      const validated = createAdjustmentSchema.parse(req.body);
      const data = await InventoryAdjustmentService.create(validated, getUserCtx(req), getAuditMeta(req));
      sendSuccess(res, 'Inventory adjustment created successfully', data, 201);
    } catch (error) {
      next(error);
    }
  }

  static async submitAdjustment(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await InventoryAdjustmentService.submit(String(req.params.id), getUserCtx(req), getAuditMeta(req));
      sendSuccess(res, 'Inventory adjustment submitted successfully', data);
    } catch (error) {
      next(error);
    }
  }

  static async approveAdjustment(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await InventoryAdjustmentService.approve(String(req.params.id), getUserCtx(req), getAuditMeta(req));
      sendSuccess(res, 'Inventory adjustment approved successfully', data);
    } catch (error) {
      next(error);
    }
  }

  static async postAdjustment(req: Request, res: Response, next: NextFunction) {
    try {
      const { idempotencyKey } = idempotencySchema.parse(req.body || {});
      const data = await InventoryAdjustmentService.post(
        String(req.params.id),
        idempotencyKey,
        getUserCtx(req),
        getAuditMeta(req),
      );
      sendSuccess(res, 'Inventory adjustment posted successfully', data);
    } catch (error) {
      next(error);
    }
  }

  static async cancelAdjustment(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await InventoryAdjustmentService.cancel(String(req.params.id), getUserCtx(req), getAuditMeta(req));
      sendSuccess(res, 'Inventory adjustment cancelled successfully', data);
    } catch (error) {
      next(error);
    }
  }
}
