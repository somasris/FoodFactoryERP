# FoodFactory ERP – Development Setup Guide (Windows)

This document provides exact, reproducible instructions for setting up and running **FoodFactory ERP** on a Windows workstation.

---

## 1. Prerequisites

Ensure the following tools are installed:

- **Node.js**: `v20.0.0` or higher (tested with `v24.x`)
- **pnpm**: `v9.0.0` or higher (tested with `v10.x`)
- **Git**: `2.x+`
- **PostgreSQL**: Either local PostgreSQL 16+ or Docker Desktop with Docker Compose.

---

## 2. Clone and Initial Setup

Open PowerShell and navigate to your project directory:

```powershell
cd d:\somasri\projects\FoodFactoryERP
```

### Environment Configuration

Copy the example environment configuration:

```powershell
Copy-Item .env.example .env
Copy-Item .env.example apps/api/.env
```

Review `.env` and verify database credentials:

```dotenv
NODE_ENV=development
PORT=5000
DATABASE_URL=postgresql://postgres:postgres@localhost:5433/foodfactory_erp?schema=public
FRONTEND_URL=http://localhost:5173
JWT_ACCESS_SECRET=your_jwt_access_secret_key_minimum_32_chars_long_placeholder
```

---

## 3. Database Setup Options

### Option A: Local Windows PostgreSQL Service (Recommended for native Windows)

If you have PostgreSQL installed natively on Windows:

1. Initialize or start the service on port `5433` (or default `5432` depending on configuration):

   ```powershell
   # If running PostgreSQL as a local service or standalone instance:
   & "C:\Program Files\PostgreSQL\18\bin\pg_ctl.exe" -D "d:\somasri\projects\FoodFactoryERP\.pgdata" -p 5433 start
   ```

2. Create the development database:
   ```powershell
   & "C:\Program Files\PostgreSQL\18\bin\createdb.exe" -h 127.0.0.1 -p 5433 -U postgres foodfactory_erp
   ```

### Option B: Docker Compose

If using Docker Desktop:

```powershell
docker compose up -d
```

Verify the container is healthy:

```powershell
docker compose ps
```

---

## 4. Install Dependencies

Install all monorepo dependencies:

```powershell
pnpm install
```

---

## 5. Prisma Database Migrations

Generate the Prisma Client and apply migrations:

```powershell
# Generate Prisma Client
pnpm db:generate

# Apply migrations
pnpm db:migrate
```

Optionally seed initial foundation configuration data:

```powershell
pnpm --filter @foodfactory/api db:seed
```

---

## 6. Running the Development Environment

To start both the Frontend and Backend concurrently with a single command:

```powershell
pnpm dev
```

Output:

- Backend REST API: [http://localhost:5000](http://localhost:5000)
- Frontend Web App: [http://localhost:5173](http://localhost:5173)

### Individual App Execution

- **API only**: `pnpm dev:api`
- **Frontend only**: `pnpm dev:web`

---

## 7. Verification & Health Checks

### Check Backend Health

Open browser or run via PowerShell:

```powershell
Invoke-RestMethod -Uri http://localhost:5000/api/v1/health
```

Expected output:

```json
{
  "success": true,
  "message": "FoodFactory ERP API is operating normally",
  "data": {
    "application": "FoodFactory ERP API",
    "status": "healthy",
    "environment": "development",
    "timestamp": "..."
  }
}
```

### Check Database Connectivity

```powershell
Invoke-RestMethod -Uri http://localhost:5000/api/v1/health/database
```

Expected output:

```json
{
  "success": true,
  "message": "PostgreSQL database connection verified successfully",
  "data": {
    "database": "PostgreSQL",
    "status": "connected",
    "latencyMs": 5
  }
}
```

---

## 8. Quality & Build Checks

Before submitting or committing:

```powershell
# Type verification across all packages
pnpm typecheck

# Code formatting
pnpm format

# Linting
pnpm lint

# Production build test
pnpm build
```
