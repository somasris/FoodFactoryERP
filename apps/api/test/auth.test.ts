import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { createApp } from '../src/app';
import { prisma } from '../src/services/prisma.service';
import { hashPassword } from '../src/utils/password';
import { env } from '../src/config/env';
import { TOKEN_AUDIENCE, TOKEN_ISSUER, hashRefreshToken } from '../src/utils/token';

const app = createApp();

describe('Phase 1.3 Authentication, CSRF & Concurrency Suite', () => {
  const testUserPassword = 'TestAuthPassword2026!';
  let activeUserId: string;
  let disabledUserId: string;

  beforeAll(async () => {
    // Clean up previous test users if any
    await prisma.user.deleteMany({
      where: {
        username: { in: ['authtest_active', 'authtest_disabled'] },
      },
    });

    const hashedPassword = await hashPassword(testUserPassword);
    const salesmanRole = await prisma.role.findUnique({ where: { code: 'SALESMAN' } });

    // Create an active test user
    const activeUser = await prisma.user.create({
      data: {
        email: 'authtest_active@foodfactory.com',
        username: 'authtest_active',
        passwordHash: hashedPassword,
        fullName: 'Active Test User',
        isActive: true,
        userRoles: salesmanRole ? { create: { roleId: salesmanRole.id } } : undefined,
      },
    });
    activeUserId = activeUser.id;

    // Create a disabled test user
    const disabledUser = await prisma.user.create({
      data: {
        email: 'authtest_disabled@foodfactory.com',
        username: 'authtest_disabled',
        passwordHash: hashedPassword,
        fullName: 'Disabled Test User',
        isActive: false,
        userRoles: salesmanRole ? { create: { roleId: salesmanRole.id } } : undefined,
      },
    });
    disabledUserId = disabledUser.id;
  });

  afterAll(async () => {
    await prisma.user.deleteMany({
      where: { id: { in: [activeUserId, disabledUserId] } },
    });
    await prisma.$disconnect();
  });

  // ============================================================================
  // 1. BASIC AUTHENTICATION & LOGIN
  // ============================================================================

  it('1. Successful login returns tokens and user profile', async () => {
    const res = await request(app).post('/api/v1/auth/login').send({
      usernameOrEmail: 'authtest_active',
      password: testUserPassword,
    });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.accessToken).toBeDefined();
    expect(res.body.data.refreshToken).toBeDefined();
    expect(res.body.data.user.email).toBe('authtest_active@foodfactory.com');
    expect(res.headers['set-cookie']).toBeDefined();
  });

  it('2. Invalid password is rejected with generic error', async () => {
    const res = await request(app).post('/api/v1/auth/login').send({
      usernameOrEmail: 'authtest_active',
      password: 'WrongPassword123!',
    });

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toBe('Invalid email/username or password');
  });

  it('3. Unknown account is rejected with generic error', async () => {
    const res = await request(app).post('/api/v1/auth/login').send({
      usernameOrEmail: 'nonexistent_user_99999',
      password: 'AnyPassword123!',
    });

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toBe('Invalid email/username or password');
  });

  it('4. Disabled account is rejected with deactivation message', async () => {
    const res = await request(app).post('/api/v1/auth/login').send({
      usernameOrEmail: 'authtest_disabled',
      password: testUserPassword,
    });

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toContain('deactivated');
  });

  it('5. Expired access token is rejected on protected endpoints', async () => {
    const expiredToken = jwt.sign(
      {
        userId: activeUserId,
        username: 'authtest_active',
        email: 'authtest_active@foodfactory.com',
        roles: ['SALESMAN'],
        permissions: ['sales.orders.read'],
      },
      env.JWT_ACCESS_SECRET,
      {
        expiresIn: '-10s',
        issuer: TOKEN_ISSUER,
        audience: TOKEN_AUDIENCE,
      },
    );

    const res = await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${expiredToken}`);

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toContain('expired');
  });

  // ============================================================================
  // 2. CSRF & COOKIE SECURITY TESTS
  // ============================================================================

  it('6. CSRF: Missing custom header (X-Requested-With) is rejected with 403', async () => {
    const loginRes = await request(app).post('/api/v1/auth/login').send({
      usernameOrEmail: 'authtest_active',
      password: testUserPassword,
    });

    const token = loginRes.body.data.refreshToken;

    // Send without X-Requested-With
    const res = await request(app)
      .post('/api/v1/auth/refresh')
      .send({ refreshToken: token });

    expect(res.status).toBe(403);
    expect(res.body.message).toContain('Missing or invalid required anti-CSRF request header');
  });

  it('7. CSRF: Disallowed cross-origin request is rejected with 403', async () => {
    const loginRes = await request(app).post('/api/v1/auth/login').send({
      usernameOrEmail: 'authtest_active',
      password: testUserPassword,
    });

    const token = loginRes.body.data.refreshToken;

    // Send with an unauthorized attacker origin
    const res = await request(app)
      .post('/api/v1/auth/refresh')
      .set('X-Requested-With', 'XMLHttpRequest')
      .set('Origin', 'https://malicious-attacker-site.com')
      .send({ refreshToken: token });

    expect(res.status).toBe(403);
    expect(res.body.message).toContain('Cross-origin request blocked by CSRF policy');
  });

  it('8. CSRF: Valid same-origin request with X-Requested-With header succeeds', async () => {
    const loginRes = await request(app).post('/api/v1/auth/login').send({
      usernameOrEmail: 'authtest_active',
      password: testUserPassword,
    });

    const token = loginRes.body.data.refreshToken;

    const res = await request(app)
      .post('/api/v1/auth/refresh')
      .set('X-Requested-With', 'XMLHttpRequest')
      .set('Origin', env.FRONTEND_URL)
      .send({ refreshToken: token });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.accessToken).toBeDefined();
  });

  // ============================================================================
  // 3. REFRESH CONCURRENCY, ATOMICITY & REUSE SAFETY
  // ============================================================================

  it('9. Two simultaneous refresh requests using the same token cannot both consume it', async () => {
    const loginRes = await request(app).post('/api/v1/auth/login').send({
      usernameOrEmail: 'authtest_active',
      password: testUserPassword,
    });

    const sharedToken = loginRes.body.data.refreshToken;

    // Fire 2 simultaneous refresh requests concurrently with the exact same token
    const [res1, res2] = await Promise.all([
      request(app)
        .post('/api/v1/auth/refresh')
        .set('X-Requested-With', 'XMLHttpRequest')
        .send({ refreshToken: sharedToken }),
      request(app)
        .post('/api/v1/auth/refresh')
        .set('X-Requested-With', 'XMLHttpRequest')
        .send({ refreshToken: sharedToken }),
    ]);

    const statuses = [res1.status, res2.status].sort();
    // Exactly one must succeed (200) and the other must be rejected (401)
    expect(statuses).toEqual([200, 401]);

    const winningRes = res1.status === 200 ? res1 : res2;
    const losingRes = res1.status === 401 ? res1 : res2;

    expect(losingRes.body.message).toContain('Concurrent token refresh detected');

    // Crucial: The winning token is NOT revoked! It can be used to query /auth/me
    const meRes = await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${winningRes.body.data.accessToken}`);
    expect(meRes.status).toBe(200);
  });

  it('10. Reuse of a previously rotated token beyond grace period revokes the complete token family', async () => {
    // 1. Login
    const loginRes = await request(app).post('/api/v1/auth/login').send({
      usernameOrEmail: 'authtest_active',
      password: testUserPassword,
    });
    const tokenA = loginRes.body.data.refreshToken;

    // 2. Rotate tokenA -> yields tokenB
    const rotateRes = await request(app)
      .post('/api/v1/auth/refresh')
      .set('X-Requested-With', 'XMLHttpRequest')
      .send({ refreshToken: tokenA });
    expect(rotateRes.status).toBe(200);
    const tokenB = rotateRes.body.data.refreshToken;

    // 3. Simulate passage of time past the concurrency grace window (5000ms) by updating updatedAt in DB
    const hashA = hashRefreshToken(tokenA);
    const pastDate = new Date(Date.now() - 15000); // 15 seconds ago
    await prisma.$executeRaw`UPDATE refresh_tokens SET updated_at = ${pastDate} WHERE token_hash = ${hashA}`;

    // 4. Adversary replays tokenA past the grace window!
    const adversaryRes = await request(app)
      .post('/api/v1/auth/refresh')
      .set('X-Requested-With', 'XMLHttpRequest')
      .send({ refreshToken: tokenA });

    expect(adversaryRes.status).toBe(401);
    expect(adversaryRes.body.message).toContain('Token reuse detected');

    // 5. Verify the entire token family was revoked: tokenB is now also revoked!
    const victimRes = await request(app)
      .post('/api/v1/auth/refresh')
      .set('X-Requested-With', 'XMLHttpRequest')
      .send({ refreshToken: tokenB });

    expect(victimRes.status).toBe(401);
    expect(victimRes.body.message).toContain('Token reuse detected');
  });

  it('11. Refresh after logout is rejected', async () => {
    const loginRes = await request(app).post('/api/v1/auth/login').send({
      usernameOrEmail: 'authtest_active',
      password: testUserPassword,
    });
    const refreshToken = loginRes.body.data.refreshToken;

    // Logout
    const logoutRes = await request(app)
      .post('/api/v1/auth/logout')
      .set('X-Requested-With', 'XMLHttpRequest')
      .send({ refreshToken });
    expect(logoutRes.status).toBe(200);

    // Make sure updatedAt is past grace window
    const hash = hashRefreshToken(refreshToken);
    const pastDate = new Date(Date.now() - 10000);
    await prisma.$executeRaw`UPDATE refresh_tokens SET updated_at = ${pastDate} WHERE token_hash = ${hash}`;

    // Refresh attempt must fail
    const refreshRes = await request(app)
      .post('/api/v1/auth/refresh')
      .set('X-Requested-With', 'XMLHttpRequest')
      .send({ refreshToken });
    expect(refreshRes.status).toBe(401);
  });

  it('12. Refresh after logout-all is rejected', async () => {
    const loginRes = await request(app).post('/api/v1/auth/login').send({
      usernameOrEmail: 'authtest_active',
      password: testUserPassword,
    });
    const accessToken = loginRes.body.data.accessToken;
    const refreshToken = loginRes.body.data.refreshToken;

    // Logout-all
    await request(app)
      .post('/api/v1/auth/logout-all')
      .set('Authorization', `Bearer ${accessToken}`);

    const hash = hashRefreshToken(refreshToken);
    await prisma.$executeRaw`UPDATE refresh_tokens SET updated_at = ${pastDate} WHERE token_hash = ${hash}`;

    const refreshRes = await request(app)
      .post('/api/v1/auth/refresh')
      .set('X-Requested-With', 'XMLHttpRequest')
      .send({ refreshToken });
    expect(refreshRes.status).toBe(401);
  });

  it('13. Refresh by a deactivated/disabled user is rejected with 403', async () => {
    // 1. Login while active
    const loginRes = await request(app).post('/api/v1/auth/login').send({
      usernameOrEmail: 'authtest_active',
      password: testUserPassword,
    });
    const refreshToken = loginRes.body.data.refreshToken;

    // 2. Admin deactivates this user in database
    await prisma.user.update({
      where: { id: activeUserId },
      data: { isActive: false },
    });

    // 3. Attempt refresh -> rejected with 403 deactivated
    const refreshRes = await request(app)
      .post('/api/v1/auth/refresh')
      .set('X-Requested-With', 'XMLHttpRequest')
      .send({ refreshToken });

    expect(refreshRes.status).toBe(403);
    expect(refreshRes.body.message).toContain('deactivated');

    // Restore user active status
    await prisma.user.update({
      where: { id: activeUserId },
      data: { isActive: true },
    });
  });

  it('14. Refresh using an expired token is rejected', async () => {
    const loginRes = await request(app).post('/api/v1/auth/login').send({
      usernameOrEmail: 'authtest_active',
      password: testUserPassword,
    });
    const refreshToken = loginRes.body.data.refreshToken;

    // Manually expire the token in database
    const hash = hashRefreshToken(refreshToken);
    await prisma.refreshToken.update({
      where: { tokenHash: hash },
      data: { expiresAt: new Date(Date.now() - 60000) }, // Expired 1 min ago
    });

    const refreshRes = await request(app)
      .post('/api/v1/auth/refresh')
      .set('X-Requested-With', 'XMLHttpRequest')
      .send({ refreshToken });

    expect(refreshRes.status).toBe(401);
    expect(refreshRes.body.message).toContain('expired');
  });
});
