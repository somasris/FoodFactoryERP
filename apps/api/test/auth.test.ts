import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { createApp } from '../src/app';
import { prisma } from '../src/services/prisma.service';
import { hashPassword } from '../src/utils/password';
import { env } from '../src/config/env';
import { TOKEN_AUDIENCE, TOKEN_ISSUER } from '../src/utils/token';

const app = createApp();

describe('Phase 1.3 Authentication Integration Suite', () => {
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
    // Forge an expired token with valid signature
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

  it('6. Valid refresh rotates token and returns new tokens', async () => {
    // First login to get a refresh token
    const loginRes = await request(app).post('/api/v1/auth/login').send({
      usernameOrEmail: 'authtest_active',
      password: testUserPassword,
    });

    const initialRefreshToken = loginRes.body.data.refreshToken;
    expect(initialRefreshToken).toBeDefined();

    // Call /api/v1/auth/refresh
    const refreshRes = await request(app)
      .post('/api/v1/auth/refresh')
      .send({ refreshToken: initialRefreshToken });

    expect(refreshRes.status).toBe(200);
    expect(refreshRes.body.success).toBe(true);
    expect(refreshRes.body.data.accessToken).toBeDefined();
    expect(refreshRes.body.data.refreshToken).toBeDefined();
    // Check that rotated token is distinct
    expect(refreshRes.body.data.refreshToken).not.toBe(initialRefreshToken);
  });

  it('7. Refresh token rotation invalidates the prior token', async () => {
    const loginRes = await request(app).post('/api/v1/auth/login').send({
      usernameOrEmail: 'authtest_active',
      password: testUserPassword,
    });

    const token1 = loginRes.body.data.refreshToken;

    // Use token1 once -> gives token2
    const refreshRes1 = await request(app)
      .post('/api/v1/auth/refresh')
      .send({ refreshToken: token1 });
    expect(refreshRes1.status).toBe(200);

    // Using token1 again MUST trigger reuse detection!
    const reuseRes = await request(app).post('/api/v1/auth/refresh').send({ refreshToken: token1 });

    expect(reuseRes.status).toBe(401);
    expect(reuseRes.body.message).toContain('Token reuse detected');
  });

  it('8. Refresh token reuse revokes entire token family', async () => {
    // 1. Login to start family
    const loginRes = await request(app).post('/api/v1/auth/login').send({
      usernameOrEmail: 'authtest_active',
      password: testUserPassword,
    });

    const tokenA = loginRes.body.data.refreshToken;

    // 2. Rotate to tokenB
    const rotateRes1 = await request(app)
      .post('/api/v1/auth/refresh')
      .send({ refreshToken: tokenA });
    const tokenB = rotateRes1.body.data.refreshToken;

    // 3. Rotate to tokenC
    const rotateRes2 = await request(app)
      .post('/api/v1/auth/refresh')
      .send({ refreshToken: tokenB });
    const tokenC = rotateRes2.body.data.refreshToken;

    // 4. Adversary replays expired/rotated tokenA!
    const adversaryRes = await request(app)
      .post('/api/v1/auth/refresh')
      .send({ refreshToken: tokenA });
    expect(adversaryRes.status).toBe(401);

    // 5. Verify that tokenC in the same family has now also been revoked!
    const victimRes = await request(app)
      .post('/api/v1/auth/refresh')
      .send({ refreshToken: tokenC });
    expect(victimRes.status).toBe(401);
    expect(victimRes.body.message).toContain('Token reuse detected');
  });

  it('9. Logout revokes the session refresh token', async () => {
    const loginRes = await request(app).post('/api/v1/auth/login').send({
      usernameOrEmail: 'authtest_active',
      password: testUserPassword,
    });

    const refreshToken = loginRes.body.data.refreshToken;

    const logoutRes = await request(app).post('/api/v1/auth/logout').send({ refreshToken });

    expect(logoutRes.status).toBe(200);

    // Attempting refresh with logged-out token should fail
    const refreshRes = await request(app).post('/api/v1/auth/refresh').send({ refreshToken });

    expect(refreshRes.status).toBe(401);
  });

  it('10. Logout-all revokes all sessions for user', async () => {
    // Login session 1
    const s1 = await request(app)
      .post('/api/v1/auth/login')
      .send({ usernameOrEmail: 'authtest_active', password: testUserPassword });

    // Login session 2
    const s2 = await request(app)
      .post('/api/v1/auth/login')
      .send({ usernameOrEmail: 'authtest_active', password: testUserPassword });

    const accessToken1 = s1.body.data.accessToken;
    const refresh1 = s1.body.data.refreshToken;
    const refresh2 = s2.body.data.refreshToken;

    // Call logout-all using accessToken1
    const logoutAllRes = await request(app)
      .post('/api/v1/auth/logout-all')
      .set('Authorization', `Bearer ${accessToken1}`);

    expect(logoutAllRes.status).toBe(200);

    // Both refresh tokens should now fail
    const r1 = await request(app).post('/api/v1/auth/refresh').send({ refreshToken: refresh1 });
    const r2 = await request(app).post('/api/v1/auth/refresh').send({ refreshToken: refresh2 });

    expect(r1.status).toBe(401);
    expect(r2.status).toBe(401);
  });
});
