import React from 'react';
import { StatusBadge } from '../common/StatusBadge';

const LABEL_MAP: Record<string, string> = {
  DRAFT: 'Draft',
  SUBMITTED: 'Submitted',
  APPROVED: 'Approved',
  REJECTED: 'Rejected',
  CONFIRMED: 'Confirmed',
  PARTIALLY_FULFILLED: 'Partial',
  FULFILLED: 'Fulfilled',
  ISSUED: 'Issued',
  CANCELLED: 'Cancelled',
};

const TONE_MAP: Record<string, 'neutral' | 'info' | 'success' | 'warning' | 'danger'> = {
  DRAFT: 'neutral',
  SUBMITTED: 'info',
  APPROVED: 'success',
  REJECTED: 'danger',
  CONFIRMED: 'info',
  PARTIALLY_FULFILLED: 'warning',
  FULFILLED: 'success',
  ISSUED: 'success',
  CANCELLED: 'danger',
};

export const SalesStatusBadge: React.FC<{ status: string }> = ({ status }) => {
  return (
    <StatusBadge
      status={LABEL_MAP[status] || status}
      tone={TONE_MAP[status] || 'neutral'}
    />
  );
};
