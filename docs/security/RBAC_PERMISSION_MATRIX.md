# FoodFactory ERP – Role-Based Access Control (RBAC) & Permission Matrix

## 1. Executive Summary

FoodFactory ERP implements a two-tier access control model:

1. **Coarse-Grained Operational Roles:** Functional job profiles assigned to employees.
2. **Fine-Grained Permissions:** Individual atomic capabilities evaluated at backend API endpoints.

Physical warehouse facility scoping (`UserWarehouseAccess`) provides an additional orthogonal dimension, restricting floor staff and salesmen to designated physical depots.

---

## 2. Core Operational Roles

| Role Code        | Title                              | Operational Scope & Access Level                                                                                                                                                                 |
| :--------------- | :--------------------------------- | :----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **`OWNER`**      | Business Owner / Managing Director | Universal administrative and financial authority across all factories and warehouses. Can override workflows, manage admins, and review financial ledgers.                                       |
| **`ADMIN`**      | System & Operations Administrator  | Full administrative operational control: provisions users, assigns roles, manages masters, approves purchase and sales orders. Cannot remove or deactivate the last active `OWNER`.              |
| **`PRODUCTION`** | Plant / Shift Supervisor           | Authorizes recipe usage, creates and completes production batches, records scrap, and initiates intra-factory material transfers. Restriced to designated plant warehouses.                      |
| **`SALESMAN`**   | Field Sales Representative         | Mobile and tablet field access: manages retailer directory, drafts sales orders, inspects finished goods inventory availability. Strictly denied administrative and financial write permissions. |
| **`AUDITOR`**    | Independent Financial Auditor      | Strictly enforced read-only access to all operational transactions, cost sheets, GST invoice ledgers, and system audit logs. Zero mutation or write capabilities.                                |

---

## 3. Comprehensive Permission Matrix

The system provisions **28 atomic permissions** across 9 functional business modules:

