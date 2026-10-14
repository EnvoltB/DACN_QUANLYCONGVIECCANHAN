import { CheckSquare, Clock, Sparkles } from 'lucide-react';
import { UserStats } from '../types';

interface StatsBarProps {
  stats: UserStats;
}

export default function StatsBar({ stats }: StatsBarProps) {
  return (
    <div className="stats-bar">
      <div className="stat-card">
        <div className="stat-icon stat-icon-purple">
          <CheckSquare size={20} />
        </div>
        <div className="stat-content">
          <span className="stat-label">Công việc tuần này</span>
          <span className="stat-value">{stats.totalTasksThisWeek}</span>
          <span className="stat-sub">{stats.completedTasks} đã hoàn thành</span>
        </div>
      </div>

      <div className="stat-card">
        <div className="stat-icon stat-icon-blue">
          <Clock size={20} />
        </div>
        <div className="stat-content">
          <span className="stat-label">Thời gian tập trung</span>
          <span className="stat-value">{stats.focusHours} giờ</span>
          <span className="stat-sub">{stats.focusLabel}</span>
        </div>
      </div>

      <div className="stat-card">
        <div className="stat-icon stat-icon-green">
          <Sparkles size={20} />
        </div>
        <div className="stat-content">
          <span className="stat-label">Khoảng trống phù hợp</span>
          <span className="stat-value">{stats.freeSlots}</span>
          <span className="stat-sub">Sẵn sàng để AI xếp</span>
        </div>
      </div>
    </div>
  );
}
