import { apiClient } from './api-client';

export interface ShiftHandoverItem {
  id: string;
  handoverNumber: string;
  factoryId: string;
  warehouseId?: string | null;
  productionLine?: string | null;
  shiftName: string;
  shiftDate: string;
  outgoingUserId: string;
  incomingUserId?: string | null;
  status: 'DRAFT' | 'SUBMITTED' | 'ACKNOWLEDGED' | 'RETURNED' | 'CLOSED';
  priority: 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT';
  revisionNumber: number;
  equipmentIssues?: string | null;
  pendingQualityNotes?: string | null;
  productionDelays?: string | null;
  safetyObservations?: string | null;
  notes?: string | null;
  submittedAt?: string | null;
  acknowledgedAt?: string | null;
  returnReason?: string | null;
  closedAt?: string | null;
  createdAt: string;
}

export interface ShiftHandoverDetail extends ShiftHandoverItem {
  histories: Array<{
    id: string;
    revisionNumber: number;
    action: string;
    fromStatus?: string | null;
    toStatus: string;
    actorId: string;
    remarks?: string | null;
    createdAt: string;
  }>;
}

export interface ShiftHandoverDashboardData {
  pendingAcknowledgement: ShiftHandoverItem[];
  unresolvedIssues: ShiftHandoverItem[];
  recentlyClosed: ShiftHandoverItem[];
  overdueCount: number;
  activeBatches: Array<{
    id: string;
    batchNumber: string;
    status: string;
    plannedQuantity: string;
    actualGoodQuantity: string;
    productVariant: { sku: string; name: string };
  }>;
  pendingQualityInspections: Array<{
    id: string;
    inspectionNumber: string;
    inspectedQuantity: string;
    productionBatch: { id: string; batchNumber: string };
  }>;
}

export interface SubstitutionEvaluationData {
  compatibilityStatus: 'COMPATIBLE' | 'COMPATIBLE_WITH_WARNING' | 'REQUIRES_REVIEW' | 'NOT_COMPATIBLE';
  reasons: Array<{
    code: string;
    severity: 'BLOCKER' | 'WARNING' | 'INFO';
    message: string;
  }>;
  allergenComparison: {
    originalStatus: string;
    originalAllergens: string[];
    substituteStatus: string;
    substituteAllergens: string[];
    substituteCrossContact: string[];
    introducesNewAllergens: boolean;
    hasUnknownAllergenInfo: boolean;
  };
  inventorySummary: {
    requiredInSubstituteUom: string;
    substituteUomSymbol: string;
    availableAcceptedQty: string;
    reservedQty: string;
    quarantinedQty: string;
    rejectedQty: string;
    expiredQty: string;
  };
}

export interface SubstitutionRequestItem {
  id: string;
  requestNumber: string;
  warehouseId: string;
  bomId: string;
  bomVersionId: string;
  originalItemId: string;
  substituteItemId: string;
  requiredQuantity: string;
  compatibilityStatus: string;
  status: 'PENDING_APPROVAL' | 'APPROVED' | 'REJECTED' | 'APPLIED' | 'CANCELLED';
  reason: string;
  createdAt: string;
}

export const collaborationService = {
  async getHandoverDashboard(factoryId?: string): Promise<ShiftHandoverDashboardData> {
    const qs = factoryId ? `?factoryId=${encodeURIComponent(factoryId)}` : '';
    const res = await apiClient<ShiftHandoverDashboardData>(`/collaboration/handovers/dashboard${qs}`);
    return res.data!;
  },

  async listHandovers(params: {
    status?: string;
    priority?: string;
    search?: string;
    page?: number;
  }): Promise<{ items: ShiftHandoverItem[]; pagination: { page: number; totalPages: number; total: number } }> {
    const qs = new URLSearchParams();
    if (params.status) qs.set('status', params.status);
    if (params.priority) qs.set('priority', params.priority);
    if (params.search) qs.set('search', params.search);
    if (params.page) qs.set('page', String(params.page));
    const res = await apiClient<{ items: ShiftHandoverItem[]; pagination: { page: number; totalPages: number; total: number } }>(
      `/collaboration/handovers?${qs.toString()}`,
    );
    return res.data!;
  },

  async getHandoverById(id: string): Promise<ShiftHandoverDetail> {
    const res = await apiClient<ShiftHandoverDetail>(`/collaboration/handovers/${id}`);
    return res.data!;
  },

  async createHandover(payload: Record<string, unknown>): Promise<ShiftHandoverItem> {
    const res = await apiClient<ShiftHandoverItem>('/collaboration/handovers', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    return res.data!;
  },

  async submitHandover(id: string): Promise<ShiftHandoverItem> {
    const res = await apiClient<ShiftHandoverItem>(`/collaboration/handovers/${id}/submit`, {
      method: 'POST',
      body: JSON.stringify({}),
    });
    return res.data!;
  },

  async acknowledgeHandover(id: string, acknowledgementNotes?: string): Promise<ShiftHandoverItem> {
    const res = await apiClient<ShiftHandoverItem>(`/collaboration/handovers/${id}/acknowledge`, {
      method: 'POST',
      body: JSON.stringify({ acknowledgementNotes }),
    });
    return res.data!;
  },

  async returnHandover(id: string, returnReason: string): Promise<ShiftHandoverItem> {
    const res = await apiClient<ShiftHandoverItem>(`/collaboration/handovers/${id}/return`, {
      method: 'POST',
      body: JSON.stringify({ returnReason }),
    });
    return res.data!;
  },

  async closeHandover(id: string): Promise<ShiftHandoverItem> {
    const res = await apiClient<ShiftHandoverItem>(`/collaboration/handovers/${id}/close`, {
      method: 'POST',
      body: JSON.stringify({}),
    });
    return res.data!;
  },

  async evaluateSubstitution(payload: {
    warehouseId: string;
    bomId: string;
    bomVersionId: string;
    originalItemId: string;
    substituteItemId: string;
    requiredQuantity: string;
    uomId: string;
  }): Promise<SubstitutionEvaluationData> {
    const res = await apiClient<SubstitutionEvaluationData>('/collaboration/substitutions/evaluate', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    return res.data!;
  },

  async listSubstitutions(): Promise<SubstitutionRequestItem[]> {
    const res = await apiClient<SubstitutionRequestItem[]>('/collaboration/substitutions');
    return res.data ?? [];
  },

  async createSubstitutionRequest(payload: Record<string, unknown>): Promise<SubstitutionRequestItem> {
    const res = await apiClient<SubstitutionRequestItem>('/collaboration/substitutions', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    return res.data!;
  },

  async approveSubstitution(id: string, approvalNotes?: string): Promise<SubstitutionRequestItem> {
    const res = await apiClient<SubstitutionRequestItem>(`/collaboration/substitutions/${id}/approve`, {
      method: 'POST',
      body: JSON.stringify({ approvalNotes }),
    });
    return res.data!;
  },

  async rejectSubstitution(id: string, rejectionReason: string): Promise<SubstitutionRequestItem> {
    const res = await apiClient<SubstitutionRequestItem>(`/collaboration/substitutions/${id}/reject`, {
      method: 'POST',
      body: JSON.stringify({ rejectionReason }),
    });
    return res.data!;
  },

  async applySubstitution(id: string, applicationNotes?: string): Promise<SubstitutionRequestItem> {
    const res = await apiClient<SubstitutionRequestItem>(`/collaboration/substitutions/${id}/apply`, {
      method: 'POST',
      body: JSON.stringify({ applicationNotes }),
    });
    return res.data!;
  },
};
