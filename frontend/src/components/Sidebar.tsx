import { useState, useEffect } from 'react';
import {
  Calendar, CheckSquare, Sparkles, Settings, ChevronDown, ChevronsUpDown,
  LogOut, UserCircle, Plus, Pencil, Trash2, Check, X
} from 'lucide-react';
import { Category } from '../types';
import { workspaceService, WorkspaceItem } from '../services/workspaceService';
import ConfirmModal from './ConfirmModal';

interface SidebarProps {
  categories: Category[];
  userName: string;
  activeNav: string;
  onNavChange: (nav: string) => void;
  selectedCategory: string | null;
  onSelectCategory: (categoryName: string | null) => void;
  onAddCategory: () => void;
  onEditCategory: (cat: Category) => void;
  onDeleteCategory: (id: number) => void;
  currentUser: { email: string; fullName: string; role: string } | null;
  onOpenAuthModal: () => void;
  onOpenSettingsModal: () => void;
  onLogout: () => void;
  activeWorkspace: WorkspaceItem | null;
  onWorkspaceChange: (ws: WorkspaceItem) => void;
  onShowToast?: (msg: string) => void;
}

export default function Sidebar({
  categories,
  userName,
  activeNav,
  onNavChange,
  selectedCategory,
  onSelectCategory,
  onAddCategory,
  onEditCategory,
  onDeleteCategory,
  currentUser,
  onOpenAuthModal,
  onOpenSettingsModal,
  onLogout,
  activeWorkspace,
  onWorkspaceChange,
  onShowToast,
}: SidebarProps) {
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [showWorkspaceMenu, setShowWorkspaceMenu] = useState(false);
  const [workspaces, setWorkspaces] = useState<WorkspaceItem[]>([]);

  const loadWorkspaces = async () => {
    try {
      const list = await workspaceService.getWorkspaces();
      if (list && list.length > 0) {
        setWorkspaces(list);
        if (!activeWorkspace || !list.some((w) => w.id === activeWorkspace.id)) {
          onWorkspaceChange(list[0]);
        }
      } else {
        setWorkspaces([]);
      }
    } catch (err) {
      console.error('Lỗi khi tải không gian làm việc từ CSDL:', err);
    }
  };

  useEffect(() => {
    loadWorkspaces();
  }, [currentUser]);

  const [editingWsId, setEditingWsId] = useState<number | null>(null);
  const [editingWsText, setEditingWsText] = useState('');
  const [isAddingWs, setIsAddingWs] = useState(false);
  const [newWsText, setNewWsText] = useState('');

  const handleStartEditWs = (ws: WorkspaceItem, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingWsId(ws.id);
    setEditingWsText(ws.name);
  };

  const handleSaveEditWs = async (ws: WorkspaceItem, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!editingWsText.trim()) return;
    try {
      const updated = await workspaceService.updateWorkspace(ws.id, editingWsText.trim());
      if (activeWorkspace?.id === ws.id) {
        onWorkspaceChange(updated);
      }
      setEditingWsId(null);
      await loadWorkspaces();
      onShowToast?.(`✓ Đã đổi tên không gian thành "${updated.name}"!`);
    } catch (err) {
      console.error('Lỗi khi sửa không gian:', err);
      onShowToast?.('Lỗi khi sửa tên không gian làm việc!');
    }
  };

  // In-App Confirm Delete Modal State (for both Workspace and Category)
  const [deleteTarget, setDeleteTarget] = useState<{
    type: 'workspace' | 'category';
    id: number;
    name: string;
    title: string;
    message: string;
    warningNote?: string;
  } | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleExecuteDelete = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    setDeleteError(null);

    if (deleteTarget.type === 'workspace') {
      try {
        await workspaceService.deleteWorkspace(deleteTarget.id);
        const remaining = workspaces.filter((w) => w.id !== deleteTarget.id);
        setWorkspaces(remaining);
        if (activeWorkspace?.id === deleteTarget.id && remaining.length > 0) {
          onWorkspaceChange(remaining[0]);
        }
        await loadWorkspaces();
        onShowToast?.(`✓ Đã xóa không gian "${deleteTarget.name}" thành công!`);
        setDeleteTarget(null);
      } catch (err: any) {
        console.error('Lỗi khi xóa không gian:', err);
        const msg = err.response?.data?.message || 'Lỗi khi xóa không gian làm việc khỏi CSDL';
        setDeleteError(msg);
        onShowToast?.(`⚠️ ${msg}`);
      } finally {
        setIsDeleting(false);
      }
    } else {
      // Category delete
      try {
        await onDeleteCategory(deleteTarget.id);
        setDeleteTarget(null);
      } catch (err: any) {
        console.error('Lỗi khi xóa nhóm:', err);
        const msg = err.response?.data?.message || 'Không thể xóa nhóm này vì đang có công việc đang sử dụng!';
        setDeleteError(msg);
      } finally {
        setIsDeleting(false);
      }
    }
  };

  const handleCreateWs = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newWsText.trim()) return;
    try {
      const created = await workspaceService.createWorkspace(newWsText.trim());
      onWorkspaceChange(created);
      setNewWsText('');
      setIsAddingWs(false);
      await loadWorkspaces();
      onShowToast?.(`✓ Đã tạo không gian làm việc mới "${created.name}"!`);
    } catch (err) {
      console.error('Lỗi khi tạo không gian:', err);
      onShowToast?.('Lỗi khi tạo không gian làm việc!');
    }
  };

  return (
    <aside className="sidebar">
      {/* ── Brand Logo ── */}
      <div className="sidebar-logo">
        <div className="logo-icon-svg">
          {/* Sound wave icon matching SmartTask brand */}
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
            <rect width="24" height="24" rx="7" fill="#6C5CE7" />
            <path d="M7 10V14M10 7V17M14 5V19M17 10V14" stroke="white" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </div>
        <span className="logo-text">SmartTask</span>
      </div>

      {/* ── Workspace Selector with Add, Edit, Delete ── */}
      <div style={{ position: 'relative', marginBottom: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <button
            className="workspace-selector"
            title="Chọn không gian làm việc"
            onClick={() => setShowWorkspaceMenu(!showWorkspaceMenu)}
            style={{ flex: 1, margin: 0 }}
          >
            <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {activeWorkspace?.name || 'Không gian cá nhân'}
            </span>
            <ChevronsUpDown size={15} style={{ color: '#94A3B8', flexShrink: 0 }} />
          </button>

          <button
            type="button"
            className="add-category-btn"
            onClick={() => {
              setShowWorkspaceMenu(true);
              setIsAddingWs(true);
            }}
            title="Thêm không gian làm việc mới"
            style={{
              width: 32,
              height: 32,
              flexShrink: 0,
              borderRadius: 8,
              border: '1px solid var(--border)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--text-muted)',
              cursor: 'pointer',
              background: 'var(--surface)',
            }}
          >
            <Plus size={15} />
          </button>
        </div>

        {/* Workspace Dropdown with Rename & Delete */}
        {showWorkspaceMenu && (
          <div
            style={{
              position: 'absolute',
              top: 'calc(100% + 4px)',
              left: 0,
              right: 0,
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: 12,
              padding: 6,
              boxShadow: 'var(--shadow-lg), 0 16px 28px rgba(0,0,0,0.15)',
              zIndex: 100,
              display: 'flex',
              flexDirection: 'column',
              gap: 4,
            }}
          >
            <div
              style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '4px 8px 6px',
              borderBottom: '1px solid var(--border-light)',
              fontSize: '0.72rem',
              fontWeight: 700,
              color: 'var(--text-muted)',
              letterSpacing: '0.04em',
              textTransform: 'uppercase',
            }}
          >
            <span>Không gian làm việc</span>
            <button
              type="button"
              onClick={() => setIsAddingWs(!isAddingWs)}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--primary)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 3,
                fontSize: '0.72rem',
                fontWeight: 600,
              }}
            >
              <Plus size={12} />
              <span>Thêm</span>
            </button>
          </div>

          {/* List of Workspaces */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2, maxHeight: 180, overflowY: 'auto' }}>
            {workspaces.map((ws) => {
              const isSelected = activeWorkspace?.id === ws.id;
              const isEditing = editingWsId === ws.id;

              if (isEditing) {
                return (
                  <div
                    key={ws.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 4,
                      padding: '4px 6px',
                      background: 'var(--border-light)',
                      borderRadius: 6,
                    }}
                  >
                    <input
                      type="text"
                      value={editingWsText}
                      onChange={(e) => setEditingWsText(e.target.value)}
                      autoFocus
                      style={{
                        flex: 1,
                        fontSize: '0.8rem',
                        padding: '3px 6px',
                        border: '1px solid var(--primary)',
                        borderRadius: 4,
                        background: 'var(--surface)',
                        color: 'var(--text)',
                        outline: 'none',
                      }}
                    />
                    <button
                      type="button"
                      onClick={(e) => handleSaveEditWs(ws, e)}
                      style={{ color: '#10B981', cursor: 'pointer', padding: 2 }}
                      title="Lưu tên"
                    >
                      <Check size={14} />
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditingWsId(null)}
                      style={{ color: 'var(--text-muted)', cursor: 'pointer', padding: 2 }}
                      title="Hủy"
                    >
                      <X size={14} />
                    </button>
                  </div>
                );
              }

              return (
                <div
                  key={ws.id}
                  onClick={() => {
                    onWorkspaceChange(ws);
                    setShowWorkspaceMenu(false);
                  }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '7px 8px',
                      borderRadius: 6,
                      fontSize: '0.8rem',
                      fontWeight: isSelected ? 700 : 500,
                      color: isSelected ? 'var(--primary)' : 'var(--text)',
                      background: isSelected ? 'var(--primary-bg)' : 'transparent',
                      cursor: 'pointer',
                      transition: 'background 0.15s',
                    }}
                  >
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
                      {ws.name}
                    </span>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 2, flexShrink: 0 }}>
                      {/* Pencil Edit button */}
                      <button
                        type="button"
                        className="cat-action-btn"
                        onClick={(e) => {
                          e.stopPropagation();
                          e.preventDefault();
                          handleStartEditWs(ws, e);
                        }}
                        title={`Sửa tên không gian "${ws.name}"`}
                        style={{
                          width: 24,
                          height: 24,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          cursor: 'pointer',
                          borderRadius: 4,
                        }}
                      >
                        <Pencil size={13} />
                      </button>

                      {/* Trash Delete button */}
                      {workspaces.length > 1 && (
                        <button
                          type="button"
                          className="cat-action-btn delete-btn"
                          onClick={(e) => {
                            e.stopPropagation();
                            e.preventDefault();
                            setDeleteError(null);
                            setDeleteTarget({
                              type: 'workspace',
                              id: ws.id,
                              name: ws.name,
                              title: 'Xóa không gian làm việc',
                              message: `Bạn có chắc chắn muốn xóa không gian "${ws.name}" khỏi cơ sở dữ liệu không?`,
                              warningNote: 'Lưu ý: Không thể xóa không gian nếu đang có công việc thuộc không gian này.',
                            });
                          }}
                          title={`Xóa không gian "${ws.name}"`}
                          style={{
                            width: 24,
                            height: 24,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            cursor: 'pointer',
                            borderRadius: 4,
                          }}
                        >
                          <Trash2 size={13} />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Inline Add Workspace form */}
            {isAddingWs && (
              <form onSubmit={handleCreateWs} style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '4px 6px' }}>
                <input
                  type="text"
                  placeholder="Tên không gian mới..."
                  value={newWsText}
                  onChange={(e) => setNewWsText(e.target.value)}
                  autoFocus
                  style={{
                    flex: 1,
                    fontSize: '0.8rem',
                    padding: '4px 8px',
                    border: '1px solid var(--border)',
                    borderRadius: 4,
                    background: 'var(--surface)',
                    color: 'var(--text)',
                    outline: 'none',
                  }}
                />
                <button
                  type="submit"
                  disabled={!newWsText.trim()}
                  style={{
                    background: 'var(--primary)',
                    color: '#fff',
                    border: 'none',
                    borderRadius: 4,
                    padding: '4px 8px',
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  Thêm
                </button>
                <button
                  type="button"
                  onClick={() => setIsAddingWs(false)}
                  style={{
                    background: 'none',
                    color: 'var(--text-muted)',
                    border: 'none',
                    cursor: 'pointer',
                    padding: 2,
                  }}
                >
                  <X size={14} />
                </button>
              </form>
            )}
          </div>
        )}
      </div>

      {/* ── Navigation ── */}
      <nav className="sidebar-nav">
        <button
          className={`nav-item ${activeNav === 'calendar' ? 'active' : ''}`}
          onClick={() => onNavChange('calendar')}
        >
          <Calendar size={18} />
          <span>Lịch của tôi</span>
        </button>

        <button
          className={`nav-item ${activeNav === 'tasks' ? 'active' : ''}`}
          onClick={() => onNavChange('tasks')}
        >
          <CheckSquare size={18} />
          <span>Công việc</span>
        </button>

        <button
          className={`nav-item ${activeNav === 'ai' ? 'active' : ''}`}
          onClick={() => onNavChange('ai')}
        >
          <Sparkles size={18} />
          <span>Trợ lý AI</span>
          <span className="nav-dot" style={{ background: '#6C5CE7' }} />
        </button>
      </nav>

      {/* ── Categories Section (NHÓM CỦA TÔI) with Add, Edit, Delete ── */}
      <div className="sidebar-section">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8, paddingRight: 4 }}>
          <h3 className="section-label" style={{ margin: 0 }}>NHÓM CỦA TÔI</h3>
          <button
            type="button"
            className="add-category-btn"
            onClick={onAddCategory}
            title="Thêm nhóm công việc mới"
          >
            <Plus size={14} />
          </button>
        </div>

        <div className="category-list">
          {categories.map((cat) => {
            const isSelected = selectedCategory === cat.name;
            return (
              <div
                key={cat.id}
                className={`category-item ${isSelected ? 'selected' : ''}`}
                onClick={() => onSelectCategory(isSelected ? null : cat.name)}
                style={{ position: 'relative' }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 0 }}>
                  <span className="category-dot" style={{ background: cat.colorCode }} />
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {cat.name}
                  </span>
                </div>

                {/* Edit Pencil & Trash Delete Buttons */}
                <div className="category-actions">
                  <button
                    type="button"
                    className="cat-action-btn"
                    title={`Chỉnh sửa nhóm "${cat.name}"`}
                    onClick={(e) => {
                      e.stopPropagation();
                      onEditCategory(cat);
                    }}
                  >
                    <Pencil size={12} />
                  </button>
                  <button
                    type="button"
                    className="cat-action-btn delete-btn"
                    title={`Xóa nhóm "${cat.name}"`}
                    onClick={(e) => {
                      e.stopPropagation();
                      e.preventDefault();
                      setDeleteError(null);
                      setDeleteTarget({
                        type: 'category',
                        id: cat.id,
                        name: cat.name,
                        title: 'Xóa nhóm công việc',
                        message: `Bạn có chắc chắn muốn xóa nhóm "${cat.name}" khỏi danh mục không?`,
                        warningNote: 'Lưu ý: Không thể xóa nhóm nếu đang có công việc sử dụng nhóm này.',
                      });
                    }}
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Info Card (Chừa chỗ cho điều quan trọng) ── */}
      <div className="sidebar-info-card">
        <div className="info-icon-wrapper">
          <Sparkles size={16} />
        </div>
        <div className="info-text">
          <strong>Chừa chỗ cho điều quan trọng.</strong>
          <p>Để SmartTask tìm thời gian trống, bạn giữ quyền quyết định.</p>
        </div>
      </div>

      {/* ── Settings Link ── */}
      <button
        className={`nav-item settings-link ${activeNav === 'settings' ? 'active' : ''}`}
        onClick={() => {
          onNavChange('settings');
          onOpenSettingsModal?.();
        }}
        style={{ cursor: 'pointer' }}
      >
        <Settings size={18} />
        <span>Tài khoản & Thiết lập</span>
      </button>

      {/* ── User Profile ── */}
      <div style={{ position: 'relative' }}>
        <div
          className="user-profile"
          onClick={() => setShowProfileMenu(!showProfileMenu)}
          style={{ cursor: 'pointer' }}
          title="Nhấp để xem tài khoản / Đăng xuất"
        >
          <div className="user-avatar">
            {userName.split(' ').map((w) => w[0]).join('').slice(0, 2)}
          </div>
          <div className="user-info">
            <span className="user-name">{userName}</span>
            <span className="user-role">
              {currentUser ? currentUser.role : 'Tài khoản cá nhân'}
            </span>
          </div>
          <ChevronDown
            size={15}
            style={{
              marginLeft: 'auto',
              color: '#94A3B8',
              transform: showProfileMenu ? 'rotate(180deg)' : 'none',
              transition: 'transform 0.2s',
            }}
          />
        </div>

        {/* Dropdown menu */}
        {showProfileMenu && (
          <div
            style={{
              position: 'absolute',
              bottom: 'calc(100% + 8px)',
              left: 0,
              right: 0,
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: 12,
              padding: 6,
              boxShadow: 'var(--shadow-lg)',
              zIndex: 100,
              display: 'flex',
              flexDirection: 'column',
              gap: 2,
            }}
          >
            {currentUser && (
              <div style={{ padding: '8px 10px', borderBottom: '1px solid var(--border-light)', fontSize: '0.75rem', color: 'var(--text-3)' }}>
                <div style={{ fontWeight: 600, color: 'var(--text)' }}>{currentUser.fullName}</div>
                <div style={{ fontSize: '0.72rem', opacity: 0.8 }}>{currentUser.email}</div>
              </div>
            )}
            <button
              onClick={() => {
                setShowProfileMenu(false);
                onNavChange('settings');
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '8px 10px',
                borderRadius: 8,
                fontSize: '0.82rem',
                color: 'var(--text)',
                textAlign: 'left',
              }}
              className="dropdown-item"
            >
              <Settings size={15} style={{ color: 'var(--primary)' }} />
              <span>Tài khoản & Thiết lập</span>
            </button>
            <button
              onClick={() => {
                setShowProfileMenu(false);
                onOpenAuthModal();
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '8px 10px',
                borderRadius: 8,
                fontSize: '0.82rem',
                color: 'var(--text)',
                textAlign: 'left',
              }}
              className="dropdown-item"
            >
              <UserCircle size={15} style={{ color: 'var(--primary)' }} />
              <span>{currentUser ? 'Chuyển tài khoản' : 'Đăng nhập / Đăng ký'}</span>
            </button>
            {currentUser && (
              <button
                onClick={() => {
                  setShowProfileMenu(false);
                  onLogout();
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '8px 10px',
                  borderRadius: 8,
                  fontSize: '0.82rem',
                  color: '#DC2626',
                  textAlign: 'left',
                }}
                className="dropdown-item"
              >
                <LogOut size={15} />
                <span>Đăng xuất</span>
              </button>
            )}
          </div>
        )}
      </div>

      {/* ── In-App Confirm Delete Modal ── */}
      <ConfirmModal
        isOpen={deleteTarget !== null}
        title={deleteTarget?.title || 'Xác nhận xóa'}
        message={deleteTarget?.message || ''}
        warningNote={deleteTarget?.warningNote}
        errorMessage={deleteError}
        confirmText={deleteTarget?.type === 'workspace' ? 'Xóa không gian' : 'Xóa nhóm việc'}
        isLoading={isDeleting}
        onConfirm={handleExecuteDelete}
        onCancel={() => {
          if (!isDeleting) {
            setDeleteTarget(null);
            setDeleteError(null);
          }
        }}
      />
    </aside>
  );
}
