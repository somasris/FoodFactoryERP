import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { AuthContext, AuthContextType } from '../context/AuthContext';
import { I18nProvider } from '../i18n/I18nContext';
import { BatchLabelDesignerPage } from '../routes/production/BatchLabelDesignerPage';
import { labelsService } from '../services/labels.service';
import { productionService } from '../services/production.service';

vi.mock('qrcode', () => ({
  default: {
    toDataURL: vi.fn().mockResolvedValue('data:image/png;base64,MOCKQR'),
  },
}));

vi.mock('../services/labels.service', () => ({
  labelsService: {
    listTemplates: vi.fn(),
    createTemplate: vi.fn(),
    updateTemplate: vi.fn(),
    duplicateTemplate: vi.fn(),
    setTemplateActive: vi.fn(),
    previewLabel: vi.fn(),
    generateLabel: vi.fn(),
    reprintLabel: vi.fn(),
    listHistory: vi.fn(),
    downloadPdf: vi.fn(),
  },
}));

vi.mock('../services/production.service', () => ({
  productionService: {
    batches: {
      list: vi.fn(),
    },
  },
}));

const authStub: AuthContextType = {
  user: {
    id: 'user-1',
    email: 'prod@foodfactory.com',
    username: 'prod',
    fullName: 'Production Lead',
    isActive: true,
    roles: ['PRODUCTION'],
    permissions: ['production.batches.read', 'production.batches.create'],
  },
  isAuthenticated: true,
  isLoading: false,
  login: vi.fn(),
  logout: vi.fn(),
  hasRole: () => true,
  hasPermission: () => true,
};

function renderPage() {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={qc}>
      <AuthContext.Provider value={authStub}>
        <I18nProvider>
          <MemoryRouter>
            <BatchLabelDesignerPage />
          </MemoryRouter>
        </I18nProvider>
      </AuthContext.Provider>
    </QueryClientProvider>,
  );
}

