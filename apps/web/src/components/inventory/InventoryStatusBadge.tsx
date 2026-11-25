import React from 'react';
import { StatusBadge } from '../common/StatusBadge';

const LABEL_MAP: Record<string, string> = {
  DRAFT: 'Draft',
  SUBMITTED: 'Submitted',
  APPROVED: 'Approved',
  POSTED: 'Posted',
  IN_TRANSIT: 'In Transit',
  RECEIVED: 'Received',
  CANCELLED: 'Cancelled',
  VALID: 'Valid',
  EXPIRING_SOON: 'Expiring Soon',
  EXPIRED: 'Expired',
  NO_EXPIRY: 'No Expiry',
};

const TONE_MAP: Record<string, 'neutral' | 'info' | 'success' | 'warning' | 'danger'> = {
  DRAFT: 'neutral',
  SUBMITTED: 'info',
  APPROVED: 'info',
  POSTED: 'success',
  IN_TRANSIT: 'warning',
  RECEIVED: 'success',
  CANCELLED: 'danger',
  VALID: 'success',
  EXPIRING_SOON: 'warning',
  EXPIRED: 'danger',
  NO_EXPIRY: 'neutral',
};

export const InventoryStatusBadge: React.FC<{ status: string }> = ({ status }) => {
  return (
    <StatusBadge
      status={LABEL_MAP[status] || status}
      tone={TONE_MAP[status] || 'neutral'}
    />
  );
};
