import React from 'react';
import { Badge } from '../common/Badge';

const STATUS_MAP: Record<
  string,
  { label: string; variant: 'default' | 'secondary' | 'teal' | 'warning' | 'outline' | 'success' }
> = {
  DRAFT: { label: 'Draft', variant: 'outline' },
  SUBMITTED: { label: 'Submitted', variant: 'secondary' },
  APPROVED: { label: 'Approved', variant: 'teal' },
  REJECTED: { label: 'Rejected', variant: 'default' },
  CONFIRMED: { label: 'Confirmed', variant: 'teal' },
  PARTIALLY_FULFILLED: { label: 'Partial', variant: 'warning' },
  FULFILLED: { label: 'Fulfilled', variant: 'success' },
  ISSUED: { label: 'Issued', variant: 'success' },
  CANCELLED: { label: 'Cancelled', variant: 'outline' },
};

export const SalesStatusBadge: React.FC<{ status: string }> = ({ status }) => {
  const cfg = STATUS_MAP[status] || { label: status, variant: 'outline' as const };
  return <Badge variant={cfg.variant}>{cfg.label}</Badge>;
};
