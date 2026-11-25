import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthContext, AuthContextType } from '../context/AuthContext';
import { ProductionLayout } from '../components/production/ProductionLayout';
import { BomsPage } from '../routes/master-data/BomsPage';
import { masterDataService } from '../services/master-data.service';
import { BOM } from '../types/master-data';

const makeAuthValue = (roles: string[], permissions: string[]): AuthContextType => ({
  user: {
    id: 'u-1',
    email: 'test@foodfactory.com',
    username: 'testuser',
    fullName: 'Test User',
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

const renderWithProviders = (ui: React.ReactElement, auth: AuthContextType, initialPath = '/') => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <AuthContext.Provider value={auth}>
        <MemoryRouter initialEntries={[initialPath]}>{ui}</MemoryRouter>
      </AuthContext.Provider>
    </QueryClientProvider>,
  );
};

const sampleBom: BOM = {
  id: 'bom-1',
  productVariantId: 'pv-1',
  code: 'BOM-MUR-01',
  name: 'Butter Murukku Standard Recipe',
  baseOutputQuantity: '100',
  outputUomId: 'uom-pcs',
  isActive: true,
  createdAt: '2026-11-25T00:00:00.000Z',
  updatedAt: '2026-11-25T00:00:00.000Z',
  productVariant: {
    id: 'pv-1',
    productId: 'p-1',
    sku: 'MUR-200',
    name: '200g Pack',
    netWeightGrams: '200',
    uomId: 'uom-pcs',
    defaultSellingPrice: '45.00',
    isActive: true,
    createdAt: '',
    updatedAt: '',
  },
  outputUom: {
    id: 'uom-pcs',
    code: 'PCS',
    name: 'Pieces',
    symbol: 'pcs',
    category: 'COUNT',
    isBaseUnit: true,
    decimalPlaces: 0,
    isActive: true,
    createdAt: '',
    updatedAt: '',
  },
  versions: [
    {
      id: 'ver-1',
      bomId: 'bom-1',
      versionNumber: 1,
      status: 'DRAFT',
      effectiveFrom: '2026-11-25T00:00:00.000Z',
      expectedGoodOutput: '100',
      yieldPercentage: '95.00',
      expectedWastagePercent: '5.00',
      outputUomId: 'uom-pcs',
      outputUom: {
        id: 'uom-pcs',
        code: 'PCS',
        name: 'Pieces',
        symbol: 'pcs',
        category: 'COUNT',
        isBaseUnit: true,
        decimalPlaces: 0,
        isActive: true,
        createdAt: '',
        updatedAt: '',
      },
      items: [
        {
          id: 'bi-1',
          bomVersionId: 'ver-1',
          inventoryItemId: 'ii-1',
          itemType: 'RAW_MATERIAL',
          standardQuantity: '20.0000',
          uomId: 'uom-kg',
          scrapTolerancePercent: '5.00',
          inventoryItem: { id: 'ii-1', code: 'RM-FLR', name: 'Rice Flour', itemType: 'RAW_MATERIAL', uomId: 'uom-kg', isActive: true },
          uom: { id: 'uom-kg', code: 'KG', name: 'Kilogram', symbol: 'kg', category: 'WEIGHT', isBaseUnit: true, decimalPlaces: 3, isActive: true, createdAt: '', updatedAt: '' },
        },
      ],
      overheads: [
        { id: 'oh-1', bomVersionId: 'ver-1', costType: 'LABOUR', description: 'Batch Labour', standardAmount: '500.00' },
      ],
      createdAt: '2026-11-25T00:00:00.000Z',
      updatedAt: '2026-11-25T00:00:00.000Z',
    },
  ],
};

describe('Phase 3.1 Frontend BOM & Recipe Suite', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(masterDataService.productVariants, 'list').mockResolvedValue({
      success: true, message: 'OK', data: { items: [], pagination: { page: 1, limit: 100, total: 0, totalPages: 0 } }, timestamp: '',
    });
    vi.spyOn(masterDataService.uoms, 'list').mockResolvedValue({
      success: true, message: 'OK', data: { items: [], pagination: { page: 1, limit: 100, total: 0, totalPages: 0 } }, timestamp: '',
    });
    vi.spyOn(masterDataService.inventoryItems, 'list').mockResolvedValue({
      success: true, message: 'OK', data: { items: [], pagination: { page: 1, limit: 100, total: 0, totalPages: 0 } }, timestamp: '',
    });
  });

  it('1. ProductionLayout renders BOM & Recipes navigation tab', () => {
    const auth = makeAuthValue(['PRODUCTION'], ['bom.read']);
    renderWithProviders(
      <Routes>
        <Route path="/" element={<ProductionLayout />} />
      </Routes>,
      auth,
    );
    expect(screen.getByText('BOM & Recipes')).toBeTruthy();
  });

  it('2. BomsPage displays BOM list, yield/wastage, cost estimate, and audit history', async () => {
    const auth = makeAuthValue(['ADMIN'], ['bom.read', 'bom.create', 'bom.update', 'bom.approve']);
    vi.spyOn(masterDataService.boms, 'list').mockResolvedValue({
      success: true,
      message: 'OK',
      data: { items: [sampleBom], pagination: { page: 1, limit: 20, total: 1, totalPages: 1 } },
      timestamp: '',
    });
    vi.spyOn(masterDataService.boms, 'getById').mockResolvedValue({
      success: true,
      message: 'OK',
      data: sampleBom,
      timestamp: '',
    });
    vi.spyOn(masterDataService.boms, 'getHistory').mockResolvedValue({
      success: true,
      message: 'OK',
      data: [
        {
          id: 'aud-1',
          action: 'CREATE',
          entityType: 'BOM',
          entityId: 'bom-1',
          remarks: 'Created v1',
          createdAt: '2026-11-25T00:00:00.000Z',
          user: { id: 'u-1', fullName: 'Admin User', username: 'admin' },
        },
      ],
      timestamp: '',
    });
    const costSpy = vi.spyOn(masterDataService.boms, 'getCostEstimate').mockResolvedValue({
      success: true,
      message: 'OK',
      data: {
        bomId: 'bom-1',
        versionId: 'ver-1',
        versionNumber: 1,
        status: 'DRAFT',
        targetOutputQuantity: '100.0000',
        outputUomSymbol: 'pcs',
        yieldPercentage: '95.00',
        expectedWastagePercent: '5.00',
        totalStandardMaterialCost: '1000.00',
        totalEffectiveMaterialCost: '1050.00',
        totalOverheadCost: '500.00',
        totalEstimatedCost: '1550.00',
        estimatedUnitCost: '15.5000',
        items: [],
        overheads: [],
      },
      timestamp: '',
    });

    renderWithProviders(<BomsPage />, auth);
    await waitFor(() => expect(screen.getByText('BOM-MUR-01')).toBeTruthy());

    fireEvent.click(screen.getByTitle('View details'));
    await waitFor(() => {
      expect(screen.getByText('95.00%')).toBeTruthy();
      expect(screen.getAllByText('5.00%').length).toBeGreaterThan(0);
      expect(screen.getByText('Audit History')).toBeTruthy();
    });

    fireEvent.click(screen.getByText('Cost Estimate'));
    await waitFor(() => {
      expect(costSpy).toHaveBeenCalled();
      expect(screen.getByText(/Total Estimated Batch Cost: ₹1550.00/)).toBeTruthy();
    });
  });

  it('3. BomsPage hides mutation actions for AUDITOR read-only role', async () => {
    const auditorAuth = makeAuthValue(['AUDITOR'], ['bom.read']);
    vi.spyOn(masterDataService.boms, 'list').mockResolvedValue({
      success: true,
      message: 'OK',
      data: { items: [sampleBom], pagination: { page: 1, limit: 20, total: 1, totalPages: 1 } },
      timestamp: '',
    });

    renderWithProviders(<BomsPage />, auditorAuth);
    await waitFor(() => expect(screen.getByText('BOM-MUR-01')).toBeTruthy());
    expect(screen.queryByText(/New BOM/i)).toBeNull();
  });
});
