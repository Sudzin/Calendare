import React, { useState, useRef, useEffect } from 'react';
import { ArrowUpDown, Check, ChevronDown, Filter, RotateCcw } from 'lucide-react';
import { Task, TaskPriority } from '../../types';
import { PRIORITY_META } from '../../utils/priorityUtils';
import { sound } from '../../utils/sound';

export type PriorityFilterValue = 'all' | TaskPriority;
export type PrioritySortValue = 'default' | 'critical-first' | 'low-first';

interface PriorityFilterDropdownProps {
  filter: PriorityFilterValue;
  sort: PrioritySortValue;
  onFilterChange: (filter: PriorityFilterValue) => void;
  onSortChange: (sort: PrioritySortValue) => void;
  tasks?: Task[];
  className?: string;
}

export const PriorityFilterDropdown: React.FC<PriorityFilterDropdownProps> = ({
  filter,
  sort,
  onFilterChange,
  onSortChange,
  tasks = [],
  className = '',
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleOutsideClick);
    }
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, [isOpen]);

  // Close on Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        setIsOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  const priorityCounts = React.useMemo(() => {
    const counts: Record<PriorityFilterValue, number> = {
      all: tasks.length,
      critical: 0,
      high: 0,
      medium: 0,
      low: 0,
    };
    tasks.forEach(t => {
      if (counts[t.priority] !== undefined) {
        counts[t.priority]++;
      }
    });
    return counts;
  }, [tasks]);

  const isFilterActive = filter !== 'all';
  const isSortActive = sort !== 'default';
  const hasCustomSetting = isFilterActive || isSortActive;

  const currentFilterMeta = isFilterActive ? PRIORITY_META[filter] : null;

  const handleReset = (e: React.MouseEvent) => {
    e.stopPropagation();
    sound.playClick();
    onFilterChange('all');
    onSortChange('default');
  };

  return (
    <div ref={containerRef} className={`relative inline-block text-xs ${className}`}>
      {/* Hidden synchronized native select for testability & accessibility */}
      <select
        aria-label="Фильтр по приоритету и сортировка"
        data-testid="priority-filter-dropdown"
        value={
          filter !== 'all'
            ? filter
            : sort === 'critical-first'
            ? 'critical-first'
            : sort === 'low-first'
            ? 'low-first'
            : 'all'
        }
        onChange={e => {
          const val = e.target.value.toLowerCase();
          if (val === 'critical' || val === 'high' || val === 'medium' || val === 'low') {
            onFilterChange(val as TaskPriority);
            onSortChange('critical-first');
          } else if (val === 'critical-first') {
            onFilterChange('all');
            onSortChange('critical-first');
          } else if (val === 'low-first') {
            onFilterChange('all');
            onSortChange('low-first');
          } else {
            onFilterChange('all');
            onSortChange('default');
          }
        }}
        className="sr-only"
      >
        <option value="all">Все приоритеты (All)</option>
        <option value="critical">Critical (Критический)</option>
        <option value="high">High (Высокий)</option>
        <option value="medium">Medium (Средний)</option>
        <option value="low">Low (Низкий)</option>
        <option value="critical-first">Сортировка: Critical → Low</option>
        <option value="low-first">Сортировка: Low → Critical</option>
      </select>

      {/* Main Trigger Button */}
      <button
        type="button"
        onClick={() => {
          sound.playTap();
          setIsOpen(!isOpen);
        }}
        aria-expanded={isOpen}
        aria-haspopup="true"
        className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border transition-all ${
          hasCustomSetting
            ? 'bg-[var(--color-surface-hover)] border-[var(--color-accent)]/50 text-[var(--color-text-primary)] shadow-xs'
            : 'bg-[var(--color-surface)]/60 border-[var(--color-border)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:border-[var(--color-border-glass)]'
        }`}
      >
        {isSortActive ? (
          <ArrowUpDown className="w-3 h-3 text-[var(--color-accent)]" />
        ) : (
          <Filter className="w-3 h-3 text-[var(--color-text-muted)]" />
        )}

        {isFilterActive && currentFilterMeta ? (
          <span className="flex items-center gap-1">
            <span
              className="w-2 h-2 rounded-full inline-block"
              style={{ backgroundColor: currentFilterMeta.colorVar }}
            />
            <span className="font-medium text-[var(--color-text-primary)]">
              {currentFilterMeta.label}
            </span>
            <span className="text-[10px] text-[var(--color-text-muted)] font-mono">
              ({priorityCounts[filter]})
            </span>
          </span>
        ) : isSortActive ? (
          <span className="font-medium text-[var(--color-text-primary)]">
            {sort === 'critical-first' ? 'Critical → Low' : 'Low → Critical'}
          </span>
        ) : (
          <span>Приоритет: Все</span>
        )}

        <ChevronDown
          className={`w-3 h-3 text-[var(--color-text-muted)] transition-transform duration-150 ${
            isOpen ? 'rotate-180' : ''
          }`}
        />
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute right-0 mt-1.5 w-60 rounded-2xl glass-panel shadow-2xl border border-[var(--color-border-glass)] p-2 z-50 animate-in fade-in zoom-in-95 duration-150 text-xs">
          {/* Header & Reset */}
          <div className="flex items-center justify-between px-2 py-1 mb-1 border-b border-[var(--color-border)]/50 pb-1.5">
            <span className="text-[10px] font-semibold tracking-wider uppercase text-[var(--color-text-muted)]">
              Сортировка и фильтр
            </span>
            {hasCustomSetting && (
              <button
                type="button"
                onClick={handleReset}
                className="flex items-center gap-1 text-[10px] text-[var(--color-text-muted)] hover:text-[var(--color-priority-critical)] transition-colors"
                title="Сбросить фильтры"
              >
                <RotateCcw className="w-2.5 h-2.5" />
                <span>Сброс</span>
              </button>
            )}
          </div>

          {/* Section 1: Sort by Priority Level */}
          <div className="mb-2">
            <div className="px-2 py-0.5 text-[10px] font-medium text-[var(--color-text-secondary)]">
              Сортировка по уровню
            </div>
            <div className="space-y-0.5 mt-0.5">
              <button
                type="button"
                onClick={() => {
                  sound.playClick();
                  onSortChange('critical-first');
                  setIsOpen(false);
                }}
                className={`w-full flex items-center justify-between px-2 py-1.5 rounded-lg text-left transition-colors ${
                  sort === 'critical-first'
                    ? 'bg-[var(--color-surface-hover)] text-[var(--color-text-primary)] font-medium'
                    : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-surface)] hover:text-[var(--color-text-primary)]'
                }`}
              >
                <div className="flex items-center gap-2">
                  <div className="flex items-center -space-x-0.5">
                    <span className="w-2 h-2 rounded-full bg-[var(--color-priority-critical)]" />
                    <span className="w-2 h-2 rounded-full bg-[var(--color-priority-high)]" />
                    <span className="w-2 h-2 rounded-full bg-[var(--color-priority-medium)]" />
                    <span className="w-2 h-2 rounded-full bg-[var(--color-priority-low)]" />
                  </div>
                  <span>Critical → Low (убывание)</span>
                </div>
                {sort === 'critical-first' && (
                  <Check className="w-3.5 h-3.5 text-[var(--color-accent)]" />
                )}
              </button>

              <button
                type="button"
                onClick={() => {
                  sound.playClick();
                  onSortChange('low-first');
                  setIsOpen(false);
                }}
                className={`w-full flex items-center justify-between px-2 py-1.5 rounded-lg text-left transition-colors ${
                  sort === 'low-first'
                    ? 'bg-[var(--color-surface-hover)] text-[var(--color-text-primary)] font-medium'
                    : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-surface)] hover:text-[var(--color-text-primary)]'
                }`}
              >
                <div className="flex items-center gap-2">
                  <div className="flex items-center -space-x-0.5">
                    <span className="w-2 h-2 rounded-full bg-[var(--color-priority-low)]" />
                    <span className="w-2 h-2 rounded-full bg-[var(--color-priority-medium)]" />
                    <span className="w-2 h-2 rounded-full bg-[var(--color-priority-high)]" />
                    <span className="w-2 h-2 rounded-full bg-[var(--color-priority-critical)]" />
                  </div>
                  <span>Low → Critical (возрастание)</span>
                </div>
                {sort === 'low-first' && (
                  <Check className="w-3.5 h-3.5 text-[var(--color-accent)]" />
                )}
              </button>

              {sort !== 'default' && (
                <button
                  type="button"
                  onClick={() => {
                    sound.playClick();
                    onSortChange('default');
                  }}
                  className="w-full flex items-center justify-between px-2 py-1 rounded-lg text-left text-[11px] text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)] transition-colors"
                >
                  <span>По умолчанию (время)</span>
                </button>
              )}
            </div>
          </div>

          <div className="border-t border-[var(--color-border)]/50 my-1" />

          {/* Section 2: Filter by Priority Level */}
          <div>
            <div className="px-2 py-0.5 text-[10px] font-medium text-[var(--color-text-secondary)]">
              Фильтр по приоритету
            </div>
            <div className="space-y-0.5 mt-0.5">
              {/* All */}
              <button
                type="button"
                onClick={() => {
                  sound.playClick();
                  onFilterChange('all');
                  setIsOpen(false);
                }}
                className={`w-full flex items-center justify-between px-2 py-1.5 rounded-lg text-left transition-colors ${
                  filter === 'all'
                    ? 'bg-[var(--color-surface-hover)] text-[var(--color-text-primary)] font-medium'
                    : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-surface)] hover:text-[var(--color-text-primary)]'
                }`}
              >
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full border border-[var(--color-border)] bg-[var(--color-app-bg)]" />
                  <span>Все приоритеты</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] font-mono text-[var(--color-text-muted)]">
                    {priorityCounts.all}
                  </span>
                  {filter === 'all' && (
                    <Check className="w-3.5 h-3.5 text-[var(--color-accent)]" />
                  )}
                </div>
              </button>

              {/* Critical */}
              <button
                type="button"
                onClick={() => {
                  sound.playClick();
                  onFilterChange('critical');
                  setIsOpen(false);
                }}
                className={`w-full flex items-center justify-between px-2 py-1.5 rounded-lg text-left transition-colors ${
                  filter === 'critical'
                    ? 'bg-[var(--color-priority-critical)]/15 text-[var(--color-priority-critical)] font-medium border border-[var(--color-priority-critical)]/30'
                    : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-priority-critical)]/10 hover:text-[var(--color-priority-critical)]'
                }`}
              >
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-[var(--color-priority-critical)] shadow-xs" />
                  <span className="font-medium">Critical (Критический)</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] font-mono px-1.5 py-0.2 rounded-full bg-[var(--color-priority-critical)]/10 text-[var(--color-priority-critical)] font-medium">
                    {priorityCounts.critical}
                  </span>
                  {filter === 'critical' && (
                    <Check className="w-3.5 h-3.5 text-[var(--color-priority-critical)]" />
                  )}
                </div>
              </button>

              {/* High */}
              <button
                type="button"
                onClick={() => {
                  sound.playClick();
                  onFilterChange('high');
                  setIsOpen(false);
                }}
                className={`w-full flex items-center justify-between px-2 py-1.5 rounded-lg text-left transition-colors ${
                  filter === 'high'
                    ? 'bg-[var(--color-priority-high)]/15 text-[var(--color-priority-high)] font-medium border border-[var(--color-priority-high)]/30'
                    : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-priority-high)]/10 hover:text-[var(--color-priority-high)]'
                }`}
              >
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-[var(--color-priority-high)] shadow-xs" />
                  <span className="font-medium">High (Высокий)</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] font-mono px-1.5 py-0.2 rounded-full bg-[var(--color-priority-high)]/10 text-[var(--color-priority-high)] font-medium">
                    {priorityCounts.high}
                  </span>
                  {filter === 'high' && (
                    <Check className="w-3.5 h-3.5 text-[var(--color-priority-high)]" />
                  )}
                </div>
              </button>

              {/* Medium */}
              <button
                type="button"
                onClick={() => {
                  sound.playClick();
                  onFilterChange('medium');
                  setIsOpen(false);
                }}
                className={`w-full flex items-center justify-between px-2 py-1.5 rounded-lg text-left transition-colors ${
                  filter === 'medium'
                    ? 'bg-[var(--color-priority-medium)]/15 text-[var(--color-priority-medium)] font-medium border border-[var(--color-priority-medium)]/30'
                    : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-priority-medium)]/10 hover:text-[var(--color-priority-medium)]'
                }`}
              >
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-[var(--color-priority-medium)] shadow-xs" />
                  <span className="font-medium">Medium (Средний)</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] font-mono px-1.5 py-0.2 rounded-full bg-[var(--color-priority-medium)]/10 text-[var(--color-priority-medium)] font-medium">
                    {priorityCounts.medium}
                  </span>
                  {filter === 'medium' && (
                    <Check className="w-3.5 h-3.5 text-[var(--color-priority-medium)]" />
                  )}
                </div>
              </button>

              {/* Low */}
              <button
                type="button"
                onClick={() => {
                  sound.playClick();
                  onFilterChange('low');
                  setIsOpen(false);
                }}
                className={`w-full flex items-center justify-between px-2 py-1.5 rounded-lg text-left transition-colors ${
                  filter === 'low'
                    ? 'bg-[var(--color-priority-low)]/15 text-[var(--color-priority-low)] font-medium border border-[var(--color-priority-low)]/30'
                    : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-priority-low)]/10 hover:text-[var(--color-priority-low)]'
                }`}
              >
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-[var(--color-priority-low)] shadow-xs" />
                  <span className="font-medium">Low (Низкий)</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] font-mono px-1.5 py-0.2 rounded-full bg-[var(--color-priority-low)]/10 text-[var(--color-priority-low)] font-medium">
                    {priorityCounts.low}
                  </span>
                  {filter === 'low' && (
                    <Check className="w-3.5 h-3.5 text-[var(--color-priority-low)]" />
                  )}
                </div>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
