# FoodFactoryERP — Pitch-Ready Demonstration Walkthrough

**Organization:** South Indian Food Works Pvt Ltd (`COMP-01` / Trade Name: `FoodFactory South India`)  
**Facility:** Trichy Packaged Foods Plant (`FAC-TRICHY-01`, Thuvakudi, Tiruchirappalli, Tamil Nadu)  
**Warehouses:** `WH-RM-01` (Raw Materials), `WH-PKG-01` (Packaging Materials), `WH-FG-01` (Finished Goods)

---

## Demo Login Accounts

Use the demo login buttons on the Login page (`/login`) or sign in with the following credentials (default demo password configured via `DEMO_DEFAULT_PASSWORD`, default `DemoFactory2026!`):

| Role | Email | Username | Presentation Responsibility |
|---|---|---|---|
| **OWNER** | `demo.owner@foodfactory.local` | `demo_owner` | Executive dashboard, profitability, costing finalization, exports |
| **ADMIN** | `demo.admin@foodfactory.local` | `demo_admin` | Master data, supplier invoices, order approval, dispatch, GST invoicing |
| **SALESMAN** | `demo.salesman@foodfactory.local` | `demo_salesman` | Customer orders (Retailer A & Distributor B), payment recording |
| **PRODUCTION** | `demo.production@foodfactory.local` | `demo_production` | BOMs, production plans, work orders, batch execution, QC, cost entries |
| **AUDITOR** | `demo.auditor@foodfactory.local` | `demo_auditor` | Strictly read-only audit trail, GST registers, receivables ageing |

---

## Opening — FoodFactoryERP

> *"FoodFactoryERP is an integrated Order-to-Audit ERP built specifically for small and medium-sized packaged food manufacturers. Every rupee and every kilogram is connected end-to-end: from supplier purchase and raw material inventory, through BOM recipes and shop-floor batch production, to GST sales invoicing, customer collections, production costing, and immutable audit trails."*

---

## 1. Executive & Business Dashboard (`OWNER`)

1. Sign in as **OWNER** (`demo.owner@foodfactory.local`).
2. Open **Executive Dashboard** (`/reports/executive`).
3. Highlight:
   - **5 finished snack SKUs** actively sold across **5 South Indian retail, wholesale, and distributor customers**.
   - **4 supplier purchase invoices** matched to inventory receipts across **4 regional suppliers**.
   - **4 production batches** (3 completed & QC-accepted, 1 actively `IN_PROGRESS` on the shop floor).
   - **Receivables & Collections** with partial payments, full settlements, and an issued GST credit note.

---

## 2. Suppliers & Procurement (`ADMIN`)

1. Switch to **ADMIN** (`demo.admin@foodfactory.local`).
2. Open **Suppliers** (`/master-data/suppliers`) and select **Sri Lakshmi Flour Mills** (`PITCH-SUP-01`, Tiruchirappalli, TN).
3. Open **Supplier Invoices** (`/purchases/invoices`) and locate `PINV/2026-27/00007` (Supplier Ref: `SLFM/2026-27/1042`):
   - **Item:** `PITCH-RM-FLOUR` (Flour — Rice & Urad Blend)
   - **Quantity & Rate:** `60 kg` @ `₹45.00/kg`
   - **Taxable Value:** `₹2,700.00`
   - **GST (5%):** `₹135.00` (CGST `₹67.50` + SGST `₹67.50`)
   - **Total:** `₹2,835.00`
   - **Matching Status:** `MATCHED` to the posted `WH-RM-01` inventory receipt; **ITC Status:** `ELIGIBLE`.
4. Open **Inventory Balances** (`/inventory/balances`) to show raw material stock before/after:
   - Flour opening `100 kg @ ₹42` + purchase `60 kg @ ₹45` = `160 kg` at MWAC `₹43.125/kg` (after consuming `40 kg` for Murukku + `10 kg` for Ribbon Pakoda + `5 kg` for Ragi = `105 kg` remaining).

---

## 3. Products & Recipes / BOMs (`PRODUCTION`)

1. Open **Products** (`/master-data/products`) and inspect **Murukku 200g** (`PITCH-FG-MUR200`, SKU: `PITCH-MUR-200G`, Selling Price: `₹50.00`, HSN `21069099`, GST `5%`).
2. Open **BOMs / Recipes** (`/master-data/boms`) and select `PITCH-BOM-MUR200` (**Murukku 200g Standard Recipe**):
   - **Expected Good Output:** `200 pcs` (Yield `94.00%`, Expected Wastage `6.00%`)
   - **Ingredients:** Flour `40 kg`, Cooking Oil `10 L`, Spice Mix `1.2 kg`, 200g Pouch `194 pcs`, Master Carton `9 pcs`.
3. Also show `PITCH-BOM-RIB200` (**Ribbon Pakoda 200g Recipe**) to demonstrate **BOM Revision History** (`v1 OBSOLETE` → `v2 ACTIVE` with revised spice ratio).

---

## 4. Production Execution & Costing (`PRODUCTION` → `OWNER`)

