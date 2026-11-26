import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Search,
  X,
  ArrowRight,
  Clock,
  Loader2,
  AlertCircle,
  Compass,
  PlusCircle,
  Trash2,
} from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { NAV_GROUPS } from '../../config/navigation';
import { searchService, SearchResultItem } from '../../services/search.service';

interface CommandCenterModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface PaletteEntry {
  id: string;
  group: string;
  title: string;
  subtitle: string;
  status?: string | null;
  path: string;
}

function highlightMatch(text: string, query: string): React.ReactNode {
  const q = query.trim();
  if (!q) return text;
  const idx = text.toLowerCase().indexOf(q.toLowerCase());
  if (idx === -1) return text;
  return (
    <>
      {text.slice(0, idx)}
      <mark className="rounded bg-[#E8D7AA] px-0.5 text-[#17452C]">
        {text.slice(idx, idx + q.length)}
      </mark>
      {text.slice(idx + q.length)}
    </>
  );
}

export const CommandCenterModal: React.FC<CommandCenterModalProps> = ({ isOpen, onClose }) => {
  const { user, hasPermission } = useAuth();
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);

  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [results, setResults] = useState<SearchResultItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedIndex, setSelectedIndex] = useState(0);

  const recentKey = user?.id ? `ff_recent_searches_${user.id}` : null;
  const [recentSearches, setRecentSearches] = useState<string[]>([]);

  useEffect(() => {
    if (!recentKey) {
      setRecentSearches([]);
      return;
    }
    try {
      const raw = window.localStorage.getItem(recentKey);
      setRecentSearches(raw ? (JSON.parse(raw) as string[]) : []);
    } catch {
      setRecentSearches([]);
    }
  }, [recentKey, isOpen]);

  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setDebouncedQuery('');
      setResults([]);
      setError(null);
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 10);
    }
  }, [isOpen]);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(query.trim()), 200);
    return () => clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    if (!isOpen || !debouncedQuery) {
      setResults([]);
      setIsLoading(false);
      setError(null);
      return;
    }

    const controller = new AbortController();
    setIsLoading(true);
    setError(null);

    searchService
      .search(debouncedQuery, 20, controller.signal)
      .then(res => {
        setResults(res.data?.results ?? []);
        setSelectedIndex(0);
      })
      .catch(err => {
        if (err instanceof Error && err.name === 'AbortError') return;
        setError(err instanceof Error ? err.message : 'Search failed');
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setIsLoading(false);
        }
      });

    return () => controller.abort();
  }, [debouncedQuery, isOpen]);

  const permittedNavItems = useMemo<PaletteEntry[]>(() => {
    const items: PaletteEntry[] = [];
    for (const group of NAV_GROUPS) {
      for (const item of group.items) {
        const hasAll = !item.requiredPermissions?.length || item.requiredPermissions.every(p => hasPermission(p));
        const hasAny = !item.anyPermission?.length || item.anyPermission.some(p => hasPermission(p));
        if (hasAll && hasAny) {
          items.push({
            id: `nav:${item.path}`,
            group: 'Navigation',
            title: item.label,
            subtitle: group.label,
            path: item.path,
          });
        }
      }
    }

    if (hasPermission('production.batches.read')) {
      items.unshift({
        id: 'nav:/production/factory-pulse',
        group: 'Navigation',
        title: 'Live Factory Pulse',
        subtitle: 'Real-Time Manufacturing Overview',
        path: '/production/factory-pulse',
      });
    }

    const quickActions: PaletteEntry[] = [];
    if (hasPermission('sales.orders.create')) {
      quickActions.push({
        id: 'act:new-so',
        group: 'Quick Actions',
        title: 'Create Sales Order',
        subtitle: 'Open new sales order draft form',
        path: '/sales/orders/new',
      });
    }
    if (hasPermission('production.plans.create')) {
      quickActions.push({
        id: 'act:new-plan',
        group: 'Quick Actions',
        title: 'Create Production Plan',
        subtitle: 'Open production planning workspace',
        path: '/production/plans',
      });
    }
    if (hasPermission('inventory.receipt.create')) {
      quickActions.push({
        id: 'act:new-rcp',
        group: 'Quick Actions',
        title: 'Record Inventory Receipt',
        subtitle: 'Open inventory receipts',
        path: '/inventory/receipts',
      });
    }

    return [...quickActions, ...items];
  }, [hasPermission]);

  const entries = useMemo<PaletteEntry[]>(() => {
    if (!debouncedQuery) {
      return permittedNavItems.slice(0, 10);
    }
    const qLower = debouncedQuery.toLowerCase();
    const matchedNav = permittedNavItems.filter(
      item =>
        item.title.toLowerCase().includes(qLower) ||
        item.subtitle.toLowerCase().includes(qLower),
    );
    const serverEntries: PaletteEntry[] = results.map(r => ({
      id: `${r.entityType}:${r.entityId}`,
      group: r.category,
      title: r.title,
      subtitle: r.subtitle,
      status: r.status,
      path: r.navigationPath,
    }));
    return [...serverEntries, ...matchedNav.slice(0, 5)];
  }, [debouncedQuery, permittedNavItems, results]);

  const saveRecent = (term: string) => {
    const clean = term.trim();
    if (!clean || !recentKey) return;
    const next = [clean, ...recentSearches.filter(t => t !== clean)].slice(0, 5);
    setRecentSearches(next);
    try {
      window.localStorage.setItem(recentKey, JSON.stringify(next));
    } catch {
      // Ignore storage errors
    }
  };

  const clearRecent = () => {
    setRecentSearches([]);
    if (recentKey) {
      try {
        window.localStorage.removeItem(recentKey);
      } catch {
        // Ignore
      }
    }
  };

  const handleSelect = (entry: PaletteEntry) => {
    if (debouncedQuery) saveRecent(debouncedQuery);
    onClose();
    navigate(entry.path);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(prev => (entries.length > 0 ? (prev + 1) % entries.length : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(prev => (entries.length > 0 ? (prev - 1 + entries.length) % entries.length : 0));
    } else if (e.key === 'Enter' && entries[selectedIndex]) {
      e.preventDefault();
      handleSelect(entries[selectedIndex]);
    }
  };

  if (!isOpen) return null;

  const grouped = entries.reduce<Record<string, PaletteEntry[]>>((acc, item) => {
    if (!acc[item.group]) acc[item.group] = [];
    acc[item.group].push(item);
    return acc;
  }, {});

  let flatIdx = -1;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-[#103B28]/40 px-4 pt-16 backdrop-blur-[1px]"
      onMouseDown={e => {
        if (e.target === e.currentTarget) onClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-label="Command Center"
    >
      <div
        className="w-full max-w-2xl overflow-hidden rounded-xl border border-[#E1E7DD] bg-white shadow-2xl"
        onKeyDown={handleKeyDown}
      >
        {/* Search Input */}
        <div className="flex items-center gap-2.5 border-b border-[#E1E7DD] px-4 py-3">
          <Search className="h-4 w-4 shrink-0 text-[#245C3A]" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search orders, batches, materials, work orders, or jump to page..."
            aria-label="Command Center search"
            className="flex-1 bg-transparent text-sm text-[#24352A] placeholder:text-[#8A958C] focus:outline-none"
          />
          {isLoading && <Loader2 className="h-4 w-4 animate-spin text-[#245C3A]" />}
          <button
            type="button"
            onClick={onClose}
            aria-label="Close Command Center"
            className="rounded p-1 text-[#66756A] hover:bg-[#EAF1E8]"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Recent Searches */}
        {!debouncedQuery && recentSearches.length > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#E1E7DD] bg-[#FAFBF8] px-4 py-2 text-xs">
            <div className="flex flex-wrap items-center gap-1.5">
              <Clock className="h-3.5 w-3.5 text-[#8A958C]" />
              <span className="text-[#66756A]">Recent:</span>
              {recentSearches.map(term => (
                <button
                  key={term}
                  type="button"
                  onClick={() => setQuery(term)}
                  className="rounded border border-[#E1E7DD] bg-white px-2 py-0.5 text-[11px] font-medium text-[#17452C] hover:bg-[#EAF1E8]"
                >
                  {term}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={clearRecent}
              className="inline-flex items-center gap-1 text-[11px] text-[#66756A] hover:text-[#C74440]"
            >
              <Trash2 className="h-3 w-3" />
              <span>Clear</span>
            </button>
          </div>
        )}

        {/* Results */}
        <div className="max-h-[60vh] overflow-y-auto p-2">
          {error && (
            <div className="flex items-center gap-2 rounded-lg bg-[#C74440]/10 px-3 py-2 text-xs text-[#C74440]">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {!isLoading && !error && entries.length === 0 && (
            <div className="py-8 text-center text-xs text-[#66756A]">
              No matching records or pages found for "{debouncedQuery}".
            </div>
          )}

          {Object.entries(grouped).map(([groupName, groupItems]) => (
            <div key={groupName} className="mb-2 last:mb-0">
              <div className="px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-[#8A958C]">
                {groupName}
              </div>
              {groupItems.map(entry => {
                flatIdx++;
                const isSelected = flatIdx === selectedIndex;
                return (
                  <button
                    key={entry.id}
                    type="button"
                    onClick={() => handleSelect(entry)}
                    className={`flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2 text-left transition-colors ${
                      isSelected ? 'bg-[#EAF1E8] text-[#17452C]' : 'hover:bg-[#FAFBF8] text-[#24352A]'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      {entry.group === 'Quick Actions' ? (
                        <PlusCircle className="h-4 w-4 shrink-0 text-[#245C3A]" />
                      ) : (
                        <Compass className="h-4 w-4 shrink-0 text-[#6F9478]" />
                      )}
                      <div className="min-w-0">
                        <div className="truncate text-xs font-semibold">
                          {highlightMatch(entry.title, debouncedQuery)}
                        </div>
                        <div className="truncate text-[11px] text-[#66756A]">
                          {highlightMatch(entry.subtitle, debouncedQuery)}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {entry.status && (
                        <span className="rounded bg-[#F4F0E4] px-1.5 py-0.5 text-[10px] font-semibold text-[#17452C]">
                          {entry.status}
                        </span>
                      )}
                      <ArrowRight className="h-3.5 w-3.5 text-[#8A958C]" />
                    </div>
                  </button>
                );
              })}
            </div>
          ))}
        </div>

        {/* Footer Hints */}
        <div className="flex items-center justify-between border-t border-[#E1E7DD] bg-[#FAFBF8] px-4 py-2 text-[11px] text-[#66756A]">
          <span>↑↓ Navigate • ↵ Open • Esc Close</span>
          <span className="font-mono text-[10px]">Ctrl + K / Cmd + K</span>
        </div>
      </div>
    </div>
  );
};
