import React from 'react';
import { Badge } from '../common/Badge';

const STATUS_MAP: Record<
  string,
  { label: string; variant: 'default' | 'secondary' | 'teal' | 'warning' | 'outline' | 'success' }
> = {
  DRAFT: { label: 'Draft', variant: 'outline' },
  SUBMITTED: { label: 'Submitted', variant: 'secondary' },
  APPROVED: { label: 'Approved', variant: 'teal' },
  POSTED: { label: 'Posted', variant: 'success' },
  IN_TRANSIT: { label: 'In Transit', variant: 'warning' },
  RECEIVED: { label: 'Received', variant: 'success' },
  CANCELLED: { label: 'Cancelled', variant: 'outline' },
  VALID: { label: 'Valid', variant: 'success' },
  EXPIRING_SOON: { label: 'Expiring Soon', variant: 'warning' },
  EXPIRED: { label: 'Expired', variant: 'default' },
  NO_EXPIRY: { label: 'No Expiry', variant: 'outline' },
};

export const InventoryStatusBadge: React.FC<{ status: string }> = ({ status }) => {
  const cfg = STATUS_MAP[status] || { label: status, variant: 'outline' as const };
  return <Badge variant={cfg.variant}>{cfg.label}</Badge>;
};
