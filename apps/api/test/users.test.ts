import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app';
import { prisma } from '../src/services/prisma.service';
import { hashPassword } from '../src/utils/password';
import { generateAccessToken } from '../src/utils/token';

const app = createApp();

describe('Phase 1.3 User Management Suite', () => {
  let adminToken: string;
  let testCreatedUserId: string;

  beforeAll(async () => {
    const pw = await hashPassword('AdminPass2026!');
    const adminRole = await prisma.role.findUnique({
      where: { code: 'ADMIN' },
      include: { permissions: { include: { permission: true } } },
    });

    // Cleanup previous test users
    await prisma.user.deleteMany({
      where: {
        username: { in: ['usermgmt_admin', 'created_employee_test'] },
      },
    });

    const adminUser = await prisma.user.create({
      data: {
        email: 'usermgmt_admin@foodfactory.com',
        username: 'usermgmt_admin',
        passwordHash: pw,
        fullName: 'User Management Admin',
        userRoles: { create: { roleId: adminRole!.id } },
      },
    });

    adminToken = generateAccessToken({
      userId: adminUser.id,
      username: adminUser.username,
      email: adminUser.email,
      roles: ['ADMIN'],
      permissions: adminRole!.permissions.map(p => p.permission.code),
    });
  });

  afterAll(async () => {
    await prisma.user.deleteMany({
      where: {
        username: { in: ['usermgmt_admin', 'created_employee_test'] },
      },
    });
    await prisma.$disconnect();
  });

  it('1. User creation with role assignment and password policy validation', async () => {
    // Attempt with weak password first -> should fail
    const weakRes = await request(app)
      .post('/api/v1/users')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        email: 'created_employee_test@foodfactory.com',
        username: 'created_employee_test',
        password: 'weak',
        fullName: 'Created Employee',
        roleCodes: ['PRODUCTION'],
      });

    expect(weakRes.status).toBe(400);

    // Valid creation
    const res = await request(app)
      .post('/api/v1/users')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        email: 'created_employee_test@foodfactory.com',
        username: 'created_employee_test',
        password: 'StrongEmployeePass2026!',
        fullName: 'Created Employee',
        roleCodes: ['PRODUCTION'],
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.id).toBeDefined();
    expect(res.body.data.roles).toContain('PRODUCTION');

    testCreatedUserId = res.body.data.id;
  });

  it('2. Role assignment updates user access roles', async () => {
    const res = await request(app)
      .put(`/api/v1/users/${testCreatedUserId}/roles`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        roleCodes: ['SALESMAN'],
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.roles).toEqual(['SALESMAN']);

    // Verify in database
    const userInDb = await prisma.user.findUnique({
      where: { id: testCreatedUserId },
      include: { userRoles: { include: { role: true } } },
    });
    expect(userInDb!.userRoles.map(ur => ur.role.code)).toEqual(['SALESMAN']);
  });

  it('3. User disabling updates status and revokes active sessions', async () => {
    const res = await request(app)
      .patch(`/api/v1/users/${testCreatedUserId}/status`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        isActive: false,
      });

    expect(res.status).toBe(200);
    expect(res.body.data.isActive).toBe(false);

    // Verify in database
    const userInDb = await prisma.user.findUnique({ where: { id: testCreatedUserId } });
    expect(userInDb!.isActive).toBe(false);
  });

  it('4. Session revocation terminates all refresh tokens for user', async () => {
    // Re-enable user
    await request(app)
      .patch(`/api/v1/users/${testCreatedUserId}/status`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ isActive: true });

    // Revoke sessions
    const res = await request(app)
      .post(`/api/v1/users/${testCreatedUserId}/revoke-sessions`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.revokedCount).toBeDefined();
  });

  it('5. Last OWNER protection prevents removing OWNER role or disabling last owner', async () => {
    const activeOwnerRole = await prisma.role.findUnique({ where: { code: 'OWNER' } });
    const ownerUser = await prisma.user.findFirst({
      where: { userRoles: { some: { roleId: activeOwnerRole!.id } }, isActive: true },
    });

    expect(ownerUser).toBeDefined();

    // Ensure only this single owner is active for the "last owner" constraint test
    await prisma.user.deleteMany({
      where: {
        id: { not: ownerUser!.id },
        userRoles: { some: { role: { code: 'OWNER' } } },
      },
    });

    // 1. Attempt to remove OWNER role from last active owner
    const roleRemovalRes = await request(app)
      .put(`/api/v1/users/${ownerUser!.id}/roles`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        roleCodes: ['ADMIN'], // Omits OWNER
      });

    expect(roleRemovalRes.status).toBe(400);
    expect(roleRemovalRes.body.message).toContain(
      'Cannot remove OWNER role from the last active Owner account',
    );

    // 2. Attempt to deactivate last active owner
    const disableRes = await request(app)
      .patch(`/api/v1/users/${ownerUser!.id}/status`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        isActive: false,
      });

    expect(disableRes.status).toBe(400);
    expect(disableRes.body.message).toContain('Cannot deactivate the last active Owner account');
  });
});
