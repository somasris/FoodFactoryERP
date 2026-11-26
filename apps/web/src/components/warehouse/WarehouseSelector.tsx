import React, { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { masterDataService } from '../../services/master-data.service';

interface WarehouseSelectorProps {
  value: string;
  onChange: (warehouseId: string) => void;
  label?: string;
}

export const WarehouseSelector: React.FC<WarehouseSelectorProps> = ({
  value,
  onChange,
  label = 'Warehouse',
}) => {
  const { data } = useQuery({
    queryKey: ['master-data', 'warehouses', 'selector'],
    queryFn: () => masterDataService.warehouses.list({ limit: 100 }),
  });

  const warehouses = data?.data?.items ?? [];

  useEffect(() => {
    if (!value && warehouses.length > 0) {
      onChange(warehouses[0].id);
    }
  }, [value, warehouses, onChange]);

  return (
    <div className="flex items-center gap-2">
      <label className="text-xs font-semibold text-[#24352A]">{label}:</label>
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        aria-label={label}
        className="rounded-md border border-[#E1E7DD] bg-white px-2.5 py-1.5 text-xs text-[#24352A] focus:border-[#245C3A] focus:outline-none"
      >
        {warehouses.length === 0 && <option value="">Select warehouse...</option>}
        {warehouses.map(w => (
          <option key={w.id} value={w.id}>
            {w.code} — {w.name}
          </option>
        ))}
      </select>
    </div>
  );
};
