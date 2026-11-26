import React, { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CalendarCheck, Play } from 'lucide-react';
import { warehouseService } from '../../services/warehouse.service';
import { WarehouseSelector } from '../../components/warehouse/WarehouseSelector';
import { AbcClass, CycleCountFrequency } from '../../types/warehouse';

export const CycleCountSchedulePage: React.FC = () => {
  const queryClient = useQueryClient();
  const [warehouseId, setWarehouseId] = useState('');
  const [name, setName] = useState('');
  const [abcClass, setAbcClass] = useState<'' | AbcClass>('A');
  const [frequency, setFrequency] = useState<CycleCountFrequency>('MONTHLY');
  const [isBlindCount, setIsBlindCount] = useState(false);
  const [nextRunDate, setNextRunDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const { data: plansRes, isLoading } = useQuery({
    queryKey: ['warehouse', 'cycle-count-plans', warehouseId],
    queryFn: () => warehouseService.listCycleCountPlans(warehouseId || undefined),
  });

  const createMut = useMutation({
    mutationFn: () =>
      warehouseService.createCycleCountPlan({
        name,
        warehouseId,
        abcClass: abcClass || null,
        frequency,
        isBlindCount,
        nextRunDate,
      }),
    onSuccess: () => {
      setName('');
      setError(null);
      queryClient.invalidateQueries({ queryKey: ['warehouse', 'cycle-count-plans'] });
    },
    onError: e => setError(e instanceof Error ? e.message : 'Failed to create cycle count plan'),
  });

  const generateMut = useMutation({
    mutationFn: (planId: string) => warehouseService.generateCycleCountAudit(planId),
    onSuccess: res => {
      setError(null);
      setMessage(`Generated Stock Audit ${res.data?.auditNumber} for counting.`);
      queryClient.invalidateQueries({ queryKey: ['warehouse', 'cycle-count-plans'] });
    },
    onError: e => setError(e instanceof Error ? e.message : 'Failed to generate cycle count'),
  });

  const plans = plansRes?.data ?? [];

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 rounded-lg border border-[#E1E7DD] bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-lg font-bold text-[#17452C]">Cycle Count Schedule</h1>
          <p className="text-xs text-[#66756A]">
            Schedule ABC-based and blind cycle counts integrated directly with StockAudit & InventoryAdjustment.
          </p>
        </div>
        <WarehouseSelector value={warehouseId} onChange={setWarehouseId} />
      </div>

      <form
        onSubmit={e => {
          e.preventDefault();
          createMut.mutate();
        }}
        className="rounded-lg border border-[#E1E7DD] bg-white p-4 shadow-sm space-y-3"
      >
        <h2 className="text-xs font-bold uppercase tracking-wider text-[#17452C]">
          New Cycle Count Plan
        </h2>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-5">
          <input
            required
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="Plan Name"
            className="rounded border border-[#E1E7DD] px-2.5 py-1.5 text-xs"
          />
          <select
            value={abcClass}
            onChange={e => setAbcClass(e.target.value as '' | AbcClass)}
            className="rounded border border-[#E1E7DD] px-2.5 py-1.5 text-xs"
          >
            <option value="">All ABC</option>
            <option value="A">Class A (High Value)</option>
            <option value="B">Class B</option>
            <option value="C">Class C</option>
          </select>
          <select
            value={frequency}
            onChange={e => setFrequency(e.target.value as CycleCountFrequency)}
            className="rounded border border-[#E1E7DD] px-2.5 py-1.5 text-xs"
          >
            <option value="WEEKLY">WEEKLY</option>
            <option value="MONTHLY">MONTHLY</option>
            <option value="QUARTERLY">QUARTERLY</option>
            <option value="ANNUAL">ANNUAL</option>
          </select>
          <input
            type="date"
            required
            value={nextRunDate}
            onChange={e => setNextRunDate(e.target.value)}
            className="rounded border border-[#E1E7DD] px-2.5 py-1.5 text-xs"
          />
          <label className="flex items-center gap-2 text-xs text-[#24352A]">
            <input
              type="checkbox"
              checked={isBlindCount}
              onChange={e => setIsBlindCount(e.target.checked)}
              className="h-4 w-4 rounded border-[#CBD5C5] text-[#245C3A]"
            />
            Blind Count
          </label>
        </div>
        <button
          type="submit"
          disabled={!warehouseId || createMut.isPending}
          className="inline-flex items-center gap-1.5 rounded bg-[#245C3A] px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-[#17452C] disabled:opacity-50"
        >
          <CalendarCheck className="h-3.5 w-3.5" /> Create Schedule
        </button>
      </form>

      {message && <p className="text-xs font-medium text-[#17452C]">{message}</p>}
      {error && <p className="text-xs text-[#C74440]">{error}</p>}

      <div className="rounded-lg border border-[#E1E7DD] bg-white shadow-sm overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead className="border-b border-[#E1E7DD] bg-[#FAFBF8] text-[#66756A]">
            <tr>
              <th className="px-3 py-2">Plan #</th>
              <th className="px-3 py-2">Name</th>
              <th className="px-3 py-2">ABC</th>
              <th className="px-3 py-2">Frequency</th>
              <th className="px-3 py-2">Blind</th>
              <th className="px-3 py-2">Next Run</th>
              <th className="px-3 py-2 text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#F0F4ED]">
            {isLoading ? (
              <tr>
                <td colSpan={7} className="px-3 py-6 text-center text-[#66756A]">
                  Loading cycle count plans...
                </td>
              </tr>
            ) : plans.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-3 py-6 text-center text-[#66756A]">
                  No cycle count plans scheduled.
                </td>
              </tr>
            ) : (
              plans.map(p => (
                <tr key={p.id}>
                  <td className="px-3 py-2 font-mono font-semibold text-[#17452C]">{p.planNumber}</td>
                  <td className="px-3 py-2">{p.name}</td>
                  <td className="px-3 py-2">{p.abcClass ?? 'ALL'}</td>
                  <td className="px-3 py-2">{p.frequency}</td>
                  <td className="px-3 py-2">{p.isBlindCount ? 'Yes' : 'No'}</td>
                  <td className="px-3 py-2">{new Date(p.nextRunDate).toLocaleDateString()}</td>
                  <td className="px-3 py-2 text-right">
                    <button
                      type="button"
                      disabled={generateMut.isPending}
                      onClick={() => generateMut.mutate(p.id)}
                      className="inline-flex items-center gap-1 rounded bg-[#EAF1E8] px-2.5 py-1 text-[11px] font-semibold text-[#17452C] hover:bg-[#dce8d9]"
                    >
                      <Play className="h-3 w-3" /> Generate Audit
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
