import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app';
import { prisma } from '../src/services/prisma.service';
import { hashPassword } from '../src/utils/password';
import { generateAccessToken } from '../src/utils/token';

const app = createApp();

describe('Session Timeout & Inactivity Enforcement Backend Suite', () => {
  const suf = Date.now().toString().slice(-6);
  const userName = `sess_user_${suf}`;
  const otherName = `sess_other_${suf}`;
  const password = 'SessionPass2026!';
  let userId: string;
  let otherUserId: string;
  let adminUserId: string;
  let auditorUserId: string;
  let adminToken: string;
  let auditorToken: string;

  beforeAll(async () => {
    const pw = await hashPassword(password);
    const prodRole = await prisma.role.findUniqueOrThrow({
      where: { code: 'PRODUCTION' },
      include: { permissions: { include: { permission: true } } },
    });
    const adminRole = await prisma.role.findUniqueOrThrow({
      where: { code: 'ADMIN' },
      include: { permissions: { include: { permission: true } } },
    });
    const auditorRole = await prisma.role.findUniqueOrThrow({
      where: { code: 'AUDITOR' },
      include: { permissions: { include: { permission: true } } },
    });

    const u = await prisma.user.create({
      data: {
        email: `${userName}@foodfactory.com`,
        username: userName,
        fullName: 'Session Test User',
        passwordHash: pw,
        isActive: true,
        userRoles: { create: { roleId: prodRole.id } },
      },
    });
    userId = u.id;

    const other = await prisma.user.create({
      data: {
        email: `${otherName}@foodfactory.com`,
        username: otherName,
        fullName: 'Other Session User',
        passwordHash: pw,
        isActive: true,
        userRoles: { create: { roleId: prodRole.id } },
      },
    });
    otherUserId = other.id;

    const adminUser = await prisma.user.create({
      data: {
        email: `admin_sess_${suf}@foodfactory.com`,
        username: `admin_sess_${suf}`,
        fullName: 'Session Admin User',
        passwordHash: pw,
        isActive: true,
        userRoles: { create: { roleId: adminRole.id } },
      },
    });
    adminUserId = adminUser.id;
    adminToken = generateAccessToken({
      userId: adminUser.id,
      username: adminUser.username,
      email: adminUser.email,
      roles: ['ADMIN'],
      permissions: adminRole.permissions.map(p => p.permission.code),
    });

    const auditorUser = await prisma.user.create({
      data: {
        email: `auditor_sess_${suf}@foodfactory.com`,
        username: `auditor_sess_${suf}`,
        fullName: 'Session Auditor User',
        passwordHash: pw,
        isActive: true,
        userRoles: { create: { roleId: auditorRole.id } },
      },
    });
    auditorUserId = auditorUser.id;
    auditorToken = generateAccessToken({
      userId: auditorUser.id,
      username: auditorUser.username,
      email: auditorUser.email,
      roles: ['AUDITOR'],
      permissions: auditorRole.permissions.map(p => p.permission.code),
    });
  });

  afterAll(async () => {
    const ids = [userId, otherUserId, adminUserId, auditorUserId].filter(Boolean);
    await prisma.userSession.deleteMany({ where: { userId: { in: ids } } });
    await prisma.refreshToken.deleteMany({ where: { userId: { in: ids } } });
    await prisma.user.deleteMany({ where: { id: { in: ids } } });
  });

  it('1. Login creates UserSession, returns authoritative policy, and extends validly', async () => {
    const loginRes = await request(app).post('/api/v1/auth/login').send({
      usernameOrEmail: userName,
      password,
    });
    expect(loginRes.status).toBe(200);
    const accessToken = loginRes.body.data.accessToken as string;

    const statusRes = await request(app)
      .get('/api/v1/auth/session')
      .set('Authorization', `Bearer ${accessToken}`);
    expect(statusRes.status).toBe(200);
    expect(statusRes.body.data.sessionId).toBeTruthy();
    expect(statusRes.body.data.timeoutMinutes).toBe(15);
    expect(statusRes.body.data.warningMinutes).toBe(2);

    const extRes = await request(app)
      .post('/api/v1/auth/session/extend')
      .set('Authorization', `Bearer ${accessToken}`)
      .set('X-Requested-With', 'XMLHttpRequest');
    expect(extRes.status).toBe(200);
    expect(extRes.body.data.accessToken).toBeTruthy();
    expect(new Date(extRes.body.data.inactivityExpiresAt).getTime()).toBeGreaterThan(Date.now());
  });

  it('2. Expired session is rejected on protected APIs, extension, and refresh', async () => {
    const loginRes = await request(app).post('/api/v1/auth/login').send({
      usernameOrEmail: userName,
      password,
    });
    const accessToken = loginRes.body.data.accessToken as string;
    const refreshToken = loginRes.body.data.refreshToken as string;

    const statusRes = await request(app)
      .get('/api/v1/auth/session')
      .set('Authorization', `Bearer ${accessToken}`);
    const sessionId = statusRes.body.data.sessionId as string;

    // Force inactivity expiration in DB
    await prisma.userSession.update({
      where: { id: sessionId },
      data: { inactivityExpiresAt: new Date(Date.now() - 5000) },
    });

    const meRes = await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${accessToken}`);
    expect(meRes.status).toBe(401);

    const extRes = await request(app)
      .post('/api/v1/auth/session/extend')
      .set('Authorization', `Bearer ${accessToken}`)
      .set('X-Requested-With', 'XMLHttpRequest');
    expect(extRes.status).toBe(401);

    const refRes = await request(app)
      .post('/api/v1/auth/refresh')
      .set('X-Requested-With', 'XMLHttpRequest')
      .send({ refreshToken });
    expect(refRes.status).toBe(401);
  });

  it('3. Enforces absolute lifetime cap and administrator revocation without affecting other users', async () => {
    const uLogin = await request(app).post('/api/v1/auth/login').send({
      usernameOrEmail: userName,
      password,
    });
    const oLogin = await request(app).post('/api/v1/auth/login').send({
      usernameOrEmail: otherName,
      password,
    });

    const uToken = uLogin.body.data.accessToken as string;
    const oToken = oLogin.body.data.accessToken as string;

    const uStatus = await request(app)
      .get('/api/v1/auth/session')
      .set('Authorization', `Bearer ${uToken}`);
    const uSessionId = uStatus.body.data.sessionId as string;

    // AUDITOR can read user sessions but cannot revoke
    const audList = await request(app)
      .get(`/api/v1/admin/users/${userId}/sessions`)
      .set('Authorization', `Bearer ${auditorToken}`);
    expect(audList.status).toBe(200);

    const audRevoke = await request(app)
      .post(`/api/v1/admin/sessions/${uSessionId}/revoke`)
      .set('Authorization', `Bearer ${auditorToken}`)
      .set('X-Requested-With', 'XMLHttpRequest');
    expect(audRevoke.status).toBe(403);

    // ADMIN revokes user's session
    const admRevoke = await request(app)
      .post(`/api/v1/admin/sessions/${uSessionId}/revoke`)
      .set('Authorization', `Bearer ${adminToken}`)
      .set('X-Requested-With', 'XMLHttpRequest')
      .send({ reason: 'Security review' });
    expect(admRevoke.status).toBe(200);

    // Revoked user's access token is immediately rejected
    const uMeAfter = await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${uToken}`);
    expect(uMeAfter.status).toBe(401);

    // Other user's session remains active
    const oMeAfter = await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${oToken}`);
    expect(oMeAfter.status).toBe(200);

    // Absolute lifetime expiration check
    const u2Login = await request(app).post('/api/v1/auth/login').send({
      usernameOrEmail: userName,
      password,
    });
    const u2Token = u2Login.body.data.accessToken as string;
    const u2Status = await request(app)
      .get('/api/v1/auth/session')
      .set('Authorization', `Bearer ${u2Token}`);
    await prisma.userSession.update({
      where: { id: u2Status.body.data.sessionId },
      data: { absoluteExpiresAt: new Date(Date.now() - 1000) },
    });
    const u2Ext = await request(app)
      .post('/api/v1/auth/session/extend')
      .set('Authorization', `Bearer ${u2Token}`)
      .set('X-Requested-With', 'XMLHttpRequest');
    expect(u2Ext.status).toBe(401);
  });
});
