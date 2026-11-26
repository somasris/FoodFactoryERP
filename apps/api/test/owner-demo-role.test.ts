import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app';
import { prisma } from '../src/services/prisma.service';
import { getDemoAccounts } from '../src/config/demo-accounts';

const app = createApp();
const CSRF = { 'X-Requested-With': 'XMLHttpRequest' };

describe('OWNER Demo Role Assignment & Login Regression Suite', () => {
  const demoEmail = (process.env.DEMO_OWNER_EMAIL || 'demo.owner@foodfactory.local').toLowerCase();
  const demoPassword = process.env.DEMO_DEFAULT_PASSWORD || 'DemoFactory2026!';

  beforeAll(async () => {
    // Ensure OWNER role is active and demo_owner has OWNER assignment
    const ownerRole = await prisma.role.findUnique({ where: { code: 'OWNER' } });
    expect(ownerRole).not.toBeNull();
    expect(ownerRole!.isActive).toBe(true);
  });

  it('1. OWNER demo user exists, is active/approved, and has an active OWNER UserRole assignment', async () => {
    const ownerUser = await prisma.user.findUnique({
      where: { email: demoEmail },
      include: { userRoles: { include: { role: true } } },
    });

    expect(ownerUser).not.toBeNull();
    expect(ownerUser!.isActive).toBe(true);
    expect(ownerUser!.registrationStatus).toBe('APPROVED');
    expect(ownerUser!.userRoles.some(ur => ur.role.code === 'OWNER' && ur.role.isActive)).toBe(true);
  });

  it('2. OWNER demo login succeeds, resolves OWNER role & permissions from DB, and accesses protected endpoints', async () => {
    const loginRes = await request(app)
      .post('/api/v1/auth/login')
      .set(CSRF)
      .send({ usernameOrEmail: demoEmail, password: demoPassword });

    expect(loginRes.status).toBe(200);
    expect(loginRes.body.data.user.roles).toContain('OWNER');
    const accessToken = loginRes.body.data.accessToken as string;
    expect(accessToken).toBeTruthy();

    const meRes = await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${accessToken}`);
    expect(meRes.status).toBe(200);
    expect(meRes.body.data.roles).toContain('OWNER');

    // Authorized OWNER endpoint (Executive Dashboard / Admin / Governance)
    const execRes = await request(app)
      .get('/api/v1/reports/executive-dashboard')
      .set('Authorization', `Bearer ${accessToken}`);
    expect(execRes.status).toBe(200);
  });

  it('3. Login fails with 403 when an account has no active role assignment (and never bypasses validation)', async () => {
    const tempEmail = `no_role_check_${Date.now()}@test.local`;
    const pwRes = await import('../src/utils/password');
    const hash = await pwRes.hashPassword('TempPass!2026');

    const tempUser = await prisma.user.create({
      data: {
        email: tempEmail,
        username: `no_role_${Date.now()}`,
        passwordHash: hash,
        fullName: 'No Role User',
        isActive: true,
        registrationStatus: 'APPROVED',
      },
    });

    try {
      const res = await request(app)
        .post('/api/v1/auth/login')
        .set(CSRF)
        .send({ usernameOrEmail: tempEmail, password: 'TempPass!2026' });

      expect(res.status).toBe(403);
      expect(res.body.message).toMatch(/does not have an active role assigned/i);
    } finally {
      await prisma.user.delete({ where: { id: tempUser.id } });
    }
  });

  it('4. Inactive OWNER role is not silently accepted', async () => {
    const ownerRole = await prisma.role.findUniqueOrThrow({ where: { code: 'OWNER' } });
    await prisma.role.update({ where: { id: ownerRole.id }, data: { isActive: false } });

    try {
      const res = await request(app)
        .post('/api/v1/auth/login')
        .set(CSRF)
        .send({ usernameOrEmail: demoEmail, password: demoPassword });

      expect(res.status).toBe(403);
      expect(res.body.message).toMatch(/does not have an active role assigned/i);
    } finally {
      await prisma.role.update({ where: { id: ownerRole.id }, data: { isActive: true } });
    }
  });

  it('5. All other demo accounts (ADMIN, SALESMAN, PRODUCTION, AUDITOR) login cleanly without OWNER escalation', async () => {
    // Check directly against configured demo emails
    const rolesToCheck = [
      { role: 'ADMIN', email: process.env.DEMO_ADMIN_EMAIL || 'demo.admin@foodfactory.local' },
      { role: 'SALESMAN', email: process.env.DEMO_SALESMAN_EMAIL || 'demo.salesman@foodfactory.local' },
      { role: 'PRODUCTION', email: process.env.DEMO_PRODUCTION_EMAIL || 'demo.production@foodfactory.local' },
      { role: 'AUDITOR', email: process.env.DEMO_AUDITOR_EMAIL || 'demo.auditor@foodfactory.local' },
    ];

    // Confirm getDemoAccounts returns empty in production-like check or configured list
    expect(Array.isArray(getDemoAccounts())).toBe(true);

    for (const acc of rolesToCheck) {
      const res = await request(app)
        .post('/api/v1/auth/login')
        .set(CSRF)
        .send({ usernameOrEmail: acc.email, password: demoPassword });

      expect(res.status).toBe(200);
      expect(res.body.data.user.roles).toContain(acc.role);
      expect(res.body.data.user.roles).not.toContain('OWNER');
    }
  });
});
