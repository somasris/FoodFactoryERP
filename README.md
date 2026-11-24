# FoodFactory ERP – Enterprise Manufacturing Platform

[![Phase](https://img.shields.io/badge/Phase-1.1%20Foundation-blue.svg)](https://github.com)
[![License](https://img.shields.io/badge/License-Proprietary-red.svg)](https://github.com)
[![Institution](https://img.shields.io/badge/Centre%20for%20Digital%20Infrastructure-NIT%20Tiruchirappalli-teal.svg)](https://nitt.edu)

A production-grade, web-based Enterprise Resource Planning (ERP) platform architected for small-to-medium scale packaged food manufacturers in South India (producers of snacks, savouries, sweets, and spice blends).

Developed as an individual internship project for the **Centre for Digital Infrastructure, National Institute of Technology, Tiruchirappalli**.

---

## 1. Project Overview

FoodFactory ERP centralizes end-to-end manufacturing workflows—from customer order intake and GST invoicing to raw ingredient procurement, recipe-based Bill of Materials (BOM) production conversion, and unit-level costing.

The application is engineered strictly as a **responsive web application** optimized for desktop, tablet, and mobile browsers across all factory floors and administrative offices.

### Core User Roles

The platform is designed to support five primary business roles:

1. **SALESMAN**: Order logging, delivery monitoring, and customer ledger balance tracking.
2. **ADMIN**: Master data governance, user role administration, and system configuration.
3. **PRODUCTION**: BOM recipe execution, batch scheduling, scrap/wastage recording, and work order processing.
4. **OWNER**: Executive management, profitability margins, production yields, and real-time operational oversight.
5. **AUDITOR**: GST compliance (GSTR-1, GSTR-3B), invoice verification, and financial ledger audits.

---

## 2. Problem Being Solved

Small packaged food manufacturing units in South India face operational challenges:

- **Disjointed Tracking**: Raw materials (flour, oil, pulses, spices) are tracked on paper; customer orders arrive over telephone or messaging apps.
- **Untracked Production Loss & Wastage**: Frying, roasting, and packaging produce variable yields and scrap that are rarely audited against standard recipes.
- **Inaccurate Costing**: Standard cost accounting often omits dynamic packaging costs (pouches, nitrogen flushing, corrugated master boxes) and machine overheads.
- **GST Compliance Delays**: Reconciling multi-tax bracket sales (5%, 12%, 18%) with input tax credits (ITC) at month-end is manual and error-prone.

FoodFactory ERP provides an integrated, audit-compliant digital spine tailored specifically to food manufacturing dynamics.

---

## 3. Technology Stack

### Frontend (`apps/web`)

- **Core**: React 18, TypeScript, Vite
- **Styling**: Tailwind CSS, PostCSS, Autoprefixer
- **UI Components & Icons**: shadcn/ui architectural design primitives, Lucide React
- **Routing**: React Router v7
- **State & Server Cache**: TanStack Query (React Query v5)
- **Form & Validation**: React Hook Form, Zod

### Backend (`apps/api`)

- **Runtime**: Node.js (v20+ / v24+), TypeScript
- **Framework**: Express.js
- **Architecture**: Modular Layered REST API
- **Validation**: Zod (environment and DTO validation)
- **ORM**: Prisma ORM v5

### Persistence & Infrastructure

- **Database**: PostgreSQL 16+
- **Monorepo Tools**: pnpm workspaces
- **Code Quality**: ESLint 9, Prettier
- **Containerization**: Docker & Docker Compose

---

## 4. Architecture Overview

FoodFactory ERP employs a clean **client-server decoupled monorepo architecture**:

```
[ Browser Client ]  <--->  [ Reverse Proxy / Vite ]  <--->  [ Express REST API ]  <--->  [ PostgreSQL DB ]
 (React + Vite)                                            (Zod + Prisma ORM)           (16+ Engine)
```

- **Independent Builds**: Frontend and backend can be built, type-checked, and deployed completely independently.
- **Uniform API Envelope**: Standard JSON response format across all endpoints.
- **Safe Precision**: Financial calculations in subsequent phases are specified using arbitrary-precision decimals (or integer paisa), prohibiting JavaScript floating-point errors.

---

## 5. Repository Structure

```
FoodFactoryERP/
├── apps/
│   ├── api/                     # Backend REST API
│   │   ├── prisma/              # Prisma schema, migrations, seeds
│   │   ├── src/
│   │   │   ├── config/          # Environment parser & validation
│   │   │   ├── middleware/      # Error, logger, and 404 middlewares
│   │   │   ├── modules/         # Architectural module boundaries
│   │   │   │   ├── sales/       # Sales & orders placeholder
│   │   │   │   ├── production/  # BOM & manufacturing placeholder
│   │   │   │   ├── inventory/   # Raw material & packaging placeholder
│   │   │   │   └── reports/     # Costing & audit reports placeholder
│   │   │   ├── routes/          # REST route endpoints
│   │   │   ├── services/        # Service singletons (Prisma client)
│   │   │   ├── utils/           # Logger & response utilities
│   │   │   ├── app.ts           # Express application setup
│   │   │   └── server.ts        # Server entrypoint & graceful shutdown
│   │   └── package.json
│   │
│   └── web/                     # Frontend Application
│       ├── src/
│       │   ├── assets/          # Static brand assets
│       │   ├── components/      # Common primitives & responsive shell layout
│       │   ├── config/          # Client environment constants
│       │   ├── hooks/           # TanStack Query health hooks
│       │   ├── lib/             # Tailwind utility helpers (cn)
│       │   ├── routes/          # Application router & views
│       │   ├── services/        # API client & health service
│       │   ├── types/           # TypeScript interfaces
│       │   ├── App.tsx          # Root React component
│       │   ├── index.css        # Tailwind style directives
│       │   └── main.tsx         # Web entrypoint
│       └── package.json
│
├── docs/                        # Project architectural & setup manuals
│   ├── architecture/            # system-architecture.md
│   └── setup/                   # development-setup.md
│
├── docker-compose.yml           # PostgreSQL container definition
├── .env.example                 # Sanitized environment template
├── package.json                 # Monorepo root scripts
├── pnpm-workspace.yaml          # pnpm workspace configuration
└── README.md                    # Project documentation
```

---

## 6. Prerequisites

- **Node.js**: `v20.0.0` or higher
- **pnpm**: `v9.0.0` or higher
- **PostgreSQL**: Native Windows service or Docker Desktop

---

## 7. Installation Instructions

1. Clone or navigate to the repository:

   ```bash
   cd FoodFactoryERP
   ```

2. Install all monorepo dependencies:
   ```bash
   pnpm install
   ```

---

## 8. Environment Configuration

Copy `.env.example` to `.env` in both the repository root and `apps/api`:

```bash
cp .env.example .env
cp .env.example apps/api/.env
```

Key environment parameters:

```dotenv
NODE_ENV=development
PORT=5000
DATABASE_URL=postgresql://postgres:postgres@localhost:5433/foodfactory_erp?schema=public
FRONTEND_URL=http://localhost:5173
JWT_ACCESS_SECRET=foodfactory_erp_jwt_secret_foundation_fallback_key_nit_trichy
```

---

## 9. PostgreSQL Setup

### Option A: Local Windows PostgreSQL (Port 5433 / 5432)

Ensure PostgreSQL is active and create the database:

```bash
createdb -h 127.0.0.1 -p 5433 -U postgres foodfactory_erp
```

### Option B: Docker Compose

```bash
docker compose up -d
```

### Generate Client & Run Migrations

```bash
pnpm db:generate
pnpm db:migrate
```

---

## 10. Development Commands

Execute from the workspace root:

| Command            | Action                                                    |
| :----------------- | :-------------------------------------------------------- |
| `pnpm dev`         | Starts frontend (Vite) and backend (Express) concurrently |
| `pnpm dev:api`     | Starts backend API with hot reload (`tsx watch`)          |
| `pnpm dev:web`     | Starts frontend development server                        |
| `pnpm build`       | Compiles both backend and frontend for production         |
| `pnpm typecheck`   | Runs TypeScript checks across all packages                |
| `pnpm lint`        | Runs ESLint across all packages                           |
| `pnpm format`      | Formats all files with Prettier                           |
| `pnpm db:generate` | Generates Prisma Client                                   |
| `pnpm db:migrate`  | Runs Prisma schema migrations                             |
| `pnpm db:studio`   | Launches Prisma Studio GUI                                |

---

## 11. API Health-Check Instructions

Once the backend is running (`PORT=5000`):

### 1. General Application Health

```http
GET http://localhost:5000/api/v1/health
```

**Sample Response:**

```json
{
  "success": true,
  "message": "FoodFactory ERP API is operating normally",
  "data": {
    "application": "FoodFactory ERP API",
    "status": "healthy",
    "environment": "development",
    "uptimeSeconds": 142,
    "timestamp": "2026-11-24T19:30:00.000Z"
  },
  "timestamp": "2026-11-24T19:30:00.000Z"
}
```

### 2. Live Database Connection Health

```http
GET http://localhost:5000/api/v1/health/database
```

**Sample Response:**

```json
{
  "success": true,
  "message": "PostgreSQL database connection verified successfully",
  "data": {
    "application": "FoodFactory ERP API",
    "database": "PostgreSQL",
    "status": "connected",
    "latencyMs": 4,
    "timestamp": "2026-11-24T19:30:00.000Z"
  },
  "timestamp": "2026-11-24T19:30:00.000Z"
}
```

---

## 12. Known Limitations of Phase 1.1

1. **Authentication Deferred**: JWT login, session cookies, and password hashing are intentionally omitted from Phase 1.1 and slated for Phase 1.2.
2. **Business Schemas Deferred**: Customer, Item, BOM, Batch, Invoice, and Ledger schemas will be formally introduced in subsequent domain design phases.
3. **No Mock Data**: The UI displays clean architectural placeholders and real-time connectivity states rather than simulated transaction data.

---

## 13. Upcoming Implementation Phases

- **Phase 1.2**: Authentication & Role-Based Access Control (RBAC), JWT token rotation, user security matrix.
- **Phase 2.1**: Master Data & Inventory Management (Raw materials, packaging, suppliers, stock ledgers).
- **Phase 2.2**: Sales Orders & GST Billing (Customer records, tax invoices, payment tracking).
- **Phase 3.1**: BOM & Production Management (Recipes, batch work orders, scrap & yield tracking).
- **Phase 3.2**: Unit Costing & Audit Financials (True manufacturing unit cost, GSTR audit exports).