| Module          | Permission Code         | Description                              |   OWNER   |   ADMIN   | PRODUCTION | SALESMAN |  AUDITOR  |
| :-------------- | :---------------------- | :--------------------------------------- | :-------: | :-------: | :--------: | :------: | :-------: |
| **Users**       | `users.read`            | View users & profiles                    |    ✅     |    ✅     |     ❌     |    ❌    |    ✅     |
|                 | `users.create`          | Provision new user accounts              |    ✅     |    ✅     |     ❌     |    ❌    |    ❌     |
|                 | `users.update`          | Update user personal details             |    ✅     |    ✅     |     ❌     |    ❌    |    ❌     |
|                 | `users.disable`         | Deactivate/reactivate accounts           |    ✅     |    ✅     |     ❌     |    ❌    |    ❌     |
|                 | `users.roles.assign`    | Assign or modify user roles              |    ✅     |    ✅     |     ❌     |    ❌    |    ❌     |
|                 | `users.sessions.revoke` | Force-terminate user sessions            |    ✅     |    ✅     |     ❌     |    ❌    |    ❌     |
| **Customers**   | `customers.read`        | View customer / retailer registry        |    ✅     |    ✅     |     ❌     |    ✅    |    ✅     |
|                 | `customers.create`      | Register new customer accounts           |    ✅     |    ✅     |     ❌     |    ✅    |    ❌     |
|                 | `customers.update`      | Modify customer details & addresses      |    ✅     |    ✅     |     ❌     |    ✅    |    ❌     |
| **Sales**       | `sales.orders.read`     | View sales orders & fulfillment status   |    ✅     |    ✅     |     ❌     |    ✅    |    ✅     |
|                 | `sales.orders.create`   | Draft & book customer sales orders       |    ✅     |    ✅     |     ❌     |    ✅    |    ❌     |
|                 | `sales.orders.approve`  | Authorize customer credit / discount     |    ✅     |    ✅     |     ❌     |    ❌    |    ❌     |
| **Inventory**   | `inventory.read`        | View warehouse stock balances & ledgers  |    ✅     |    ✅     |     ✅     |    ✅    |    ✅     |
|                 | `inventory.adjust`      | Post physical inventory adjustments      |    ✅     |    ✅     |     ❌     |    ❌    |    ❌     |
|                 | `inventory.transfer`    | Execute warehouse-to-warehouse transfers |    ✅     |    ✅     |     ✅     |    ❌    |    ❌     |
| **Production**  | `production.read`       | View recipes, BOMs, and batch runs       |    ✅     |    ✅     |     ✅     |    ❌    |    ✅     |
|                 | `production.create`     | Schedule & issue production batches      |    ✅     |    ✅     |     ✅     |    ❌    |    ❌     |
|                 | `production.complete`   | Finalize output, scrap & unit costs      |    ✅     |    ✅     |     ✅     |    ❌    |    ❌     |
| **Procurement** | `purchases.read`        | View POs and Goods Receipt Notes (GRN)   |    ✅     |    ✅     |     ❌     |    ❌    |    ✅     |
|                 | `purchases.create`      | Issue POs for flours, spices & pouches   |    ✅     |    ✅     |     ❌     |    ❌    |    ❌     |
|                 | `purchases.approve`     | Authorize supplier invoices & payments   |    ✅     |    ✅     |     ❌     |    ❌    |    ❌     |
| **Invoicing**   | `invoices.read`         | View sales invoices & supplier bills     |    ✅     |    ✅     |     ❌     |    ❌    |    ✅     |
|                 | `invoices.create`       | Draft GST tax invoices                   |    ✅     |    ✅     |     ❌     |    ❌    |    ❌     |
|                 | `invoices.post`         | Post final GST invoices to tax ledger    |    ✅     |    ✅     |     ❌     |    ❌    |    ❌     |
| **Payments**    | `payments.read`         | View customer receipts & payments        |    ✅     |    ✅     |     ❌     |    ❌    |    ✅     |
|                 | `payments.record`       | Record bank / cash collections           |    ✅     |    ✅     |     ❌     |    ❌    |    ❌     |
| **Reports**     | `reports.read`          | View costing, yield & GSTR reports       |    ✅     |    ✅     |     ❌     |    ❌    |    ✅     |
| **Audit**       | `audit.read`            | Inspect immutable security & change logs |    ✅     |    ✅     |     ❌     |    ❌    |    ✅     |
| **TOTALS**      | **28 Permissions**      | —                                        | **28/28** | **28/28** |  **5/28**  | **6/28** | **10/28** |

---

## 4. Enforcement Architecture

### 4.1 Server-Side Enforcement (Defense-in-Depth)

Frontend route protection hides unauthorized UI elements, but **every backend endpoint strictly enforces authentication and authorization** using middleware:

```typescript
// Example: Provisioning a user requires 'users.create'
usersRouter.post('/', requirePermissions('users.create'), UsersController.create);

// Example: Approving a sales order requires 'sales.orders.approve'
salesRouter.post(
  '/:id/approve',
  requirePermissions('sales.orders.approve'),
  SalesController.approve,
);
```

### 4.2 AUDITOR Read-Only Enforcement Rule

The `requirePermissions` middleware contains an explicit architectural guard for the `AUDITOR` role:

```typescript
if (userRoles.includes('AUDITOR')) {
  const isMutation = requiredPermissions.some(p => !p.endsWith('.read') && !p.endsWith('.export'));
  if (isMutation) {
    throw new AppError('Access denied. AUDITOR role is restricted to read-only operations.', 403);
  }
}
```

### 4.3 Physical Facility Scoping (`requireWarehouseAccess`)

Plant operators and warehouse personnel are scoped to physical facilities via `user_warehouse_access`:

- Users assigned to `WH-FG-01` cannot read or write to `WH-RM-01` or `WH-PKG-01`.
- Users assigned with `accessLevel: 'READ'` cannot execute stock movements or issue materials.
- `OWNER` and `ADMIN` roles possess universal plant access.

### 4.4 Last Active OWNER Invariant

The system programmatically prevents self-lockout:

- An `OWNER` cannot have their `OWNER` role removed if they are the sole remaining active owner in the enterprise.
- An `OWNER` cannot be deactivated (`isActive = false`) if they are the sole remaining active owner in the enterprise.
