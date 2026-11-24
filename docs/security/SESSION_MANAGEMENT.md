# FoodFactory ERP – Session Management & Token Rotation

## 1. Principles of Session Security

In FoodFactory ERP, user authentication is managed via a **hybrid stateless-stateful model**:

- **Access Tokens (Stateless):** Short-lived JWTs (15 minutes) validated cryptographically on each request without database I/O.
- **Refresh Tokens (Stateful):** Cryptographically random 48-byte strings hashed in PostgreSQL, used exclusively to rotate expired access tokens.

---

## 2. Refresh Token Rotation (RTR) & Family Reuse Detection

To neutralize the risk of stolen refresh tokens, FoodFactory ERP implements **Refresh Token Rotation with Token Families** (RFC 6749 §10.4 & OAuth 2.0 Security BCP §4.14).

### 2.1 The Token Family Concept

When a user logs in, the API establishes a new `family` identified by a UUID. Every refresh operation marks the presenting token as revoked (`is_revoked = true`) and issues a new token belonging to the **same family**.

```
[Login] ────> Token A (Family 1, is_revoked = false)
                 │
                 ▼  (Valid Refresh)
              Token B (Family 1, is_revoked = false)  [Token A is_revoked = true]
                 │
                 ▼  (Valid Refresh)
              Token C (Family 1, is_revoked = false)  [Token B is_revoked = true]
```

### 2.2 Replay & Reuse Detection Mechanism

If an attacker intercepts `Token A` and attempts to use it after `Token B` was already issued:

```
[Attacker] ───> Presents Token A (is_revoked === true!)
                    │
                    ▼  (REUSE DETECTED!)
[API Engine] ───> 1. Updates ALL tokens in Family 1 to is_revoked = true
                  2. Logs SECURITY_ALERT in audit_logs
                  3. Terminates legitimate user's active session
                  4. Returns 401 Unauthorized
```

Because both legitimate user and attacker lose access immediately, the adversary cannot maintain persistence.

---

## 3. Database Schema for Session Tracking

The `refresh_tokens` table maintains minimal state:

```prisma
model RefreshToken {
  id        String   @id @default(uuid())
  userId    String   @map("user_id")
  tokenHash String   @unique @map("token_hash") @db.VarChar(255)
  family    String   @db.VarChar(64)
  isRevoked Boolean  @default(false) @map("is_revoked")
  expiresAt DateTime @map("expires_at")
  ipAddress String?  @map("ip_address") @db.VarChar(45)
  userAgent String?  @map("user_agent") @db.Text
  createdAt DateTime @default(now()) @map("created_at")
  updatedAt DateTime @updatedAt @map("updated_at")

  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId])
  @@index([family])
  @@map("refresh_tokens")
}
```

- **Secure Hashing:** `tokenHash` stores `HMAC-SHA256(rawToken, JWT_REFRESH_SECRET)`.
- **Zero Plaintext:** A compromised database dump exposes only irreversible hashes.

---

## 4. Session Revocation Scenarios

| Action                   | Endpoint / Trigger                                    | Operation Performed                                                            | Audit Log Action |
| :----------------------- | :---------------------------------------------------- | :----------------------------------------------------------------------------- | :--------------- |
| **Standard Logout**      | `POST /api/v1/auth/logout`                            | Sets `is_revoked = true` for active refresh token. Clears browser cookie.      | `LOGOUT`         |
| **Logout All Devices**   | `POST /api/v1/auth/logout-all`                        | Sets `is_revoked = true` for all active tokens belonging to `req.user.userId`. | `LOGOUT`         |
| **Admin Force Revoke**   | `POST /api/v1/users/:id/revoke-sessions`              | Administrator revokes all tokens for a targeted employee.                      | `CANCEL`         |
| **Account Deactivation** | `PATCH /api/v1/users/:id/status` (`isActive = false`) | Automatically revokes all active tokens and blocks new logins.                 | `UPDATE`         |
| **Token Reuse Alert**    | Detected during `POST /api/v1/auth/refresh`           | Immediately revokes all tokens matching the compromised `family`.              | `SECURITY_ALERT` |

---

## 5. Cookie Specification

The refresh token is delivered to browsers in an HTTP-only cookie named `ff_refresh_token`:

- **`HttpOnly: true`**: JavaScript cannot access the token via `document.cookie` (mitigates XSS extraction).
- **`Secure: true`**: In production, transmits only over HTTPS TLS encrypted channels.
- **`SameSite: Lax`**: Mitigates Cross-Site Request Forgery (CSRF) while permitting top-level navigation.
- **`Path: /api/v1/auth`**: Scoped exclusively to authentication endpoints to minimize cookie leakage on asset or business API requests.
