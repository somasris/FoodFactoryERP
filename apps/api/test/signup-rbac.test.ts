import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app';
import { prisma } from '../src/services/prisma.service';
import { hashPassword } from '../src/utils/password';

const app = createApp();

describe('Public Sign Up & Secure RBAC Suite', () => {
  const testPassword = 'SignupSecurePass2026!';
  const createdUserIds: string[] = [];
  let adminToken = '';
  let salesmanToken = '';
  let auditorToken = '';
  let adminUserId = '';
  let salesmanUserId = '';
  let auditorUserId = '';

  const loginAs = async (usernameOrEmail: string, password: string) => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ usernameOrEmail, password });
    expect(res.status).toBe(200);
    return res.body.data.accessToken as string;
  };

  beforeAll(async () => {
    const testUsernames = ['signup_test_admin', 'signup_test_salesman', 'signup_test_auditor'];
    const testEmails = [
      'signup_test_admin@foodfactory.com',
      'signup_test_salesman@foodfactory.com',
      'signup_test_auditor@foodfactory.com',
      'pending.applicant@foodfactory.com',
      'rejected.applicant@foodfactory.com',
    ];

    await prisma.user.deleteMany({
      where: {
        OR: [{ username: { in: testUsernames } }, { email: { in: testEmails } }],
      },
    });

    const passwordHash = await hashPassword(testPassword);
    const [adminRole, salesmanRole, auditorRole] = await Promise.all([
      prisma.role.findUniqueOrThrow({ where: { code: 'ADMIN' } }),
      prisma.role.findUniqueOrThrow({ where: { code: 'SALESMAN' } }),
      prisma.role.findUniqueOrThrow({ where: { code: 'AUDITOR' } }),
    ]);

    const adminUser = await prisma.user.create({
      data: {
        email: 'signup_test_admin@foodfactory.com',
        username: 'signup_test_admin',
        fullName: 'Signup Test Admin',
        passwordHash,
        isActive: true,
        registrationStatus: 'APPROVED',
        userRoles: { create: { roleId: adminRole.id } },
      },
    });
    adminUserId = adminUser.id;
    createdUserIds.push(adminUserId);

    const salesmanUser = await prisma.user.create({
      data: {
        email: 'signup_test_salesman@foodfactory.com',
        username: 'signup_test_salesman',
        fullName: 'Signup Test Salesman',
        passwordHash,
        isActive: true,
        registrationStatus: 'APPROVED',
        userRoles: { create: { roleId: salesmanRole.id } },
      },
    });
    salesmanUserId = salesmanUser.id;
    createdUserIds.push(salesmanUserId);

    const auditorUser = await prisma.user.create({
      data: {
        email: 'signup_test_auditor@foodfactory.com',
        username: 'signup_test_auditor',
        fullName: 'Signup Test Auditor',
        passwordHash,
        isActive: true,
        registrationStatus: 'APPROVED',
        userRoles: { create: { roleId: auditorRole.id } },
      },
    });
    auditorUserId = auditorUser.id;
    createdUserIds.push(auditorUserId);

    adminToken = await loginAs('signup_test_admin', testPassword);
    salesmanToken = await loginAs('signup_test_salesman', testPassword);
    auditorToken = await loginAs('signup_test_auditor', testPassword);
  });

  afterAll(async () => {
    if (createdUserIds.length > 0) {
      await prisma.auditLog.deleteMany({
        where: {
          OR: [
            { userId: { in: createdUserIds } },
            { entityId: { in: createdUserIds }, entityType: 'UserRegistration' },
          ],
        },
      });
      await prisma.user.deleteMany({
        where: { id: { in: createdUserIds } },
      });
    }
    await prisma.$disconnect();
  });

  it('1. Registers a new user as inactive PENDING_APPROVAL with Argon2id hash, zero roles, and clean audit log', async () => {
    const res = await request(app).post('/api/v1/auth/register').send({
      name: '  Pending Applicant  ',
      email: '  Pending.Applicant@FoodFactory.com  ',
      phoneNumber: '+91 9876543210',
      password: testPassword,
    });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.email).toBe('pending.applicant@foodfactory.com');
    expect(res.body.data.fullName).toBe('Pending Applicant');
    expect(res.body.data.isActive).toBe(false);
    expect(res.body.data.registrationStatus).toBe('PENDING_APPROVAL');
    expect(res.body.data.passwordHash).toBeUndefined();
    expect(res.body.data.accessToken).toBeUndefined();
    expect(res.body.data.refreshToken).toBeUndefined();

    const userId = res.body.data.id as string;
    createdUserIds.push(userId);

    const dbUser = await prisma.user.findUnique({
      where: { id: userId },
      include: { userRoles: true, warehouseAccess: true },
    });
    expect(dbUser).not.toBeNull();
    expect(dbUser!.passwordHash).toMatch(/^\$argon2id\$/);
    expect(dbUser!.isActive).toBe(false);
    expect(dbUser!.registrationStatus).toBe('PENDING_APPROVAL');
    expect(dbUser!.userRoles).toHaveLength(0);
    expect(dbUser!.warehouseAccess).toHaveLength(0);

    const audit = await prisma.auditLog.findFirst({
      where: { entityType: 'UserRegistration', entityId: userId, action: 'CREATE' },
    });
    expect(audit).not.toBeNull();
    expect(JSON.stringify(audit)).not.toContain(testPassword);
    expect(JSON.stringify(audit)).not.toContain(dbUser!.passwordHash);
  });

  it('2. Rejects duplicate email registration (case-insensitive) with 409', async () => {
    const res = await request(app).post('/api/v1/auth/register').send({
      name: 'Duplicate User',
      email: 'PENDING.APPLICANT@FOODFACTORY.COM',
      password: testPassword,
    });

    expect(res.status).toBe(409);
  });

  it('3. Rejects invalid email, weak password, and mass-assignment role/status tampering', async () => {
    const invalidEmailRes = await request(app).post('/api/v1/auth/register').send({
      name: 'Bad Email',
      email: 'not-an-email',
      password: testPassword,
    });
    expect(invalidEmailRes.status).toBe(400);

    const weakPwdRes = await request(app).post('/api/v1/auth/register').send({
      name: 'Weak Pwd',
      email: 'weak.pwd@foodfactory.com',
      password: 'password123',
    });
    expect(weakPwdRes.status).toBe(400);

    const tamperedRoleRes = await request(app).post('/api/v1/auth/register').send({
      name: 'Tamper Role',
      email: 'tamper.role@foodfactory.com',
      password: testPassword,
      role: 'OWNER',
      isActive: true,
      registrationStatus: 'APPROVED',
    });
    expect(tamperedRoleRes.status).toBe(400);
  });

  it('4. Blocks pending user from signing in until approved', async () => {
    const loginRes = await request(app).post('/api/v1/auth/login').send({
      usernameOrEmail: 'pending.applicant@foodfactory.com',
      password: testPassword,
    });

    expect(loginRes.status).toBe(403);
    expect(loginRes.body.message).toMatch(/pending administrator approval/i);
  });

  it('5. Enforces RBAC on registration approval and blocks ADMIN from assigning OWNER', async () => {
    const pendingUser = await prisma.user.findUniqueOrThrow({
      where: { email: 'pending.applicant@foodfactory.com' },
    });

    // SALESMAN cannot approve
    const salesmanRes = await request(app)
      .post(`/api/v1/admin/users/${pendingUser.id}/review-registration`)
      .set('Authorization', `Bearer ${salesmanToken}`)
      .send({ decision: 'APPROVED', roleCodes: ['SALESMAN'] });
    expect(salesmanRes.status).toBe(403);

    // AUDITOR cannot approve (strictly read-only)
    const auditorRes = await request(app)
      .post(`/api/v1/admin/users/${pendingUser.id}/review-registration`)
      .set('Authorization', `Bearer ${auditorToken}`)
      .send({ decision: 'APPROVED', roleCodes: ['SALESMAN'] });
    expect(auditorRes.status).toBe(403);

    // ADMIN cannot escalate to OWNER
    const ownerEscalateRes = await request(app)
      .post(`/api/v1/admin/users/${pendingUser.id}/review-registration`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ decision: 'APPROVED', roleCodes: ['OWNER'] });
    expect(ownerEscalateRes.status).toBe(403);
  });

  it('6. Allows ADMIN to approve pending user with SALESMAN role, enabling login with restricted access', async () => {
    const pendingUser = await prisma.user.findUniqueOrThrow({
      where: { email: 'pending.applicant@foodfactory.com' },
    });

    const approveRes = await request(app)
      .post(`/api/v1/admin/users/${pendingUser.id}/review-registration`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ decision: 'APPROVED', roleCodes: ['SALESMAN'], reason: 'Verified employee' });

    expect(approveRes.status).toBe(200);
    expect(approveRes.body.data.registrationStatus).toBe('APPROVED');
    expect(approveRes.body.data.isActive).toBe(true);
    expect(approveRes.body.data.roles).toEqual(['SALESMAN']);

    const audit = await prisma.auditLog.findFirst({
      where: { entityType: 'UserRegistration', entityId: pendingUser.id, action: 'APPROVE' },
    });
    expect(audit).not.toBeNull();

    // Now approved user can log in
    const approvedToken = await loginAs('pending.applicant@foodfactory.com', testPassword);
    expect(approvedToken).toBeTruthy();

    // Approved SALESMAN still cannot access admin users list
    const adminListRes = await request(app)
      .get('/api/v1/admin/users')
      .set('Authorization', `Bearer ${approvedToken}`);
    expect(adminListRes.status).toBe(403);
  });

  it('7. Allows ADMIN to reject a pending registration and keeps account locked', async () => {
    const regRes = await request(app).post('/api/v1/auth/register').send({
      name: 'Rejected Applicant',
      email: 'rejected.applicant@foodfactory.com',
      password: testPassword,
    });
    expect(regRes.status).toBe(201);
    const rejectedId = regRes.body.data.id as string;
    createdUserIds.push(rejectedId);

    const rejectRes = await request(app)
      .post(`/api/v1/admin/users/${rejectedId}/review-registration`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ decision: 'REJECTED', reason: 'Unrecognized applicant' });
    expect(rejectRes.status).toBe(200);
    expect(rejectRes.body.data.registrationStatus).toBe('REJECTED');
    expect(rejectRes.body.data.isActive).toBe(false);

    const loginRes = await request(app).post('/api/v1/auth/login').send({
      usernameOrEmail: 'rejected.applicant@foodfactory.com',
      password: testPassword,
    });
    expect(loginRes.status).toBe(403);
    expect(loginRes.body.message).toMatch(/rejected/i);
  });

  it('8. Rate limits excessive registration attempts with 429', async () => {
    let hit429 = false;
    for (let i = 0; i < 12; i++) {
      const res = await request(app)
        .post('/api/v1/auth/register')
        .set('x-enable-rate-limit-test', 'true')
        .send({
          name: 'Rate Limit Probe',
          email: 'invalid-email',
          password: 'short',
        });
      if (res.status === 429) {
        hit429 = true;
        break;
      }
    }
    expect(hit429).toBe(true);
  });
});
