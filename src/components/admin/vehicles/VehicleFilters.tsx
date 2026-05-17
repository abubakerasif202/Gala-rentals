import React from 'react';
import { Search, SlidersHorizontal } from 'lucide-react';

type VehicleFilter = 'active' | 'all' | 'archived';

interface VehicleFiltersProps {
  activeCount: number;
  activeFilter: VehicleFilter;
  allCount: number;
  archivedCount: number;
  onFilterChange: (value: VehicleFilter) => void;
  onSearchChange: (value: string) => void;
  searchTerm: string;
}

const filterOptions: Array<{ key: VehicleFilter; label: string }> = [
  { key: 'all', label: 'All' },
  { key: 'active', label: 'Active' },
  { key: 'archived', label: 'Archived' },
];

export default function VehicleFilters({
  activeCount,
  activeFilter,
  allCount,
  archivedCount,
  onFilterChange,
  onSearchChange,
  searchTerm,
}: VehicleFiltersProps) {
  const counts: Record<VehicleFilter, number> = {
    active: activeCount,
    all: allCount,
    archived: archivedCount,
  };

  return (
    <div className="space-y-4 rounded-[28px] border border-white/10 bg-white/[0.04] p-4 sm:p-5">
      <div className="flex items-center gap-3">
        <div className="rounded-2xl border border-white/10 bg-white/5 p-3 text-brand-gold">
          <SlidersHorizontal className="h-4 w-4" />
        </div>
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-brand-grey">
            Fleet Filters
          </p>
          <p className="mt-1 text-sm text-white">Search or narrow the fleet view in one place.</p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {filterOptions.map((option) => {
          const isActive = option.key === activeFilter;

          return (
            <button
              key={option.key}
              type="button"
              onClick={() => onFilterChange(option.key)}
              className={`inline-flex min-h-11 items-center gap-3 rounded-2xl border px-4 py-3 text-[10px] font-bold uppercase tracking-[0.22em] transition-all ${
                isActive
                  ? 'border-brand-gold bg-brand-gold text-brand-navy'
                  : 'border-white/10 bg-white/5 text-brand-grey hover:border-white/20 hover:bg-white/10 hover:text-white'
              }`}
            >
              <span>{option.label}</span>
              <span
                className={`rounded-full px-2 py-1 text-[9px] ${
                  isActive ? 'bg-brand-navy/10 text-brand-navy' : 'bg-white/10 text-white'
                }`}
              >
                {counts[option.key]}
              </span>
            </button>
          );
        })}
      </div>

      <label className="flex items-center gap-3 rounded-2xl border border-white/10 bg-brand-navy/50 px-4 py-4 transition-all focus-within:border-brand-gold">
        <Search className="h-4 w-4 text-brand-grey" />
        <input
          value={searchTerm}
          onChange={(event) => onSearchChange(event.target.value)}
          placeholder="Search vehicles by name"
          className="w-full bg-transparent text-sm text-white outline-none placeholder:text-brand-grey"
        />
      </label>
    </div>
  );
}