1. Sign in as **PRODUCTION** (`demo.production@foodfactory.local`).
2. Open **Production Batches** (`/production/batches`) and select **Murukku 200g Benchmark Batch** (`PB/2026-27/00005`, ID: `221eae38-fd62-4654-8ccd-5bb9898384a5`).
3. Walk through the batch lifecycle:
   - **Material Issues:** Flour `40 kg` (`₹1,725`), Cooking Oil `10.5 L` (`₹1,470` — `+0.5 L` / `+5%` variance over `10 L` BOM), Spice Mix `1.2 kg` (`₹240`), Pouches `194 pcs` (`₹485`), Cartons `9 pcs` (`₹135`). **Total Material Cost = `₹4,055.00`**.
   - **Output & Wastage:** `188` good packets (`94%` yield), `12` wastage (`6%` yield loss, including `6` damaged pouches).
   - **Quality Inspection:** `ACCEPTED` → `188` packets posted into `WH-FG-01` (`50` opening + `188` produced = `238` packets).
4. Open **Batch Costing Detail** (`/production/costing/batches/221eae38-fd62-4654-8ccd-5bb9898384a5`):
   - **Net Material Cost:** `₹4,055.00`
   - **Direct Labour:** `₹1,200.00`
   - **Utilities (Gas & Electricity):** `₹600.00`
   - **Total Actual Batch Cost:** `₹5,855.00`
   - **Good Output Cost (app allocation):** `₹5,503.70` (`₹29.2750/packet`, after allocating `₹351.30` to `12` wastage units; gross `₹5,855 / 188 = ₹31.14/packet`).

---

## 5. Sales Order, Approval, GST Invoice & Dispatch (`SALESMAN` → `ADMIN`)

1. Sign in as **SALESMAN** (`demo.salesman@foodfactory.local`).
2. Open **Sales Orders** (`/sales/orders`) and open **Retailer A Order** (`SO-261128-8C3754`, ID: `a6be48e7-c802-4b3f-ad10-189828731ac7`):
   - **Customer:** Sri Annapoorna Stores (`PITCH-CUST-01`, Madurai, Tamil Nadu)
   - **Line:** `150` packets Murukku 200g @ `₹50.00`
   - **Status:** `FULFILLED` (submitted by Salesman → approved, confirmed & dispatched from `WH-FG-01` by Admin).
   - **Remaining FG Stock:** `238 - 150 = 88 packets`.
3. Open **Sales Invoice** `INV/2026-27/00001` (ID: `8d47e1ee-3935-4866-9ef6-e6f706390d50`):
   - **Taxable Value:** `₹7,500.00`
   - **CGST (2.5%):** `₹187.50` | **SGST (2.5%):** `₹187.50`
   - **Invoice Total:** `₹7,875.00`
   - Click **Download PDF** to show the generated GST Tax Invoice PDF.

---

## 6. Real-Time Stock Shortage Visibility (`SALESMAN` / `ADMIN`)

1. On **Sales Orders** (`/sales/orders`), open **Distributor B Order** (`SO-261128-7E5F3A`, ID: `a54e1273-693d-4989-be6f-b668eaa60ffd`):
   - **Customer:** Kaveri Wholesale Mart (`PITCH-CUST-02`, Bengaluru, Karnataka — Inter-state)
   - **Ordered:** `120` packets Murukku 200g
   - **Status:** `APPROVED` (cannot be confirmed/dispatched)
   - **Stock Availability:** `INSUFFICIENT` — **`88` available, `32` short**!
   - Point out that FoodFactoryERP prevents over-committing stock and flags the exact `32`-packet shortage automatically.

---

## 7. Payments, Credit Notes & Receivables (`SALESMAN` → `ADMIN`)

1. Open **Customer Payments** (`/sales/payments`) and **Receivables Ageing** (`/sales/ageing`):
   - **Sri Annapoorna Stores (Retailer A):** Invoice `₹7,875.00` − Payment `₹4,000.00` (Bank Transfer) = **`₹3,875.00` outstanding** (`PARTIALLY_PAID`).
   - **Green Basket Retailers (Scenario A):** Ribbon Pakoda invoice `₹4,620.00` — **`₹4,620.00` paid** via UPI (`PAID`).
   - **Lakshmi Supermarket (Scenario B & F):** Spicy Mixture invoice `₹6,825.00` — two partial payments (`₹3,000.00` NEFT + `₹2,500.00` UPI) + **Credit Note** for `10` transit-damaged packets (`₹682.50`) = **`₹642.50` outstanding**.
   - **Chennai Food Distributors (Scenario C):** Multiple orders across Ragi Health Mix (`₹4,410.00`, `PAID`) and Banana Chips 12% GST (`₹4,200.00`, `₹2,000.00` cheque paid, `₹2,200.00` outstanding).

---

## 8. Reports, Exports & Audit Trail (`OWNER` / `AUDITOR`)

1. Sign in as **AUDITOR** (`demo.auditor@foodfactory.local`) to demonstrate strictly read-only compliance access.
2. Open **Purchase Register** (`/purchases/register`), **Financial Compliance / GST** (`/compliance/financial`), **Audit Governance** (`/governance/audit`), and **Activity Timeline** (`/activity`).
3. Export **CSV**, **Excel (`.xlsx`)**, and **PDF** reports from **Sales Analytics** / **Invoices** to show real persisted data in every export format.

---

## Closing

> *"From Sri Lakshmi Flour Mills' 60 kg flour invoice to Murukku Batch `PB/2026-27/00005` (`₹5,855` cost), Retailer A's `₹7,875` GST invoice and `₹3,875` balance, and Distributor B's live 32-packet shortage alert — every screen in FoodFactoryERP reflects one coherent, auditable manufacturing business."*