describe('Phase 8: Smart Batch Label Designer UI', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(labelsService.listTemplates).mockResolvedValue([
      {
        id: 'tpl-1',
        code: 'LBL-STD-100X70',
        name: 'Standard Batch Label (100x70 mm)',
        sizePreset: 'STANDARD_BATCH',
        widthMm: 100,
        heightMm: 70,
        logoPlacement: 'TOP_LEFT',
        includeQr: true,
        includeBarcode: true,
        layoutConfig: {
          showCompanyName: true,
          showCompanyAddress: true,
          showFactoryName: true,
          showFssaiLicense: true,
          showProductName: true,
          showSku: true,
          showBatchNumber: true,
          showManufacturingDate: true,
          showExpiryDate: true,
          showNetQuantity: true,
          showQualityStatus: true,
          showAllergenDeclaration: true,
          showStorageInstructions: true,
          optionalFields: [],
        },
        versionNumber: 1,
        isActive: true,
        isDefault: true,
      },
    ]);
    vi.mocked(productionService.batches.list).mockResolvedValue({
      success: true,
      data: {
        items: [{ id: 'batch-1', batchNumber: 'PB-2026-0001', status: 'COMPLETED' }],
      },
    } as never);
    vi.mocked(labelsService.listHistory).mockResolvedValue([
      {
        id: 'lbl-rec-1',
        labelNumber: 'LBL-2026-00001-ABCD',
        productionBatchId: 'batch-1',
        templateId: 'tpl-1',
        templateVersionNumber: 1,
        generationType: 'ORIGINAL',
        copies: 2,
        qualityStatusSnapshot: 'ACCEPTED',
        labelSnapshot: {
          companyName: 'FoodFactory Foods',
          companyAddress: 'Chennai',
          fssaiLicense: null,
          factoryName: 'Main Plant',
          warehouseCode: 'WH-FG-01',
          productName: 'Roasted Cashew Cookies',
          productCode: 'PROD-1',
          variantName: '250g Box',
          sku: 'SKU-250G',
          batchNumber: 'PB-2026-0001',
          workOrderNumber: 'WO-1',
          manufacturingDate: '2026-11-20',
          expiryDate: '2027-05-19',
          netQuantity: '95.00',
          uomSymbol: 'kg',
          qualityDecision: 'ACCEPTED',
          inspectionNumber: 'QC-1',
          labelMode: 'RELEASED',
          allergenSummary: {
            overallStatus: 'CONTAINS_ALLERGENS',
            confirmedAllergens: ['TREE_NUTS'],
            crossContactAllergens: [],
            hasUnknownIngredients: false,
            declarationText: 'Contains: TREE_NUTS',
          },
          storageInstructions: 'Store cool & dry',
          qrReferenceToken: 'tok-123',
          tracePath: '/trace/batch/tok-123',
          barcodeValue: '89012345',
        },
        generatedById: 'user-1',
        generatedAt: '2026-11-26T10:00:00.000Z',
        template: {
          code: 'LBL-STD-100X70',
          name: 'Standard Batch Label (100x70 mm)',
          widthMm: 100,
          heightMm: 70,
        },
      },
    ]);
  });

  it('1. Previews authoritative batch label data with QR and allergen declaration', async () => {
    vi.mocked(labelsService.previewLabel).mockResolvedValue({
      companyName: 'FoodFactory Foods',
      companyAddress: 'Chennai',
      fssaiLicense: null,
      factoryName: 'Main Plant',
      warehouseCode: 'WH-FG-01',
      productName: 'Roasted Cashew Cookies',
      productCode: 'PROD-1',
      variantName: '250g Box',
      sku: 'SKU-250G',
      batchNumber: 'PB-2026-0001',
      workOrderNumber: 'WO-1',
      manufacturingDate: '2026-11-20',
      expiryDate: '2027-05-19',
      netQuantity: '95.00',
      uomSymbol: 'kg',
      qualityDecision: 'ACCEPTED',
      inspectionNumber: 'QC-1',
      labelMode: 'RELEASED',
      allergenSummary: {
        overallStatus: 'CONTAINS_ALLERGENS',
        confirmedAllergens: ['TREE_NUTS'],
        crossContactAllergens: [],
        hasUnknownIngredients: false,
        declarationText: 'Contains: TREE_NUTS',
      },
      storageInstructions: 'Store cool & dry',
      qrReferenceToken: 'tok-123',
      tracePath: '/trace/batch/tok-123',
      barcodeValue: '89012345',
    });

    renderPage();

    const batchSelect = await screen.findByLabelText('Production Batch');
    await waitFor(() => {
      expect(screen.getByText(/PB-2026-0001/)).toBeTruthy();
    });
    fireEvent.change(batchSelect, { target: { value: 'batch-1' } });

    fireEvent.click(screen.getByRole('button', { name: 'Preview Label' }));

    expect(await screen.findByText('Roasted Cashew Cookies')).toBeTruthy();
    expect(screen.getByText('Contains: TREE_NUTS')).toBeTruthy();
    expect(screen.getByAltText('Batch Traceability QR')).toBeTruthy();
  });

  it('2. Switches to Templates and Label History tabs and triggers Reprint', async () => {
    vi.mocked(labelsService.reprintLabel).mockResolvedValue({
      id: 'lbl-rec-2',
      labelNumber: 'LBL-2026-00002-EFGH',
      productionBatchId: 'batch-1',
      templateId: 'tpl-1',
      templateVersionNumber: 1,
      generationType: 'REPRINT',
      parentLabelId: 'lbl-rec-1',
      copies: 1,
      qualityStatusSnapshot: 'ACCEPTED',
      labelSnapshot: {} as never,
      generatedById: 'user-1',
      generatedAt: '2026-11-26T10:05:00.000Z',
    });

    renderPage();

    fireEvent.click(screen.getByRole('button', { name: 'Templates' }));
    expect(await screen.findByText('LBL-STD-100X70')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Label History' }));
    expect(await screen.findByText('LBL-2026-00001-ABCD')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Reprint' }));
    await waitFor(() => {
      expect(labelsService.reprintLabel).toHaveBeenCalledWith('lbl-rec-1', 1);
    });
  });
});
