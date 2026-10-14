import { useState, useEffect, useCallback } from 'react';
import { Search, Bell, ChevronRight, LogIn, UserCheck, X } from 'lucide-react';
import ThemeToggle from './ThemeToggle';
import NotificationDropdown from './NotificationDropdown';
import { notificationService } from '../services/notificationService';

interface TopBarProps {
  currentDateText?: string;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  theme: 'light' | 'dark';
  onToggleTheme: () => void;
  currentUser: { email: string; fullName: string; role: string } | null;
  onOpenAuthModal: () => void;
  onSelectTask?: (taskId: number) => void;
  workspaceName?: string;
  activeNavTitle?: string;
}

function formatGmt7Time(date: Date): string {
  // Format live GMT+7 time
  const dayNames = ['Chủ Nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy'];
  const dayName = dayNames[date.getDay()];
  const day = date.getDate();
  const month = date.getMonth() + 1;
  const hours = date.getHours().toString().padStart(2, '0');
  const minutes = date.getMinutes().toString().padStart(2, '0');
  return `${dayName}, ${day} thg ${month} · ${hours}:${minutes} (GMT+7)`;
}

export default function TopBar({
  searchQuery,
  onSearchChange,
  theme,
  onToggleTheme,
  currentUser,
  onOpenAuthModal,
  onSelectTask,
  workspaceName = 'Không gian cá nhân',
  activeNavTitle = 'Lịch của tôi',
}: TopBarProps) {
  const [isNotificationOpen, setIsNotificationOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState<number>(0);

  const loadUnreadCount = useCallback(async () => {
    try {
      const count = await notificationService.getUnreadCount();
      setUnreadCount(count);
    } catch (err) {
      console.error('Lỗi lấy số thông báo chưa đọc từ CSDL:', err);
    }
  }, []);

  useEffect(() => {
    loadUnreadCount();
    const interval = setInterval(loadUnreadCount, 25000);
    return () => clearInterval(interval);
  }, [currentUser, loadUnreadCount]);

  // Live GMT+7 Clock
  const [timeText, setTimeText] = useState(() => formatGmt7Time(new Date()));

  useEffect(() => {
    const interval = setInterval(() => {
      setTimeText(formatGmt7Time(new Date()));
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // Close notification dropdown when clicking outside
  useEffect(() => {
    if (!isNotificationOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('.notification-container')) {
        setIsNotificationOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isNotificationOpen]);

  return (
    <header className="top-bar">
      {/* ── Breadcrumb ── */}
      <div className="breadcrumb">
        <span>{workspaceName}</span>
        <ChevronRight size={14} className="breadcrumb-sep" />
        <span className="breadcrumb-current">{activeNavTitle}</span>
      </div>

      {/* ── Actions: Search, Theme Toggle, Notification, Auth, Date ── */}
      <div className="top-bar-actions">
        {/* Search box - 2 shortcut kbd icons removed as requested */}
        <div className="search-box">
          <Search size={15} style={{ color: '#94A3B8', flexShrink: 0 }} />
          <input
            type="text"
            placeholder="Tìm công việc, lịch hẹn..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => onSearchChange('')}
              title="Xóa tìm kiếm"
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--text-muted)',
                cursor: 'pointer',
                padding: 2,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <X size={14} />
            </button>
          )}
        </div>

        {/* Cần gạt Dark Mode / Light Mode hiệu ứng đẹp */}
        <ThemeToggle theme={theme} onToggle={onToggleTheme} />

        {/* Notifications Bell Container */}
        <div className="notification-container" style={{ position: 'relative' }}>
          <button
            className="icon-btn"
            title={unreadCount > 0 ? `Quản lý thông báo (${unreadCount} chưa đọc)` : 'Quản lý thông báo'}
            aria-label="Thông báo"
            onClick={() => setIsNotificationOpen(!isNotificationOpen)}
          >
            <Bell size={18} />
            {unreadCount > 0 && (
              <span
                className="notification-dot"
                title={`${unreadCount} thông báo chưa đọc`}
              />
            )}
          </button>

          {/* Interactive Notifications Panel */}
          <NotificationDropdown
            isOpen={isNotificationOpen}
            onClose={() => setIsNotificationOpen(false)}
            onSelectTask={onSelectTask}
            onUnreadCountChange={(count) => setUnreadCount(count)}
          />
        </div>

        {/* Auth button */}
        {currentUser ? (
          <button
            onClick={onOpenAuthModal}
            className="auth-status-btn logged-in"
            title={`Đang đăng nhập: ${currentUser.email} (${currentUser.role})`}
          >
            <UserCheck size={15} style={{ color: 'var(--success)' }} />
            <span className="auth-user-name">{currentUser.fullName}</span>
          </button>
        ) : (
          <button
            onClick={onOpenAuthModal}
            className="auth-status-btn login-btn"
            title="Đăng nhập / Đăng ký"
          >
            <LogIn size={15} />
            <span>Đăng nhập</span>
          </button>
        )}

        {/* Chuẩn giờ GMT+7 thời gian thực */}
        <div className="date-display" title="Giờ địa phương GMT+7 (Asia/Ho_Chi_Minh)">
          {timeText}
        </div>
      </div>
    </header>
  );
}
