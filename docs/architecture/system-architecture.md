# FoodFactory ERP – System Architecture

## 1. Architectural Overview

**FoodFactory ERP** is an enterprise manufacturing management system engineered specifically for small-to-medium scale South Indian packaged food manufacturers (e.g., manufacturers of ready-to-eat snacks, traditional sweets, roasted savory namkeen, and spice mixes).

The platform bridges sales distribution, recipe-governed batch production, raw material inventory, and compliance accounting into a unified, audit-compliant monorepo architecture.

```
+-------------------------------------------------------------------------------+
|                                CLIENT TIER                                    |
|  Responsive Web Browser (Desktop, Tablet, Mobile)                             |
|  React 18 + Vite + TypeScript + Tailwind CSS + Lucide Icons + TanStack Query  |
+-------------------------------------------------------------------------------+
                                     |
                                     | HTTPS / REST JSON APIs
                                     v
+-------------------------------------------------------------------------------+
|                             APPLICATION TIER                                  |
|  Express.js + TypeScript (Modular Layered REST Architecture)                  |
|                                                                               |
|  [Middleware]                                                                 |
|    - CORS Origin Guard                                                        |
|    - Request / Latency Logger                                                 |
|    - Centralized Error & Exception Handler                                    |
|    - 404 Route Interceptor                                                    |
|                                                                               |
|  [Controllers & Services]                                                     |
|    - Health Check Verification                                                |
|    - Architectural Domain Modules (Sales, Production, Inventory, Reports)     |
|    - Zod DTO & Schema Validation                                              |
|                                                                               |
|  [Data Access Layer]                                                          |
|    - Prisma ORM 5.x                                                           |
+-------------------------------------------------------------------------------+
                                     |
                                     | Prisma Client (Binary Protocol / TCP)
                                     v
+-------------------------------------------------------------------------------+
|                              PERSISTENCE TIER                                 |
|  PostgreSQL 16+ Database                                                      |
|  - Relational Schema with Foreign Key Constraints                             |
|  - System Health & Configuration State                                        |
|  - Future: Sales, Invoicing, BOM, Work Orders, Stock, Ledger Audit            |
+-------------------------------------------------------------------------------+
```

---

## 2. Monorepo Structure & Organization

The codebase is structured as a `pnpm` monorepo:

```
FoodFactoryERP/
├── apps/
│   ├── api/                     # Backend REST API service (Express + Prisma)
│   │   ├── prisma/              # Prisma schema, migrations, and seeds
│   │   ├── src/
│   │   │   ├── config/          # Zod environment variable parsing
│   │   │   ├── middleware/      # Global middleware (error, logging, 404)
│   │   │   ├── modules/         # Architectural module placeholders
│   │   │   │   ├── sales/
│   │   │   │   ├── production/
│   │   │   │   ├── inventory/
│   │   │   │   └── reports/
│   │   │   ├── routes/          # REST route handlers (/api/v1/health)
│   │   │   ├── services/        # Shared singletons (Prisma client)
│   │   │   ├── utils/           # Structured logger & standard JSON response envelope
│   │   │   ├── app.ts           # Express application initialization & configuration
│   │   │   └── server.ts        # Server bootstrap & graceful lifecycle shutdown
│   │   └── tsconfig.json
│   │
│   └── web/                     # Frontend client application (React + Vite)
│       ├── src/
│       │   ├── assets/          # Static assets & brand vectors
│       │   ├── components/      # UI components
│       │   │   ├── common/      # Reusable primitives (Button, Card, Badge)
│       │   │   └── layout/      # AppShell, Navbar, Sidebar, Footer
│       │   ├── config/          # Client environment configuration
│       │   ├── hooks/           # Custom React hooks (useApiHealth, useDatabaseHealth)
│       │   ├── lib/             # Utility helpers (cn class merger)
│       │   ├── routes/          # React Router v7 routes & placeholder screens
│       │   ├── services/        # Typed API client & health services
│       │   ├── types/           # Shared TypeScript interfaces & DTOs
│       │   ├── App.tsx          # Root QueryClientProvider & router provider
│       │   ├── index.css        # Tailwind directives & CSS variables
│       │   └── main.tsx         # DOM entrypoint
│       ├── tailwind.config.js   # Tailored manufacturing color palette
│       └── vite.config.ts       # Vite bundler configuration & local API reverse proxy
│
├── docs/                        # Architecture & setup documentation
│   ├── architecture/
│   └── setup/
│
├── docker-compose.yml           # PostgreSQL container setup
├── .env.example                 # Sanitized configuration template
├── package.json                 # Monorepo root orchestration scripts
├── pnpm-workspace.yaml          # pnpm workspace definition
└── README.md                    # Project documentation
```

---

## 3. Communication & Data Flow

1. **Client Request**:
   - The user opens the web app in their browser.
   - TanStack Query dispatches requests through `apiClient` (`/api/v1/health`).
   - In local development, the Vite dev server reverse-proxies `/api` requests to `http://localhost:5000` to prevent CORS issues.

2. **Express Gateway Handling**:
   - `requestLogger` logs the HTTP method, endpoint, and computes execution latency.
   - `cors` verifies request origin against `FRONTEND_URL`.
   - `express.json` parses incoming JSON payloads.

3. **Routing & Health Verification**:
   - `/api/v1/health`: Checks application uptime, runtime environment, and current timestamp.
   - `/api/v1/health/database`: Dispatches a live query (`SELECT 1`) through `prisma` to verify PostgreSQL connection.

4. **Response Protocol**:
   - All API responses strictly adhere to a standard JSON envelope:
     ```json
     {
       "success": true,
       "message": "Human-readable description",
       "data": { ... },
       "timestamp": "2026-11-24T19:00:00.000Z"
     }
     ```

---

## 4. Design Palette & Brand System

To represent a modern, robust, and clean industrial food processing environment, the UI adheres to the following color palette:

| Token              | Hex Code  | Purpose                                                    |
| :----------------- | :-------- | :--------------------------------------------------------- |
| **Primary Navy**   | `#172F50` | Primary actions, app header, typography emphasis           |
| **Secondary Blue** | `#2563A6` | Active links, secondary navigation, interactive elements   |
| **Teal**           | `#0D9488` | Success badges, verified statuses, process flow highlights |
| **Warning**        | `#F59E0B` | System alerts, pending actions, development notices        |
| **Background**     | `#F8FAFC` | Light neutral application canvas                           |
| **Text**           | `#1E293B` | High-contrast accessible body text                         |

---

## 5. Security & Architectural Governance

- **Zero Hardcoded Secrets**: Secrets and credentials are never checked into version control. Environment variables are validated on startup using Zod.
- **Strict Role Model**: Architecture accounts for 5 future roles: `SALESMAN`, `ADMIN`, `PRODUCTION`, `OWNER`, and `AUDITOR`.
- **Decimal Precision Rule**: Financial values (GST, Unit Costs, Margins) must use database `Decimal` / integer paisa representation, never floating-point arithmetic.
- **No Mock Dashboards**: No fake statistics or mock transactions are placed into the UI to guarantee architectural honesty.
