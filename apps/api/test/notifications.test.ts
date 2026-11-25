import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import http from 'http';
import { NotificationCategory, NotificationPriority, NotificationType } from '@prisma/client';
import { createApp } from '../src/app';
import { prisma } from '../src/services/prisma.service';
import { hashPassword } from '../src/utils/password';
import { generateAccessToken } from '../src/utils/token';
import { NotificationService, sanitizeMetadata } from '../src/modules/notifications/notification.service';
import { NotificationEventsService } from '../src/modules/notifications/notification-events.service';

const app = createApp();

describe('Enterprise Notification System API & Integration Suite', () => {
  let adminUser: { id: string; username: string };
  let salesmanUser: { id: string; username: string };
  let productionUser: { id: string; username: string };
  let adminToken: string;
  let salesmanToken: string;
  let productionToken: string;
  let warehouseId: string;
  const createdNotificationIds: string[] = [];

  async function buildUser(username: string, roleCode: string) {
    const pw = await hashPassword('NotifPass!2026');
    const role = await prisma.role.findUnique({
      where: { code: roleCode },
      include: { permissions: { include: { permission: true } } },
    });
    if (!role) throw new Error(`Role ${roleCode} not found`);

    const user = await prisma.user.upsert({
      where: { username },
      update: { passwordHash: pw, isActive: true, registrationStatus: 'APPROVED' },
      create: {
        email: `${username}@foodfactory.com`,
        username,
        passwordHash: pw,
        fullName: `Notif ${roleCode}`,
        isActive: true,
        registrationStatus: 'APPROVED',
        userRoles: { create: { roleId: role.id } },
      },
    });

    const token = generateAccessToken({
      userId: user.id,
      username: user.username,
      email: user.email,
      roles: [roleCode],
      permissions: role.permissions.map(p => p.permission.code),
    });

    return { user, token };
  }

  beforeAll(async () => {
    const a = await buildUser('notif_admin', 'ADMIN');
    const s = await buildUser('notif_salesman', 'SALESMAN');
    const p = await buildUser('notif_production', 'PRODUCTION');
    adminUser = a.user;
    salesmanUser = s.user;
    productionUser = p.user;
    adminToken = a.token;
    salesmanToken = s.token;
    productionToken = p.token;

    const wh = await prisma.warehouse.findFirst({ where: { isActive: true } });
    if (!wh) throw new Error('No active warehouse in DB');
    warehouseId = wh.id;

    // Grant salesman access to warehouseId, revoke from productionUser to test scope isolation
    await prisma.userWarehouseAccess.upsert({
      where: { userId_warehouseId: { userId: salesmanUser.id, warehouseId } },
      update: { accessLevel: 'READ_WRITE' },
      create: { userId: salesmanUser.id, warehouseId, accessLevel: 'READ_WRITE' },
    });
    await prisma.userWarehouseAccess.deleteMany({
      where: { userId: productionUser.id, warehouseId },
    });
  });

  afterAll(async () => {
    if (createdNotificationIds.length > 0) {
      await prisma.notification.deleteMany({ where: { id: { in: createdNotificationIds } } });
    }
    await prisma.notificationPreference.deleteMany({
      where: { userId: { in: [adminUser.id, salesmanUser.id, productionUser.id] } },
    });
    await prisma.notificationAlertState.deleteMany({
      where: { alertKey: { startsWith: 'TEST_ALERT:' } },
    });
  });

  it('1. Rejects unauthenticated requests to notification endpoints and SSE stream', async () => {
    const res1 = await request(app).get('/api/v1/notifications');
    expect(res1.status).toBe(401);

    const res2 = await request(app).get('/api/v1/notifications/unread-count');
    expect(res2.status).toBe(401);

    const res3 = await request(app).get('/api/v1/notifications/stream');
    expect(res3.status).toBe(401);
  });

  it('2. Redacts sensitive keys in metadata', () => {
    const cleaned = sanitizeMetadata({
      orderNumber: 'SO-100',
      password: 'secret-password',
      nested: { accessToken: 'tok-123', safeField: 'ok' },
    });
    expect(cleaned).toEqual({
      orderNumber: 'SO-100',
      password: '[REDACTED]',
      nested: { accessToken: '[REDACTED]', safeField: 'ok' },
    });
  });

  it('3. Creates multi-recipient notifications, prevents duplicate eventKey delivery, and enforces user isolation', async () => {
    const eventKey = `test.multi:${Date.now()}`;
    const first = await NotificationService.notify({
      title: 'Test Order Approved',
      message: 'Sales order SO-999 approved.',
      type: NotificationType.SUCCESS,
      category: NotificationCategory.SALES,
      priority: NotificationPriority.HIGH,
      eventKey,
      entityType: 'SalesOrder',
      entityId: 'so-999',
      actionUrl: '/sales/orders/so-999',
      target: { userIds: [salesmanUser.id, adminUser.id] },
    });

    expect(first).not.toBeNull();
    expect(first!.recipientCount).toBe(2);
    createdNotificationIds.push(first!.notificationId);

    // Duplicate eventKey for same recipients must not create duplicate UserNotification rows
    const duplicate = await NotificationService.notify({
      title: 'Test Order Approved',
      message: 'Duplicate attempt.',
      category: NotificationCategory.SALES,
      eventKey,
      target: { userIds: [salesmanUser.id, adminUser.id] },
    });
    expect(duplicate).toBeNull();

    // Salesman sees their notification
    const listRes = await request(app)
      .get('/api/v1/notifications?category=SALES&priority=HIGH')
      .set('Authorization', `Bearer ${salesmanToken}`);
    expect(listRes.status).toBe(200);
    const found = listRes.body.data.items.find(
      (i: { notificationId: string }) => i.notificationId === first!.notificationId,
    );
    expect(found).toBeDefined();
    expect(found.isRead).toBe(false);

    // Production user cannot read or mark salesman's notification as read (404)
    const crossRead = await request(app)
      .get(`/api/v1/notifications/${found.id}`)
      .set('Authorization', `Bearer ${productionToken}`);
    expect(crossRead.status).toBe(404);

    const crossPatch = await request(app)
      .patch(`/api/v1/notifications/${found.id}/read`)
      .set('Authorization', `Bearer ${productionToken}`);
    expect(crossPatch.status).toBe(404);

    // Salesman marks their notification as read
    const markRes = await request(app)
      .patch(`/api/v1/notifications/${found.id}/read`)
      .set('Authorization', `Bearer ${salesmanToken}`);
    expect(markRes.status).toBe(200);
    expect(markRes.body.data.isRead).toBe(true);

    // Salesman archives their notification
    const archiveRes = await request(app)
      .patch(`/api/v1/notifications/${found.id}/archive`)
      .set('Authorization', `Bearer ${salesmanToken}`);
    expect(archiveRes.status).toBe(200);
    expect(archiveRes.body.data.isArchived).toBe(true);
  });

  it('4. Enforces warehouse scope on recipient resolution', async () => {
    const eventKey = `test.wh_scope:${Date.now()}`;
    const res = await NotificationService.notify({
      title: 'Warehouse Scoped Event',
      message: 'Stock update in warehouse.',
      category: NotificationCategory.INVENTORY,
      eventKey,
      target: {
        userIds: [salesmanUser.id, productionUser.id],
        warehouseId,
      },
    });

    expect(res).not.toBeNull();
    // Only salesmanUser has access to warehouseId; productionUser was removed
    expect(res!.recipientCount).toBe(1);
    createdNotificationIds.push(res!.notificationId);
  });

  it('5. Supports notification preferences and suppresses disabled categories', async () => {
    const updateRes = await request(app)
      .patch('/api/v1/notifications/preferences')
      .set('Authorization', `Bearer ${salesmanToken}`)
      .send({
        preferences: [{ category: 'SYSTEM', inAppEnabled: false }],
      });
    expect(updateRes.status).toBe(200);
    const sysPref = updateRes.body.data.find(
      (p: { category: string }) => p.category === 'SYSTEM',
    );
    expect(sysPref.inAppEnabled).toBe(false);

    const suppressed = await NotificationService.notify({
      title: 'Suppressed System Alert',
      message: 'Should not deliver to salesman.',
      category: NotificationCategory.SYSTEM,
      eventKey: `test.pref_suppress:${Date.now()}`,
      target: { userIds: [salesmanUser.id] },
    });
    expect(suppressed).toBeNull();

    // Re-enable
    await request(app)
      .patch('/api/v1/notifications/preferences')
      .set('Authorization', `Bearer ${salesmanToken}`)
      .send({
        preferences: [{ category: 'SYSTEM', inAppEnabled: true }],
      });
  });

  it('6. Deduplicates state alerts while active and re-notifies after resolution', async () => {
    const alertKey = `TEST_ALERT:LOW_STOCK:${Date.now()}`;
    const t1 = await NotificationService.triggerStateAlert(alertKey, {
      title: 'Low Stock',
      message: 'Item below minimum.',
      category: NotificationCategory.INVENTORY,
      priority: NotificationPriority.HIGH,
      target: { userIds: [adminUser.id] },
    });
    expect(t1).toBe(true);

    // Second trigger while active must be suppressed
    const t2 = await NotificationService.triggerStateAlert(alertKey, {
      title: 'Low Stock',
      message: 'Item still below minimum.',
      category: NotificationCategory.INVENTORY,
      priority: NotificationPriority.HIGH,
      target: { userIds: [adminUser.id] },
    });
    expect(t2).toBe(false);

    // Resolve and trigger again -> notifies again
    await NotificationService.resolveStateAlert(alertKey);
    const t3 = await NotificationService.triggerStateAlert(alertKey, {
      title: 'Low Stock Again',
      message: 'Item dropped below minimum again.',
      category: NotificationCategory.INVENTORY,
      priority: NotificationPriority.HIGH,
      target: { userIds: [adminUser.id] },
    });
    expect(t3).toBe(true);
  });

  it('7. Integrates real ERP events (Sales, Quality, Backup Failure) for intended recipients only', async () => {
    const ts = Date.now();
    await NotificationEventsService.onBackupEvent({
      id: `bkp-${ts}`,
      backupName: `backup-${ts}.sql`,
      failed: true,
      failureReason: 'Disk full',
    });

    const adminList = await request(app)
      .get('/api/v1/notifications?category=SYSTEM&priority=CRITICAL')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(adminList.status).toBe(200);
    expect(
      adminList.body.data.items.some((i: { entityId: string }) => i.entityId === `bkp-${ts}`),
    ).toBe(true);

    const salesmanList = await request(app)
      .get('/api/v1/notifications?category=SYSTEM&priority=CRITICAL')
      .set('Authorization', `Bearer ${salesmanToken}`);
    expect(
      salesmanList.body.data.items.some((i: { entityId: string }) => i.entityId === `bkp-${ts}`),
    ).toBe(false);

    await NotificationEventsService.onQualityInspectionEvent({
      id: `qi-${ts}`,
      inspectionNumber: `QI-${ts}`,
      status: 'REJECTED',
      event: 'COMPLETED',
    });
    const qualityList = await request(app)
      .get('/api/v1/notifications?category=QUALITY&priority=CRITICAL')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(
      qualityList.body.data.items.some((i: { entityId: string }) => i.entityId === `qi-${ts}`),
    ).toBe(true);
  });

  it('8. Delivers real-time notifications over authenticated SSE stream', async () => {
    const server = http.createServer(app);
    await new Promise<void>(resolve => server.listen(0, resolve));
    const addr = server.address();
    const port = typeof addr === 'object' && addr ? addr.port : 0;

    const receivedChunks: string[] = [];
    const ssePromise = new Promise<void>((resolve, reject) => {
      const req = http.get(
        `http://127.0.0.1:${port}/api/v1/notifications/stream`,
        {
          headers: {
            Authorization: `Bearer ${adminToken}`,
            Accept: 'text/event-stream',
          },
        },
        res => {
          expect(res.statusCode).toBe(200);
          expect(res.headers['content-type']).toContain('text/event-stream');
          res.on('data', chunk => {
            const text = chunk.toString();
            receivedChunks.push(text);
            if (receivedChunks.join('').includes('Live SSE Test')) {
              req.destroy();
              resolve();
            }
          });
        },
      );
      req.on('error', err => {
        if (!receivedChunks.join('').includes('event: notification')) {
          reject(err);
        }
      });

      setTimeout(async () => {
        const res = await NotificationService.notify({
          title: 'Live SSE Test',
          message: 'Real-time event arrived.',
          category: NotificationCategory.SYSTEM,
          eventKey: `test.sse:${Date.now()}`,
          target: { userIds: [adminUser.id] },
        });
        if (res) createdNotificationIds.push(res.notificationId);
      }, 150);
    });

    await ssePromise;
    server.close();
    const combined = receivedChunks.join('');
    expect(combined).toContain('event: connected');
    expect(combined).toContain('event: notification');
    expect(combined).toContain('Live SSE Test');
  });
});
