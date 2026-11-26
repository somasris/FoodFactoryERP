# FoodFactoryERP – Offline PWA User Guide

## 1. Installing FoodFactoryERP as an App (PWA)

- **Desktop (Chrome / Edge):** Click the **Install App** button in the top navigation bar (or the browser's install icon in the address bar).
- **Android (Chrome):** Open the browser menu and tap **Install app** or **Add to Home screen**.
- **iPad / iOS (Safari):** Tap the **Share** button and select **Add to Home Screen**.

---

## 2. Understanding Connection & Sync Status

The status pill in the top header shows your current state:

- **Online (Green):** Connected to the FoodFactory ERP server.
- **Offline (Amber):** Your device has no network connection. Cached data and draft queuing are active.
- **Server Unavailable (Red):** Your device has network access, but the ERP API server is unreachable.
- **Syncing (Blue):** Pending offline operations are being synchronized.
- **Sync Failed (Red):** One or more queued operations require attention. Click the pill to open `/sync`.

---

## 3. Working Offline

### Viewing Data Offline
- Previously visited dashboards, master data (products, raw materials, customers, suppliers, warehouses, BOMs), inventory balances, sales orders, production plans, and reports remain viewable offline.
- An amber banner clearly marks offline views as **Last synchronized data** with the last sync timestamp.

### Supported Offline Actions (Saved as Pending Drafts)
- **Inventory:** Create receipt drafts, issue drafts, adjustment drafts, and warehouse transfer drafts.
- **Sales:** Create or edit sales order drafts and queue order submissions.
- **Production & Quality:** Create production plan drafts, log batch progress/downtime notes, queue material consumption/return drafts, and record quality inspection observations.

### Online-Only Actions
The following require a live connection to the server:
- Signing in as a new user or changing passwords/roles/permissions.
- Posting inventory receipts/issues/adjustments or reversing ledger transactions.
- Approving, confirming (reserving stock), or fulfilling sales orders, and issuing invoices.
- Finalizing production costing, releasing quarantined batches, GST/compliance submissions, and system backups/restores.

---

## 4. Managing Pending Operations & Resolving Conflicts (`/sync`)

Click the status pill in the header or navigate to `/sync` to open the **Offline Synchronization Center**:

1. **Manual Sync:** Click **Sync Now** when online to immediately push pending drafts and pull the latest server updates.
2. **Failed Operations:** Review the error message, then click **Retry** or **Cancel**.
3. **Conflicts:** When another user modified the same record or stock changed while you were offline, review the **Local Submitted Data** vs **Current Server Snapshot** and choose:
   - **Retry After Refresh:** Re-queue your change after reviewing the latest state.
   - **Request Authorized Review:** Escalate the conflict for supervisor review.
   - **Discard Local Draft:** Safely cancel your local draft without overwriting server data.
