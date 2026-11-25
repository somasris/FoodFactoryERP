# FoodFactory ERP – Disaster Recovery & Database Operations Runbook

**Last Updated:** 2026-11-25  
**Scope:** PostgreSQL Backup, Verification, Controlled Restore, and Maintenance Mode

---

## 1. Backup Configuration & Safety

- **Environment Variable:** Configure `BACKUP_DIR` on the API host pointing to an encrypted, off-host or dedicated backup volume (never inside the public web root).
- **Database Credentials:** `pg_dump` uses the host `DATABASE_URL` environment variable; credentials are never stored in `system_configs` or returned by any API.
- **Verification:** Backups compute a SHA-256 checksum on creation and can be re-verified via `POST /api/v1/operations/backups/:id/verify`.

---

## 2. Controlled Restore Procedure

**CRITICAL SAFETY RULE:** Automated web/API endpoints **never** drop, truncate, or overwrite the active production database.

1. **Request Restore:** An authorized administrator submits a restore request (`POST /api/v1/operations/restore-requests`) referencing a `VERIFIED` `BackupRecord`.
2. **Dual Approval:** A privileged administrator approves the request (`POST /api/v1/operations/restore-requests/:id/review`) after verifying the target isolated environment.
3. **Enable Maintenance Mode:** Enable maintenance mode (`PUT /api/v1/operations/maintenance-mode`) so regular users receive HTTP 503 while `OWNER`/`ADMIN` retain access.
4. **Isolated Recovery Execution (CLI / DBA):**
   ```bash
   # 1. Verify checksum
   sha256sum /path/to/backup.sql
   # 2. Restore into an ISOLATED staging/recovery database first
   createdb foodfactory_erp_recovery
   psql -d foodfactory_erp_recovery -f /path/to/backup.sql
   # 3. Validate row counts & ledger reconciliation before any cutover
   ```
5. **Disable Maintenance Mode** after cutover verification is complete.
