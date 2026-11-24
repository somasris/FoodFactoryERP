import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app';
import { prisma } from '../src/services/prisma.service';
import { hashPassword } from '../src/utils/password';
import { generateAccessToken } from '../src/utils/token';

const app = createApp();

describe('Phase 1.3 Role-Based Access Control (RBAC) Suite', () => {
  let ownerToken: string;
  let adminToken: string;
  let salesmanToken: string;
  let auditorToken: string;
  let productionToken: string;
  let warehouseRMId: string;
  let warehouseFGId: string;
  let testSalesmanUserId: string;
  let ownerUserId: string;

  beforeAll(async () => {
    // Look up warehouse facilities
    const whRM = await prisma.warehouse.findUnique({ where: { code: 'WH-RM-01' } });
    const whFG = await prisma.warehouse.findUnique({ where: { code: 'WH-FG-01' } });
    warehouseRMId = whRM!.id;
    warehouseFGId = whFG!.id;

    const pw = await hashPassword('RbacPassword2026!');

    // Clean up test users
    await prisma.user.deleteMany({
      where: {
        username: {
          in: ['rbac_owner', 'rbac_admin', 'rbac_salesman', 'rbac_auditor', 'rbac_production'],
        },
      },
    });

    const roles = await prisma.role.findMany({
      include: {
        permissions: { include: { permission: true } },
      },
    });

    const getRole = (code: string) => roles.find(r => r.code === code)!;

    // Create OWNER
    const uOwner = await prisma.user.create({
      data: {
        email: 'rbac_owner@foodfactory.com',
        username: 'rbac_owner',
        passwordHash: pw,
        fullName: 'RBAC Owner',
        userRoles: { create: { roleId: getRole('OWNER').id } },
      },
    });
    ownerUserId = uOwner.id;
    ownerToken = generateAccessToken({
      userId: uOwner.id,
      username: uOwner.username,
      email: uOwner.email,
      roles: ['OWNER'],
      permissions: roles.flatMap(r => r.permissions.map(p => p.permission.code)),
    });

    // Create ADMIN
    const uAdmin = await prisma.user.create({
      data: {
        email: 'rbac_admin@foodfactory.com',
        username: 'rbac_admin',
        passwordHash: pw,
        fullName: 'RBAC Admin',
        userRoles: { create: { roleId: getRole('ADMIN').id } },
      },
    });
    adminToken = generateAccessToken({
      userId: uAdmin.id,
      username: uAdmin.username,
      email: uAdmin.email,
      roles: ['ADMIN'],
      permissions: getRole('ADMIN').permissions.map(p => p.permission.code),
    });

    // Create SALESMAN (Assigned ONLY to WH-FG-01 with READ access)
    const uSalesman = await prisma.user.create({
      data: {
        email: 'rbac_salesman@foodfactory.com',
        username: 'rbac_salesman',
        passwordHash: pw,
        fullName: 'RBAC Salesman',
        userRoles: { create: { roleId: getRole('SALESMAN').id } },
        warehouseAccess: {
          create: {
            warehouseId: warehouseFGId,
            accessLevel: 'READ',
          },
        },
      },
    });
    testSalesmanUserId = uSalesman.id;
    salesmanToken = generateAccessToken({
      userId: uSalesman.id,
      username: uSalesman.username,
      email: uSalesman.email,
      roles: ['SALESMAN'],
      permissions: getRole('SALESMAN').permissions.map(p => p.permission.code),
    });

    // Create AUDITOR
    const uAuditor = await prisma.user.create({
      data: {
        email: 'rbac_auditor@foodfactory.com',
        username: 'rbac_auditor',
        passwordHash: pw,
        fullName: 'RBAC Auditor',
        userRoles: { create: { roleId: getRole('AUDITOR').id } },
      },
    });
    auditorToken = generateAccessToken({
      userId: uAuditor.id,
      username: uAuditor.username,
      email: uAuditor.email,
      roles: ['AUDITOR'],
      permissions: getRole('AUDITOR').permissions.map(p => p.permission.code),
    });

    // Create PRODUCTION
    const uProduction = await prisma.user.create({
      data: {
        email: 'rbac_production@foodfactory.com',
        username: 'rbac_production',
        passwordHash: pw,
        fullName: 'RBAC Production',
        userRoles: { create: { roleId: getRole('PRODUCTION').id } },
      },
    });
    productionToken = generateAccessToken({
      userId: uProduction.id,
      username: uProduction.username,
      email: uProduction.email,
      roles: ['PRODUCTION'],
      permissions: getRole('PRODUCTION').permissions.map(p => p.permission.code),
    });
  });

  afterAll(async () => {
    await prisma.user.deleteMany({
      where: {
        username: {
          in: ['rbac_owner', 'rbac_admin', 'rbac_salesman', 'rbac_auditor', 'rbac_production'],
        },
      },
    });

    // Ensure initial seeded owner retains OWNER role
    const seedOwner = await prisma.user.findFirst({ where: { username: 'owner' } });
    const ownerRole = await prisma.role.findUnique({ where: { code: 'OWNER' } });
    if (seedOwner && ownerRole) {
      await prisma.user.update({ where: { id: seedOwner.id }, data: { isActive: true } });
      await prisma.userRole.upsert({
        where: { userId_roleId: { userId: seedOwner.id, roleId: ownerRole.id } },
        update: {},
        create: { userId: seedOwner.id, roleId: ownerRole.id },
      });
    }

    await prisma.$disconnect();
  });

  it('1. Unauthenticated request is rejected with 401', async () => {
    const res = await request(app).get('/api/v1/users');
    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  it('2. Unauthorized role without required permission is rejected with 403', async () => {
    // SALESMAN does not have 'users.read' permission
    const res = await request(app)
      .get('/api/v1/users')
      .set('Authorization', `Bearer ${salesmanToken}`);

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toContain('Missing required permission');
  });

  it('3. Missing permission is rejected with 403', async () => {
    // PRODUCTION does not have 'users.create'
    const res = await request(app)
      .post('/api/v1/users')
      .set('Authorization', `Bearer ${productionToken}`)
      .send({
        email: 'forbidden@test.com',
        username: 'forbidden',
        password: 'ValidPassword123!',
        fullName: 'Forbidden Test',
        roleCodes: ['SALESMAN'],
      });

    expect(res.status).toBe(403);
  });

  it('4. Authorized permission is accepted with 200/201', async () => {
    // ADMIN has 'users.read'
    const res = await request(app)
      .get('/api/v1/users')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it('5. AUDITOR write operation is rejected with 403 (strictly read-only)', async () => {
    const res = await request(app)
      .post('/api/v1/users')
      .set('Authorization', `Bearer ${auditorToken}`)
      .send({
        email: 'auditor_write_fail@test.com',
        username: 'auditor_write_fail',
        password: 'ValidPassword123!',
        fullName: 'Auditor Attempt',
        roleCodes: ['SALESMAN'],
      });

    expect(res.status).toBe(403);
    expect(res.body.message).toContain('AUDITOR role is restricted to read-only operations');
  });

  it('6. SALESMAN administrative operation is rejected with 403', async () => {
    const res = await request(app)
      .post(`/api/v1/users/${testSalesmanUserId}/revoke-sessions`)
      .set('Authorization', `Bearer ${salesmanToken}`);

    expect(res.status).toBe(403);
  });

  it('7. ADMIN cannot disable an OWNER account and last OWNER cannot be deactivated', async () => {
    // 1. ADMIN attempt is rejected with 403 (ADMIN cannot modify/deactivate an OWNER)
    const adminAttemptRes = await request(app)
      .patch(`/api/v1/users/${ownerUserId}/status`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ isActive: false });

    expect(adminAttemptRes.status).toBe(403);
    expect(adminAttemptRes.body.message).toContain('ADMIN cannot deactivate an OWNER');

    // 2. OWNER attempt on the last active OWNER is rejected with 400 (last owner invariant)
    // First, temporarily remove any other active owners so that rbac_owner is the sole active owner
    await prisma.userRole.deleteMany({
      where: {
        role: { code: 'OWNER' },
        user: { id: { not: ownerUserId } },
      },
    });

    const ownerAttemptRes = await request(app)
      .patch(`/api/v1/users/${ownerUserId}/status`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ isActive: false });

    expect(ownerAttemptRes.status).toBe(400);
    expect(ownerAttemptRes.body.message).toContain('Cannot deactivate the last active Owner account');
  });

  it('8. OWNER authorized operation is accepted globally', async () => {
    // OWNER can view users and perform actions
    const res = await request(app)
      .get('/api/v1/users')
      .set('Authorization', `Bearer ${ownerToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('9. Warehouse access restrictions are enforced', async () => {
    // Verify physical warehouse scoping logic directly through middleware
    const { requireWarehouseAccess } = await import('../src/middleware/auth.middleware');
    const { Request, Response } = await import('express');

    const checkWarehouse = (user: any, warehouseId: string, level: 'READ' | 'READ_WRITE') => {
      return new Promise<void>((resolve, reject) => {
        const req: any = { user, params: { warehouseId } };
        const res: any = {};
        const next = (err?: any) => (err ? reject(err) : resolve());
        requireWarehouseAccess('warehouseId', level)(req, res, next);
      });
    };

    // SALESMAN has access ONLY to WH-FG-01 (READ)
    const salesmanUser = {
      userId: testSalesmanUserId,
      roles: ['SALESMAN'],
      permissions: ['inventory.read'],
    };

    // Should succeed for WH-FG-01 READ
    await expect(checkWarehouse(salesmanUser, warehouseFGId, 'READ')).resolves.toBeUndefined();

    // Should FAIL for WH-RM-01 (not assigned)
    await expect(checkWarehouse(salesmanUser, warehouseRMId, 'READ')).rejects.toThrow(
      'not authorized for this warehouse facility',
    );

    // Should FAIL for WH-FG-01 READ_WRITE (has only READ access)
    await expect(checkWarehouse(salesmanUser, warehouseFGId, 'READ_WRITE')).rejects.toThrow(
      'read-only access to this warehouse facility',
    );
  });
});
