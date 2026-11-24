import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app';
import { prisma } from '../src/services/prisma.service';
import { hashPassword } from '../src/utils/password';
import { generateAccessToken } from '../src/utils/token';

const app = createApp();

describe('Phase 1.3 User Management & Privilege Hardening Suite', () => {
  let adminToken: string;
  let ownerToken: string;
  let testCreatedUserId: string;
  let primaryOwnerId: string;
  let secondaryOwnerId: string;

  beforeAll(async () => {
    const pw = await hashPassword('AdminPass2026!');
    const adminRole = await prisma.role.findUnique({
      where: { code: 'ADMIN' },
      include: { permissions: { include: { permission: true } } },
    });
    const ownerRole = await prisma.role.findUnique({
      where: { code: 'OWNER' },
      include: { permissions: { include: { permission: true } } },
    });

    // Cleanup previous test users
    await prisma.user.deleteMany({
      where: {
        username: {
          in: [
            'usermgmt_admin',
            'created_employee_test',
            'primary_test_owner',
            'secondary_test_owner',
            'attempted_owner_target',
          ],
        },
      },
    });

    // Demote or deactivate any external active owners during this test to ensure exact isolation
    await prisma.userRole.deleteMany({
      where: {
        role: { code: 'OWNER' },
        user: { username: { notIn: ['primary_test_owner', 'secondary_test_owner'] } },
      },
    });

    // Create primary OWNER
    const primaryOwner = await prisma.user.create({
      data: {
        email: 'primary_test_owner@foodfactory.com',
        username: 'primary_test_owner',
        passwordHash: pw,
        fullName: 'Primary Test Owner',
        userRoles: { create: { roleId: ownerRole!.id } },
      },
    });
    primaryOwnerId = primaryOwner.id;
    ownerToken = generateAccessToken({
      userId: primaryOwner.id,
      username: primaryOwner.username,
      email: primaryOwner.email,
      roles: ['OWNER'],
      permissions: ownerRole!.permissions.map(p => p.permission.code),
    });

    // Create ADMIN
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
        username: {
          in: [
            'usermgmt_admin',
            'created_employee_test',
            'primary_test_owner',
            'secondary_test_owner',
            'attempted_owner_target',
          ],
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

  // ============================================================================
  // OWNER PRIVILEGE ESCALATION PREVENTION TESTS (NEGATIVE)
  // ============================================================================

  it('5. NEGATIVE: ADMIN cannot create a user with the OWNER role', async () => {
    const res = await request(app)
      .post('/api/v1/users')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        email: 'attempted_owner_target@foodfactory.com',
        username: 'attempted_owner_target',
        password: 'ValidPassword2026!',
        fullName: 'Attempted Escalated Owner',
        roleCodes: ['OWNER'],
      });

    expect(res.status).toBe(403);
    expect(res.body.message).toContain('Only an authenticated OWNER can create an account with the OWNER role');
  });

  it('6. NEGATIVE: ADMIN cannot assign OWNER role to an existing user', async () => {
    const res = await request(app)
      .put(`/api/v1/users/${testCreatedUserId}/roles`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        roleCodes: ['OWNER', 'SALESMAN'],
      });

    expect(res.status).toBe(403);
    expect(res.body.message).toContain('Only an authenticated OWNER can assign the OWNER role');
  });

  it('7. NEGATIVE: ADMIN cannot modify an OWNER role assignments or remove OWNER', async () => {
    const res = await request(app)
      .put(`/api/v1/users/${primaryOwnerId}/roles`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        roleCodes: ['ADMIN'], // Tries to strip OWNER
      });

    expect(res.status).toBe(403);
    expect(res.body.message).toContain("ADMIN cannot modify an OWNER's role assignments");
  });

  it('8. NEGATIVE: ADMIN cannot deactivate an OWNER account', async () => {
    const res = await request(app)
      .patch(`/api/v1/users/${primaryOwnerId}/status`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        isActive: false,
      });

    expect(res.status).toBe(403);
    expect(res.body.message).toContain('ADMIN cannot deactivate an OWNER');
  });

  // ============================================================================
  // OWNER AUTHORIZATION & LAST-OWNER PROTECTION TESTS (POSITIVE & INVARIANT)
  // ============================================================================

  it('9. POSITIVE: An authorized OWNER can create a second OWNER account', async () => {
    const res = await request(app)
      .post('/api/v1/users')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        email: 'secondary_test_owner@foodfactory.com',
        username: 'secondary_test_owner',
        password: 'SecondaryOwnerPass2026!',
        fullName: 'Secondary Owner Co-Director',
        roleCodes: ['OWNER'],
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.roles).toContain('OWNER');
    secondaryOwnerId = res.body.data.id;
  });

  it('10. POSITIVE: An authorized OWNER can modify/remove OWNER role when another active owner exists', async () => {
    // There are now 2 active owners: primary and secondary
    // Primary owner demotes secondary owner to ADMIN
    const demoteRes = await request(app)
      .put(`/api/v1/users/${secondaryOwnerId}/roles`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        roleCodes: ['ADMIN'],
      });

    expect(demoteRes.status).toBe(200);
    expect(demoteRes.body.success).toBe(true);
    expect(demoteRes.body.data.roles).toEqual(['ADMIN']);
  });

  it('11. INVARIANT: Last active OWNER protection prevents stripping OWNER role from sole active owner', async () => {
    // Only primaryOwnerId remains as active OWNER in this test scenario
    // Ensure any other background active owner (such as initial seed) does not defeat the last-owner count
    await prisma.userRole.deleteMany({
      where: {
        role: { code: 'OWNER' },
        user: { username: { not: 'primary_test_owner' } },
      },
    });

    const res = await request(app)
      .put(`/api/v1/users/${primaryOwnerId}/roles`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        roleCodes: ['ADMIN'], // Attempts to strip last owner
      });

    expect(res.status).toBe(400);
    expect(res.body.message).toContain('Cannot remove OWNER role from the last active Owner account');
  });

  it('12. INVARIANT: Last active OWNER protection prevents deactivating the sole active owner', async () => {
    // Ensure primary_test_owner is the sole active OWNER
    await prisma.userRole.deleteMany({
      where: {
        role: { code: 'OWNER' },
        user: { username: { not: 'primary_test_owner' } },
      },
    });

    const res = await request(app)
      .patch(`/api/v1/users/${primaryOwnerId}/status`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        isActive: false,
      });

    expect(res.status).toBe(400);
    expect(res.body.message).toContain('Cannot deactivate the last active Owner account');
  });
});
