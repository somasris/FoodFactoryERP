import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthContext, AuthContextType } from '../context/AuthContext';
import { WarehouseLayoutPage } from '../routes/warehouse/WarehouseLayoutPage';
import { BarcodeLabelsPage } from '../routes/warehouse/BarcodeLabelsPage';
import { CycleCountSchedulePage } from '../routes/warehouse/CycleCountSchedulePage';
import { WarehouseAnalyticsPage } from '../routes/warehouse/WarehouseAnalyticsPage';
import { masterDataService } from '../services/master-data.service';
import { warehouseService } from '../services/warehouse.service';

const makeAuthValue = (roles: string[], permissions: string[]): AuthContextType => ({
  user: {
    id: 'u-1',
    email: 'admin@foodfactory.com',
    username: 'admin1',
    fullName: 'Admin User',
    isActive: true,
    roles,
    permissions,
  },
  isAuthenticated: true,
  isLoading: false,
  login: vi.fn(),
  logout: vi.fn(),
  hasRole: (r: string) => roles.includes('OWNER') || roles.includes(r),
  hasPermission: (p: string) => roles.includes('OWNER') || permissions.includes(p),
});

const renderWithProviders = (ui: React.ReactElement, auth: AuthContextType) => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <AuthContext.Provider value={auth}>
        <MemoryRouter>{ui}</MemoryRouter>
      </AuthContext.Provider>
    </QueryClientProvider>,
  );
};

