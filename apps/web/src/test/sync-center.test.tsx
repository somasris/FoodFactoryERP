import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, waitFor, fireEvent, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import { OfflineProvider } from '../context/OfflineContext';
import { SyncCenterPage } from '../routes/SyncCenterPage';
import { offlineRepo } from '../offline/offline-repository';

describe('Sprint 6: Sync Center & Conflict Resolution UI', () => {
  const user = {
    id: 'sync-ui-user',
    email: 'sync@foodfactory.local',
    username: 'syncuser',
    fullName: 'Sync Operator',
    isActive: true,
    roles: ['PRODUCTION'],
    permissions: ['production.batches.execute'],
  };

  beforeEach(async () => {
    vi.restoreAllMocks();
    await offlineRepo.clearUserDataOnLogout(user.id, true);
  });

  afterEach(() => {
    cleanup();
  });

  it('displays conflicts and allows discarding local draft without overwriting server data', async () => {
    await offlineRepo.putPendingOperation({
      operationId: 'op-conflict-1',
      idempotencyKey: 'idem-c-1',
      entityType: 'PRODUCTION_BATCH',
      entityId: 'batch-1',
      operationType: 'BATCH_PROGRESS_LOG',
      payload: { goodQuantity: 10 },
      userId: user.id,
      factoryId: null,
      warehouseId: null,
      clientCreatedAt: new Date().toISOString(),
      clientUpdatedAt: new Date().toISOString(),
      baseServerVersion: 'v1',
      localSequence: 1,
      dependencyOperationIds: [],
      status: 'CONFLICT',
      retryCount: 0,
      nextRetryAt: null,
      lastAttemptAt: null,
      lastErrorCode: 'BATCH_ALREADY_COMPLETED',
      lastErrorMessage: 'Batch already completed on server',
      serverResultEntityId: null,
    });

    await offlineRepo.saveConflict({
      conflictId: 'conf-1',
      operationId: 'op-conflict-1',
      userId: user.id,
      entityType: 'PRODUCTION_BATCH',
      entityId: 'batch-1',
      operationType: 'BATCH_PROGRESS_LOG',
      conflictCategory: 'BATCH_ALREADY_COMPLETED',
      localPayload: { goodQuantity: 10 },
      serverSnapshot: { status: 'COMPLETED' },
      reason: 'Batch already completed on server',
      detectedAt: new Date().toISOString(),
      resolvedAt: null,
      resolutionAction: null,
    });

    render(
      <MemoryRouter>
        <AuthContext.Provider
          value={{
            user,
            isAuthenticated: true,
            isLoading: false,
            login: vi.fn(),
            logout: vi.fn(),
            hasRole: () => true,
            hasPermission: () => true,
          }}
        >
          <OfflineProvider>
            <SyncCenterPage />
          </OfflineProvider>
        </AuthContext.Provider>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText('BATCH_ALREADY_COMPLETED')).toBeTruthy();
    });

    fireEvent.click(screen.getByText('Discard Local Draft'));

    await waitFor(async () => {
      const remaining = await offlineRepo.listConflicts(user.id, true);
      expect(remaining).toHaveLength(0);
      const op = await offlineRepo.getPendingOperation(user.id, 'op-conflict-1');
      expect(op?.status).toBe('CANCELLED');
    });
  });
});
