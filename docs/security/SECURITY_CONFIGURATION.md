# FoodFactory ERP – Security Configuration & Hardening Guide

## 1. Environment Variables Reference

All credentials and cryptographic seeds are configured through environment variables:

| Variable                  | Required | Default (Dev)           | Description                                                                            |
| :------------------------ | :------: | :---------------------- | :------------------------------------------------------------------------------------- |
| `NODE_ENV`                |   Yes    | `development`           | Environment mode (`development`, `test`, `production`).                                |
| `PORT`                    |    No    | `5000`                  | Backend API port.                                                                      |
| `DATABASE_URL`            |   Yes    | —                       | PostgreSQL connection string.                                                          |
| `FRONTEND_URL`            |   Yes    | `http://localhost:5173` | Allowed CORS origin for the React single-page application.                             |
| `JWT_ACCESS_SECRET`       |   Yes    | (fallback string)       | Cryptographic key for signing JWT access tokens (minimum 32 characters in production). |
| `JWT_REFRESH_SECRET`      |   Yes    | (fallback string)       | Pepper secret for HMAC-SHA256 hashing of refresh tokens.                               |
| `JWT_ACCESS_EXPIRY`       |    No    | `15m`                   | Lifetime of access tokens (e.g. `15m`, `30m`).                                         |
| `JWT_REFRESH_EXPIRY_DAYS` |    No    | `7`                     | Lifetime of refresh tokens in days.                                                    |
| `COOKIE_SAME_SITE`        |    No    | `lax`                   | SameSite cookie attribute (`lax`, `strict`, `none`).                                   |
| `COOKIE_SECURE`           |    No    | `false`                 | Force `Secure` flag on cookies regardless of `NODE_ENV`.                               |
| `INITIAL_OWNER_EMAIL`     |    No    | —                       | Email for idempotent provisioning of initial OWNER account.                            |
| `INITIAL_OWNER_USERNAME`  |    No    | `owner`                 | Username for initial OWNER account.                                                    |
| `INITIAL_OWNER_PASSWORD`  |    No    | —                       | Strong password for initial OWNER account (validated against policy).                  |
| `INITIAL_OWNER_FULLNAME`  |    No    | `Managing Director`     | Display name for initial OWNER account.                                                |

---

## 2. Cross-Origin Resource Sharing (CORS)

Configured in `apps/api/src/app.ts`:

```typescript
app.use(
  cors({
    origin: env.FRONTEND_URL,
    credentials: true, // Required for HTTP-only cookies
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  }),
);
```

- **No Wildcard (`*`):** Wildcard origins are rejected by modern browsers when `credentials: true`.
- **Explicit Methods & Headers:** Only necessary verbs and headers are allowed.

---

## 3. Cross-Site Request Forgery (CSRF) Mitigation

FoodFactory ERP implements defense-in-depth against CSRF:

1. **`SameSite=Lax` Cookie Policy:** Browser suppresses the `ff_refresh_token` cookie on cross-site sub-requests (such as image loads or cross-site AJAX).
2. **`X-Requested-With` Custom Header Verification:**
   Standard HTML forms (`<form action="..." method="POST">`) cannot send custom HTTP headers like `X-Requested-With: XMLHttpRequest` without triggering a CORS preflight (`OPTIONS`) request. Because cross-origin origins are strictly restricted by CORS, forged submissions from external origins are rejected before reaching controller execution.
3. **Restricted Cookie Path:** Refresh cookies are scoped exclusively to `path: '/api/v1/auth'`, preventing automatic inclusion on general API calls.

---

## 4. Rate Limiting Specifications

Configured using `express-rate-limit`:

| Route                       |   Window   | Request Limit | Purpose                                                        |
| :-------------------------- | :--------: | :-----------: | :------------------------------------------------------------- |
| `POST /api/v1/auth/login`   | 15 minutes |  10 attempts  | Thwarts brute-force password guessing and credential stuffing. |
| `POST /api/v1/auth/refresh` | 15 minutes |  30 requests  | Prevents denial-of-service and rapid token churn attacks.      |

---

## 5. Initial OWNER Provisioning Strategy

To prevent security anti-patterns (such as hardcoded `admin/admin` credentials in repository seeds):

1. The database seeder (`prisma/seed.ts`) reads `INITIAL_OWNER_EMAIL` and `INITIAL_OWNER_PASSWORD` from `.env`.
2. The seeder validates the password against the production password policy.
3. The password is dynamically hashed with Argon2id before insertion.
4. If environment variables are absent, owner account creation is skipped without error, allowing an authorized administrator or CLI workflow to provision the account.

---

## 6. Known Security Limitations & Production Hardening Roadmap

1. **Reverse Proxy Configuration:** In production deployments behind Nginx, AWS ALB, or Cloudflare, ensure `app.set('trust proxy', 1)` is enabled to accurately extract client IP addresses for rate limiting.
2. **Database Level Connection Encryption:** Production PostgreSQL instances must enforce SSL/TLS connections (`sslmode=require`).
3. **Key Rotation Pipeline:** Future phases should implement automated rotation for `JWT_ACCESS_SECRET` via a JWKS (JSON Web Key Set) or rotating asymmetric RS256 key pairs.