describe('Phase 9 Smart Warehouse Frontend Suite', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(masterDataService.warehouses, 'list').mockResolvedValue({
      success: true,
      message: 'ok',
      data: {
        items: [
          {
            id: 'wh-1',
            factoryId: 'f-1',
            code: 'WH-RM-01',
            name: 'Raw Material Store',
            warehouseType: 'RAW_MATERIAL',
            isActive: true,
          },
        ],
        total: 1,
        page: 1,
        limit: 100,
        totalPages: 1,
      },
      timestamp: new Date().toISOString(),
    });
  });

  it('1. WarehouseLayoutPage renders Zone -> Rack -> Shelf -> Bin hierarchy', async () => {
    vi.spyOn(warehouseService, 'getLayout').mockResolvedValue({
      success: true,
      message: 'ok',
      data: {
        id: 'wh-1',
        code: 'WH-RM-01',
        name: 'Raw Material Store',
        warehouseType: 'RAW_MATERIAL',
        factory: { id: 'f-1', code: 'FAC-01', name: 'Main Plant', state: 'Tamil Nadu' },
        zones: [
          {
            id: 'z-1',
            code: 'Z-AMB',
            name: 'Ambient Zone',
            zoneType: 'ZONE',
            storageCondition: 'AMBIENT',
            isTemperatureControlled: false,
            allergenProfile: null,
            isActive: true,
            racks: [
              {
                id: 'r-1',
                code: 'R01',
                name: 'Rack 1',
                aisle: 'A1',
                shelves: [
                  {
                    id: 's-1',
                    code: 'S01',
                    name: 'Shelf 1',
                    levelNumber: 1,
                    bins: [
                      {
                        id: 'b-1',
                        warehouseId: 'wh-1',
                        shelfId: 's-1',
                        code: 'B-01-01',
                        name: 'Bin 1',
                        locationType: 'BIN',
                        storageCondition: 'AMBIENT',
                        capacityQuantity: '100',
                        isTemperatureControlled: false,
                        allergenRestriction: null,
                        allowMixedItems: true,
                        allowMixedBatches: true,
                        isActive: true,
                        usedQuantity: '40',
                        utilizationPercent: 40,
                      },
                    ],
                  },
                ],
              },
            ],
          },
        ],
      },
      timestamp: new Date().toISOString(),
    });

    const auth = makeAuthValue(['ADMIN'], ['inventory.read']);
    renderWithProviders(<WarehouseLayoutPage />, auth);

    await waitFor(() => {
      expect(screen.getByText('Ambient Zone')).toBeDefined();
      expect(screen.getByText('B-01-01')).toBeDefined();
      expect(screen.getByText('40%')).toBeDefined();
    });
  });

  it('2. BarcodeLabelsPage renders SVG CODE128 and QR labels', async () => {
    vi.spyOn(warehouseService, 'listBarcodes').mockResolvedValue({
      success: true,
      message: 'ok',
      data: [
        {
          id: 'bc-1',
          barcodeValue: 'FF-BIN-001',
          qrPayload: '{"code":"FF-BIN-001"}',
          entityType: 'WAREHOUSE_BIN',
          entityId: 'b-1',
          warehouseId: 'wh-1',
          labelFormat: 'CODE128',
          createdAt: new Date().toISOString(),
        },
      ],
      timestamp: new Date().toISOString(),
    });

    const auth = makeAuthValue(['ADMIN'], ['inventory.read']);
    renderWithProviders(<BarcodeLabelsPage />, auth);

    await waitFor(() => {
      expect(screen.getByText('FF-BIN-001')).toBeDefined();
      expect(screen.getByLabelText('Barcode for FF-BIN-001')).toBeDefined();
    });
  });

  it('3. CycleCountSchedulePage lists scheduled cycle count plans', async () => {
    vi.spyOn(warehouseService, 'listCycleCountPlans').mockResolvedValue({
      success: true,
      message: 'ok',
      data: [
        {
          id: 'ccp-1',
          planNumber: 'CCP-261126-A1',
          name: 'Class A Weekly Blind Count',
          warehouseId: 'wh-1',
          abcClass: 'A',
          frequency: 'WEEKLY',
          isBlindCount: true,
          binId: null,
          nextRunDate: new Date().toISOString(),
          lastRunDate: null,
          status: 'ACTIVE',
          warehouse: { id: 'wh-1', code: 'WH-RM-01', name: 'Raw Material Store' },
        },
      ],
      timestamp: new Date().toISOString(),
    });

    const auth = makeAuthValue(['ADMIN'], ['compliance.stock_audit.read']);
    renderWithProviders(<CycleCountSchedulePage />, auth);

    await waitFor(() => {
      expect(screen.getByText('Class A Weekly Blind Count')).toBeDefined();
      expect(screen.getByText('CCP-261126-A1')).toBeDefined();
    });
  });

  it('4. WarehouseAnalyticsPage displays utilization, empty bins, and accuracy KPIs', async () => {
    vi.spyOn(warehouseService, 'getAnalytics').mockResolvedValue({
      success: true,
      message: 'ok',
      data: {
        warehouseId: 'wh-1',
        locationUtilization: {
          totalBins: 10,
          activeBins: 10,
          occupiedBins: 6,
          emptyBinsCount: 4,
          totalCapacity: '1000',
          totalUsed: '450',
          utilizationPercent: 45,
        },
        emptyBins: [],
        stockByLocation: [{ binId: 'b-1', binCode: 'B-01-01', quantity: '450', value: '22500.00' }],
        batchLocationDistributionCount: 3,
        pickingAccuracyPercent: 98.5,
        cycleCountVariance: {
          auditsCount: 2,
          totalLines: 20,
          accurateLines: 19,
          netVarianceValue: '-120.00',
        },
        expiryRiskByLocation: [],
        movementVolume: { last7Days: [], last30Days: [{ type: 'PUT_AWAY', count: 5 }] },
      },
      timestamp: new Date().toISOString(),
    });

    const auth = makeAuthValue(['ADMIN'], ['inventory.read']);
    renderWithProviders(<WarehouseAnalyticsPage />, auth);

    await waitFor(() => {
      expect(screen.getByText('45%')).toBeDefined();
      expect(screen.getByText('98.5%')).toBeDefined();
      expect(screen.getByText('B-01-01')).toBeDefined();
    });
  });
});
