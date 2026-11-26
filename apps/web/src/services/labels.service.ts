import { apiClient, getAccessToken } from './api-client';

export interface LabelLayoutConfig {
  showCompanyName: boolean;
  showCompanyAddress: boolean;
  showFactoryName: boolean;
  showFssaiLicense: boolean;
  showProductName: boolean;
  showSku: boolean;
  showBatchNumber: boolean;
  showManufacturingDate: boolean;
  showExpiryDate: boolean;
  showNetQuantity: boolean;
  showQualityStatus: boolean;
  showAllergenDeclaration: boolean;
  showStorageInstructions: boolean;
  optionalFields: Array<'VARIANT_NAME' | 'WORK_ORDER_NUMBER' | 'WAREHOUSE_CODE' | 'INSPECTION_NUMBER'>;
}

export interface BatchLabelTemplate {
  id: string;
  code: string;
  name: string;
  description?: string | null;
  sizePreset: 'SMALL_PRODUCT' | 'STANDARD_BATCH' | 'LARGE_CARTON' | 'CUSTOM';
  widthMm: string | number;
  heightMm: string | number;
  logoPlacement: 'TOP_LEFT' | 'TOP_RIGHT' | 'TOP_CENTER' | 'NONE';
  includeQr: boolean;
  includeBarcode: boolean;
  layoutConfig: LabelLayoutConfig;
  defaultStorageInstructions?: string | null;
  versionNumber: number;
  isActive: boolean;
  isDefault: boolean;
  versions?: Array<{
    id: string;
    versionNumber: number;
    createdAt: string;
  }>;
}

export interface AuthoritativeLabelSnapshot {
  companyName: string;
  companyAddress: string;
  fssaiLicense: string | null;
  factoryName: string;
  warehouseCode: string;
  productName: string;
  productCode: string;
  variantName: string;
  sku: string;
  batchNumber: string;
  workOrderNumber: string;
  manufacturingDate: string;
  expiryDate: string;
  netQuantity: string;
  uomSymbol: string;
  qualityDecision: string;
  inspectionNumber: string | null;
  labelMode: 'RELEASED' | 'INTERNAL_STATUS';
  allergenSummary: {
    overallStatus: string;
    confirmedAllergens: string[];
    crossContactAllergens: string[];
    hasUnknownIngredients: boolean;
    declarationText: string;
  };
  storageInstructions: string | null;
  qrReferenceToken: string | null;
  tracePath: string | null;
  barcodeValue: string | null;
}

export interface BatchLabelRecord {
  id: string;
  labelNumber: string;
  productionBatchId: string;
  templateId: string;
  templateVersionNumber: number;
  generationType: 'ORIGINAL' | 'REPRINT';
  parentLabelId?: string | null;
  copies: number;
  qualityStatusSnapshot: string;
  qrReferenceToken?: string | null;
  barcodeValue?: string | null;
  labelSnapshot: AuthoritativeLabelSnapshot;
  generatedById: string;
  generatedAt: string;
  template?: {
    id?: string;
    code: string;
    name: string;
    widthMm: string | number;
    heightMm: string | number;
  };
}

export const labelsService = {
  async listTemplates(includeInactive = false): Promise<BatchLabelTemplate[]> {
    const res = await apiClient<BatchLabelTemplate[]>(
      `/labels/templates${includeInactive ? '?includeInactive=true' : ''}`,
    );
    return res.data ?? [];
  },

  async createTemplate(payload: Record<string, unknown>): Promise<BatchLabelTemplate> {
    const res = await apiClient<BatchLabelTemplate>('/labels/templates', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    return res.data!;
  },

  async updateTemplate(id: string, payload: Record<string, unknown>): Promise<BatchLabelTemplate> {
    const res = await apiClient<BatchLabelTemplate>(`/labels/templates/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
    return res.data!;
  },

  async duplicateTemplate(id: string): Promise<BatchLabelTemplate> {
    const res = await apiClient<BatchLabelTemplate>(`/labels/templates/${id}/duplicate`, {
      method: 'POST',
      body: JSON.stringify({}),
    });
    return res.data!;
  },

  async setTemplateActive(id: string, isActive: boolean): Promise<BatchLabelTemplate> {
    const res = await apiClient<BatchLabelTemplate>(`/labels/templates/${id}/status`, {
      method: 'POST',
      body: JSON.stringify({ isActive }),
    });
    return res.data!;
  },

  async previewLabel(payload: {
    productionBatchId: string;
    templateId: string;
    labelMode: 'RELEASED' | 'INTERNAL_STATUS';
    storageInstructionsOverride?: string;
  }): Promise<AuthoritativeLabelSnapshot> {
    const res = await apiClient<AuthoritativeLabelSnapshot>('/labels/preview', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    return res.data!;
  },

  async generateLabel(payload: {
    productionBatchId: string;
    templateId: string;
    copies: number;
    labelMode: 'RELEASED' | 'INTERNAL_STATUS';
    storageInstructionsOverride?: string;
    idempotencyKey?: string;
  }): Promise<BatchLabelRecord> {
    const res = await apiClient<BatchLabelRecord>('/labels/generate', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    return res.data!;
  },

  async reprintLabel(id: string, copies: number): Promise<BatchLabelRecord> {
    const res = await apiClient<BatchLabelRecord>(`/labels/${id}/reprint`, {
      method: 'POST',
      body: JSON.stringify({ copies }),
    });
    return res.data!;
  },

  async listHistory(productionBatchId?: string): Promise<BatchLabelRecord[]> {
    const qs = productionBatchId
      ? `?productionBatchId=${encodeURIComponent(productionBatchId)}`
      : '';
    const res = await apiClient<BatchLabelRecord[]>(`/labels/history${qs}`);
    return res.data ?? [];
  },

  async downloadPdf(labelId: string, labelNumber: string): Promise<void> {
    const baseUrl = import.meta.env.VITE_API_URL || '/api/v1';
    const token = getAccessToken();
    const res = await fetch(`${baseUrl}/labels/${labelId}/pdf`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      credentials: 'include',
    });
    if (!res.ok) {
      throw new Error('Failed to download label PDF');
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${labelNumber}.pdf`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  },
};
