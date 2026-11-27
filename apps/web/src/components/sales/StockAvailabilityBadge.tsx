import React from 'react';
import { StatusBadge } from '../common/StatusBadge';
import { StockAvailabilityStatus } from '../../types/sales';

interface StockAvailabilityBadgeProps {
  status?: StockAvailabilityStatus | null;
  isLoading?: boolean;
}

export const StockAvailabilityBadge: React.FC<StockAvailabilityBadgeProps> = ({
  status,
  isLoading,
}) => {
  if (isLoading) {
    return <StatusBadge status="Checking..." tone="neutral" />;
  }

  switch (status) {
    case 'SUFFICIENT':
      return <StatusBadge status="Sufficient Stock" tone="success" />;
    case 'INSUFFICIENT':
      return <StatusBadge status="Insufficient Stock" tone="danger" />;
    case 'PARTIAL':
      return <StatusBadge status="Partial Stock" tone="warning" />;
    case 'NOT_APPLICABLE':
      return <StatusBadge status="Not Applicable" tone="neutral" />;
    default:
      return <StatusBadge status="Unavailable" tone="neutral" />;
  }
};
