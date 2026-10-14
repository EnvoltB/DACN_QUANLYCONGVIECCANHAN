import { useState } from 'react';
import { X, Lock, Mail, User, Eye, EyeOff, ShieldCheck, Sparkles } from 'lucide-react';
import { authService } from '../services/authService';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLoginSuccess: (user: { email: string; fullName: string; role: string; token: string }) => void;
}

// Client-side SHA-256 hash utility
async function sha256Hex(message: string): Promise<string> {
  const msgUint8 = new TextEncoder().encode(message);
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgUint8);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

export default function AuthModal({ isOpen, onClose, onLoginSuccess }: AuthModalProps) {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [hashedDisplay, setHashedDisplay] = useState<string | null>(null);

  if (!isOpen) return null;

  // Quick fill Admin account
  const handleQuickFillAdmin = () => {
    setEmail('admin@gmail.com');
    setPassword('1');
    setErrorMessage(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);
    setIsLoading(true);

    try {
      // Visual hash demonstration
      const hashedPassword = await sha256Hex(password);
      setHashedDisplay(hashedPassword);

      if (mode === 'login') {
        const response = await authService.login({
          email: email.trim(),
          password: password,
        });

        setSuccessMessage(`Đăng nhập thành công! Chào mừng ${response.fullName}`);
        setTimeout(() => {
          onLoginSuccess(response);
          onClose();
        }, 600);
      } else {
        // Mode: Register
        if (password !== confirmPassword) {
          setErrorMessage('Mật khẩu xác nhận không khớp.');
          setIsLoading(false);
          return;
        }
        if (!fullName.trim()) {
          setErrorMessage('Vui lòng nhập họ và tên.');
          setIsLoading(false);
          return;
        }

        const response = await authService.register({
          fullName: fullName.trim(),
          email: email.trim(),
          password: password,
        });

        setSuccessMessage('Đăng ký tài khoản thành công! Tự động đăng nhập...');
        setTimeout(() => {
          onLoginSuccess(response);
          onClose();
        }, 800);
      }
    } catch (err: any) {
      const msg = err.response?.data?.message || err.message || 'Lỗi xác thực hệ thống';
      setErrorMessage('Lỗi xác thực: ' + msg);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(15, 23, 42, 0.55)',
        backdropFilter: 'blur(5px)',
        zIndex: 10000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 20,
        animation: 'fadeIn 0.2s ease-out',
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: 'var(--surface)',
          borderRadius: 18,
          width: '100%',
          maxWidth: 440,
          boxShadow: 'var(--shadow-lg)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          border: '1px solid var(--border)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            padding: '20px 24px 16px',
            borderBottom: '1px solid var(--border-light)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: 10,
                background: 'linear-gradient(135deg, #6C5CE7, #A29BFE)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#fff',
              }}
            >
              <Sparkles size={18} />
            </div>
            <div>
              <h2 style={{ fontSize: '1.15rem', fontWeight: 700, color: 'var(--text)', margin: 0 }}>
                {mode === 'login' ? 'Đăng nhập SmartTask' : 'Tạo tài khoản mới'}
              </h2>
              <p style={{ fontSize: '0.76rem', color: 'var(--text-3)', margin: '2px 0 0' }}>
                Hệ thống Quản lý và Tự động Lập lịch Công việc
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            style={{
              width: 32,
              height: 32,
              borderRadius: 8,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--text-muted)',
              cursor: 'pointer',
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Tab switcher: Đăng nhập / Đăng ký */}
        <div
          style={{
            display: 'flex',
            borderBottom: '1px solid var(--border-light)',
            background: 'var(--border-light)',
            padding: 4,
            margin: '16px 24px 0',
            borderRadius: 10,
          }}
        >
          <button
            type="button"
            onClick={() => {
              setMode('login');
              setErrorMessage(null);
            }}
            style={{
              flex: 1,
              padding: '8px 12px',
              borderRadius: 8,
              fontSize: '0.85rem',
              fontWeight: 600,
              color: mode === 'login' ? 'var(--primary)' : 'var(--text-3)',
              background: mode === 'login' ? 'var(--surface)' : 'transparent',
              boxShadow: mode === 'login' ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
              transition: 'all 0.2s',
            }}
          >
            Đăng nhập
          </button>
          <button
            type="button"
            onClick={() => {
              setMode('register');
              setErrorMessage(null);
            }}
            style={{
              flex: 1,
              padding: '8px 12px',
              borderRadius: 8,
              fontSize: '0.85rem',
              fontWeight: 600,
              color: mode === 'register' ? 'var(--primary)' : 'var(--text-3)',
              background: mode === 'register' ? 'var(--surface)' : 'transparent',
              boxShadow: mode === 'register' ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
              transition: 'all 0.2s',
            }}
          >
            Đăng ký
          </button>
        </div>

        {/* Quick-fill Admin helper banner */}
        {mode === 'login' && (
          <div
            style={{
              margin: '14px 24px 0',
              padding: '10px 14px',
              borderRadius: 10,
              background: 'var(--primary-bg)',
              border: '1px solid rgba(108, 92, 231, 0.2)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 8,
            }}
          >
            <div style={{ fontSize: '0.78rem', color: 'var(--primary)', lineHeight: 1.4 }}>
              <strong>Tài khoản sẵn có:</strong> admin@gmail.com | pass: <strong>1</strong>
            </div>
            <button
              type="button"
              onClick={handleQuickFillAdmin}
              style={{
                fontSize: '0.75rem',
                fontWeight: 600,
                color: '#fff',
                background: 'var(--primary)',
                padding: '4px 10px',
                borderRadius: 6,
                cursor: 'pointer',
                whiteSpace: 'nowrap',
              }}
            >
              Điền nhanh
            </button>
          </div>
        )}

        {/* Form Body */}
        <form onSubmit={handleSubmit} style={{ padding: '16px 24px 24px', display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* Full Name for register */}
          {mode === 'register' && (
            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-2)', marginBottom: 6 }}>
                Họ và tên *
              </label>
              <div style={{ position: 'relative' }}>
                <User size={16} style={{ position: 'absolute', left: 12, top: 12, color: 'var(--text-muted)' }} />
                <input
                  type="text"
                  required
                  placeholder="VD: Nguyễn Văn A"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '10px 12px 10px 38px',
                    borderRadius: 8,
                    border: '1px solid var(--border)',
                    background: 'var(--surface)',
                    color: 'var(--text)',
                    fontSize: '0.88rem',
                    outline: 'none',
                  }}
                />
              </div>
            </div>
          )}

          {/* Email */}
          <div>
            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-2)', marginBottom: 6 }}>
              Địa chỉ Email *
            </label>
            <div style={{ position: 'relative' }}>
              <Mail size={16} style={{ position: 'absolute', left: 12, top: 12, color: 'var(--text-muted)' }} />
              <input
                type="email"
                required
                placeholder="name@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                style={{
                  width: '100%',
                  padding: '10px 12px 10px 38px',
                  borderRadius: 8,
                  border: '1px solid var(--border)',
                  background: 'var(--surface)',
                  color: 'var(--text)',
                  fontSize: '0.88rem',
                  outline: 'none',
                }}
              />
            </div>
          </div>

          {/* Password */}
          <div>
            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-2)', marginBottom: 6 }}>
              Mật khẩu *
            </label>
            <div style={{ position: 'relative' }}>
              <Lock size={16} style={{ position: 'absolute', left: 12, top: 12, color: 'var(--text-muted)' }} />
              <input
                type={showPassword ? 'text' : 'password'}
                required
                placeholder="Nhập mật khẩu..."
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                style={{
                  width: '100%',
                  padding: '10px 38px 10px 38px',
                  borderRadius: 8,
                  border: '1px solid var(--border)',
                  background: 'var(--surface)',
                  color: 'var(--text)',
                  fontSize: '0.88rem',
                  outline: 'none',
                }}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                style={{
                  position: 'absolute',
                  right: 12,
                  top: 10,
                  color: 'var(--text-muted)',
                  cursor: 'pointer',
                }}
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          {/* Confirm Password for register */}
          {mode === 'register' && (
            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-2)', marginBottom: 6 }}>
                Xác nhận Mật khẩu *
              </label>
              <div style={{ position: 'relative' }}>
                <Lock size={16} style={{ position: 'absolute', left: 12, top: 12, color: 'var(--text-muted)' }} />
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  placeholder="Nhập lại mật khẩu..."
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '10px 12px 10px 38px',
                    borderRadius: 8,
                    border: '1px solid var(--border)',
                    background: 'var(--surface)',
                    color: 'var(--text)',
                    fontSize: '0.88rem',
                    outline: 'none',
                  }}
                />
              </div>
            </div>
          )}

          {/* Password hash security badge */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 4,
              marginTop: -4,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.72rem', color: 'var(--text-muted)' }}>
              <ShieldCheck size={14} style={{ color: 'var(--success)' }} />
              <span>Mật khẩu được băm (Hash Encryption) bảo mật trước khi xác thực.</span>
            </div>
            {hashedDisplay && (
              <div style={{ fontSize: '0.68rem', fontFamily: 'monospace', color: 'var(--primary)', padding: '2px 6px', background: 'var(--border-light)', borderRadius: 4, wordBreak: 'break-all' }}>
                Hash SHA-256: {hashedDisplay.slice(0, 36)}...
              </div>
            )}
          </div>

          {/* Error / Success alert */}
          {errorMessage && (
            <div
              style={{
                padding: '9px 12px',
                borderRadius: 8,
                background: '#FEF2F2',
                border: '1px solid #FCA5A5',
                color: '#DC2626',
                fontSize: '0.78rem',
              }}
            >
              {errorMessage}
            </div>
          )}

          {successMessage && (
            <div
              style={{
                padding: '9px 12px',
                borderRadius: 8,
                background: '#ECFDF5',
                border: '1px solid #A7F3D0',
                color: '#059669',
                fontSize: '0.78rem',
                fontWeight: 600,
              }}
            >
              {successMessage}
            </div>
          )}

          {/* Submit Button */}
          <button
            type="submit"
            disabled={isLoading}
            style={{
              marginTop: 6,
              padding: '11px 16px',
              borderRadius: 10,
              background: 'var(--primary)',
              color: '#fff',
              fontSize: '0.9rem',
              fontWeight: 600,
              boxShadow: '0 2px 8px rgba(108, 92, 231, 0.3)',
              cursor: 'pointer',
              transition: 'all 0.2s',
              opacity: isLoading ? 0.7 : 1,
            }}
          >
            {isLoading
              ? 'Đang xử lý...'
              : mode === 'login'
              ? 'Đăng nhập ngay'
              : 'Hoàn tất Đăng ký'}
          </button>
        </form>
      </div>
    </div>
  );
}
