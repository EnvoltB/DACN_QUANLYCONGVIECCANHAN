import { ChevronLeft, ChevronRight, ChevronDown, SlidersHorizontal } from 'lucide-react';
import { ViewMode, Category } from '../types';

interface CalendarControlsProps {
  currentWeekText: string;
  viewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;
  onPrevWeek: () => void;
  onNextWeek: () => void;
  onToday: () => void;
  categories: Category[];
  selectedCategory: string | null;
  onToggleCategory: (categoryName: string) => void;
  statusFilter: string;
  onStatusFilterChange: (status: string) => void;
}

export default function CalendarControls({
  currentWeekText = '12 – 18 tháng 10, 2026',
  viewMode,
  onViewModeChange,
  onPrevWeek,
  onNextWeek,
  onToday,
  categories,
  selectedCategory,
  onToggleCategory,
  statusFilter,
  onStatusFilterChange,
}: CalendarControlsProps) {
  return (
    <div className="calendar-controls">
      {/* ── Left side: Date navigation & View mode ── */}
      <div className="controls-left">
        <div className="date-range">
          <span>{currentWeekText}</span>
          <button className="date-nav-btn" onClick={onPrevWeek} title="Tuần trước" aria-label="Tuần trước">
            <ChevronLeft size={16} />
          </button>
          <button className="date-nav-btn" onClick={onNextWeek} title="Tuần sau" aria-label="Tuần sau">
            <ChevronRight size={16} />
          </button>
        </div>

        <button className="today-btn" onClick={onToday}>
          Hôm nay
        </button>

        <div className="view-toggle">
          <button
            className={`view-btn ${viewMode === 'day' ? 'active' : ''}`}
            onClick={() => onViewModeChange('day')}
          >
            Ngày
          </button>
          <button
            className={`view-btn ${viewMode === 'week' ? 'active' : ''}`}
            onClick={() => onViewModeChange('week')}
          >
            Tuần
          </button>
          <button
            className={`view-btn ${viewMode === 'month' ? 'active' : ''}`}
            onClick={() => onViewModeChange('month')}
          >
            Tháng
          </button>
        </div>
      </div>

      {/* ── Right side: Categories legend & Status filter ── */}
      <div className="controls-right">
        <div className="legend">
          {categories.map((cat) => {
            const isInactive = selectedCategory && selectedCategory !== cat.name;
            return (
              <div
                key={cat.id}
                className="legend-item"
                style={{ opacity: isInactive ? 0.35 : 1 }}
                onClick={() => onToggleCategory(cat.name)}
                title={`Lọc theo ${cat.name}`}
              >
                <span className="legend-dot" style={{ background: cat.colorCode }} />
                <span>{cat.name}</span>
              </div>
            );
          })}
        </div>

        <div className="filter-dropdown-wrapper">
          <button
            className="filter-btn"
            onClick={() => {
              const nextStatus = statusFilter === 'ALL' ? 'TODO' : statusFilter === 'TODO' ? 'IN_PROGRESS' : statusFilter === 'IN_PROGRESS' ? 'COMPLETED' : 'ALL';
              onStatusFilterChange(nextStatus);
            }}
          >
            <SlidersHorizontal size={14} />
            <span>
              {statusFilter === 'ALL' && 'Tất cả trạng thái'}
              {statusFilter === 'TODO' && 'Cần làm'}
              {statusFilter === 'IN_PROGRESS' && 'Đang làm'}
              {statusFilter === 'COMPLETED' && 'Đã hoàn thành'}
            </span>
            <ChevronDown size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}
