import { useState, useEffect, useRef } from 'react';
import {
  Sparkles, Mic, MicOff, ArrowUp, Calendar as CalendarIcon,
  Flag, AlertTriangle, BookOpen, ExternalLink
} from 'lucide-react';
import { TimeBlock } from '../types';

interface AIAssistantPanelProps {
  onScheduleTask: (newTask: Partial<TimeBlock>) => void;
  onEditTaskDetails: (taskInfo: any) => void;
}

export default function AIAssistantPanel({
  onScheduleTask,
  onEditTaskDetails,
}: AIAssistantPanelProps) {
  const [inputText, setInputText] = useState(
    'Nhắc tôi làm báo cáo đồ án vào chiều mai lúc 3h'
  );
  const [isListening, setIsListening] = useState(false);
  const [speechError, setSpeechError] = useState<string | null>(null);

  // AI response state matching mockup
  const [showProposal, setShowProposal] = useState(true);
  const [isConfirmed, setIsConfirmed] = useState(false);

  const recognitionRef = useRef<any>(null);

  // Initialize Web Speech API if supported
  useEffect(() => {
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (SpeechRecognition) {
      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = true;
      recognition.lang = 'vi-VN'; // Vietnamese voice recognition

      recognition.onstart = () => {
        setIsListening(true);
        setSpeechError(null);
      };

      recognition.onresult = (event: any) => {
        const transcript = Array.from(event.results)
          .map((res: any) => res[0].transcript)
          .join('');
        setInputText(transcript);
      };

      recognition.onerror = (event: any) => {
        console.warn('Speech recognition error:', event.error);
        setIsListening(false);
        if (event.error === 'not-allowed') {
          setSpeechError('Vui lòng cấp quyền Microphone trên trình duyệt để nói.');
        } else {
          setSpeechError(`Lỗi mic (${event.error}). Đã chuyển về nhập chữ.`);
        }
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognitionRef.current = recognition;
    }
  }, []);

  // Handle Voice Toggle
  const toggleListening = () => {
    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
    } else {
      if (recognitionRef.current) {
        try {
          setSpeechError(null);
          recognitionRef.current.start();
        } catch (e) {
          // Already active or error, restart
          recognitionRef.current.stop();
          setTimeout(() => recognitionRef.current?.start(), 150);
        }
      } else {
        // Fallback for browsers without speech API
        setIsListening(true);
        setSpeechError('Trình duyệt chưa hỗ trợ Web Speech trực tiếp. Đang giả lập ghi âm...');
        setTimeout(() => {
          setInputText('Nhắc tôi tập thể dục 30 phút vào tối nay lúc 7h');
          setIsListening(false);
          setSpeechError(null);
        }, 2500);
      }
    }
  };

  // Handle Send
  const handleSend = () => {
    if (!inputText.trim()) return;
    setShowProposal(true);
    setIsConfirmed(false);
  };

  // Handle Confirm & Auto-reschedule to avoid conflict
  const handleConfirmAndReschedule = () => {
    // Schedule to alternative slot: 16:00 - 17:00 on Wed 14/10 (right after the conflict)
    onScheduleTask({
      title: 'Làm báo cáo đồ án',
      startTime: '2026-10-14T16:00:00',
      endTime: '2026-10-14T17:00:00',
      categoryType: 'WORK',
      status: 'TODO',
      isAutoScheduled: true,
    });
    setIsConfirmed(true);
  };

  return (
    <aside className="ai-panel">
      {/* ── Header ── */}
      <div className="ai-header">
        <div className="ai-header-left">
          <div className="ai-icon">
            <Sparkles size={20} />
          </div>
          <h3>Trợ lý SmartTask</h3>
        </div>
        <span className="ai-status">Sẵn sàng</span>
      </div>

      <p className="ai-welcome">
        Bạn nói điều cần làm. Mình tìm thời gian phù hợp, bạn quyết định.
      </p>

      {/* ── Input Card with Mic & Send ── */}
      <div style={{ padding: '0 20px 14px' }}>
        <div
          style={{
            background: '#FFFFFF',
            border: isListening ? '1.5px solid #EF4444' : '1px solid #E2E8F0',
            borderRadius: 12,
            padding: '12px 14px 10px',
            boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
            display: 'flex',
            flexDirection: 'column',
            gap: 12,
            transition: 'all 0.2s',
          }}
        >
          {/* Text input area */}
          <textarea
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            rows={2}
            placeholder="Nói hoặc gõ công việc cần làm..."
            style={{
              width: '100%',
              border: 'none',
              outline: 'none',
              resize: 'none',
              fontSize: '0.88rem',
              fontFamily: 'inherit',
              color: '#1E293B',
              lineHeight: 1.5,
              background: 'transparent',
            }}
          />

          {/* Speech recording banner if listening */}
          {isListening && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                fontSize: '0.78rem',
                color: '#EF4444',
                fontWeight: 600,
              }}
            >
              <span
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: '50%',
                  background: '#EF4444',
                  animation: 'pulse-mic 1s infinite',
                }}
              />
              <span>Đang lắng nghe giọng nói của bạn... Hãy nói câu lệnh</span>
            </div>
          )}

          {speechError && (
            <div style={{ fontSize: '0.72rem', color: '#DC2626' }}>
              {speechError}
            </div>
          )}

          {/* Bottom actions row: Mic button + Send button */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              paddingTop: 4,
            }}
          >
            {/* Mic button with text matching screenshot */}
            <button
              onClick={toggleListening}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                padding: '6px 10px',
                borderRadius: 8,
                fontSize: '0.82rem',
                color: isListening ? '#EF4444' : '#64748B',
                background: isListening ? '#FEF2F2' : '#F8FAFC',
                border: '1px solid',
                borderColor: isListening ? '#FCA5A5' : '#E2E8F0',
                fontWeight: 500,
                transition: 'all 0.2s',
              }}
              title="Nhấn để nói tiếng Việt"
            >
              {isListening ? (
                <MicOff size={16} style={{ color: '#EF4444' }} />
              ) : (
                <Mic size={16} style={{ color: '#6C5CE7' }} />
              )}
              <span>{isListening ? 'Dừng thu âm' : 'Nhập giọng nói'}</span>
            </button>

            {/* Send button */}
            <button
              onClick={handleSend}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 4,
                padding: '7px 16px',
                background: '#6C5CE7',
                color: '#FFFFFF',
                borderRadius: 8,
                fontSize: '0.82rem',
                fontWeight: 600,
                boxShadow: '0 1px 3px rgba(108,92,231,0.3)',
              }}
            >
              <ArrowUp size={15} strokeWidth={2.5} />
              <span>Gửi</span>
            </button>
          </div>
        </div>
      </div>

      {/* ── AI Reasoning & Proposal Card ── */}
      {showProposal && (
        <div style={{ padding: '0 20px', display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* Header divider */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              fontSize: '0.85rem',
              fontWeight: 600,
              color: '#334155',
            }}
          >
            <Sparkles size={16} style={{ color: '#6C5CE7' }} />
            <span>Mình đã hiểu như sau</span>
          </div>

          {/* Details Card */}
          <div
            style={{
              background: '#F8FAFC',
              border: '1px solid #E2E8F0',
              borderRadius: 12,
              padding: '14px',
              display: 'flex',
              flexDirection: 'column',
              gap: 8,
            }}
          >
            <div style={{ fontSize: '0.7rem', color: '#94A3B8', fontWeight: 600, letterSpacing: '0.04em' }}>
              CÔNG VIỆC
            </div>

            <div style={{ fontSize: '0.98rem', fontWeight: 700, color: '#0F172A' }}>
              Làm báo cáo đồ án
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.82rem', color: '#475569' }}>
              <CalendarIcon size={14} style={{ color: '#94A3B8' }} />
              <span>Thứ Tư, 14/10 · 15:00–16:00</span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.82rem', color: '#475569' }}>
              <Flag size={14} style={{ color: '#94A3B8' }} />
              <span>Ưu tiên: Trung bình</span>
            </div>

            <p style={{ fontSize: '0.74rem', color: '#94A3B8', lineHeight: 1.45, marginTop: 4 }}>
              Mặc định 60 phút và ưu tiên Trung bình. Bạn có thể chỉnh trước khi thêm.
            </p>

            {/* Amber Conflict Warning */}
            <div
              style={{
                marginTop: 6,
                background: '#FFF7ED',
                border: '1px solid #FED7AA',
                borderRadius: 8,
                padding: '10px 12px',
                display: 'flex',
                flexDirection: 'column',
                gap: 4,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#C2410C', fontWeight: 600, fontSize: '0.82rem' }}>
                <AlertTriangle size={15} />
                <span>Khung giờ này đang bận</span>
              </div>
              <p style={{ fontSize: '0.77rem', color: '#9A3412', lineHeight: 1.45, margin: 0 }}>
                Trùng với Họp nhóm đồ án, 15:00–16:00. Mình đã tìm 3 giờ thay thế.
              </p>
            </div>

            {/* Primary Action Button */}
            {!isConfirmed ? (
              <button
                onClick={handleConfirmAndReschedule}
                style={{
                  marginTop: 6,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                  padding: '10px 14px',
                  background: '#4F46E5',
                  color: '#FFFFFF',
                  borderRadius: 8,
                  fontWeight: 600,
                  fontSize: '0.86rem',
                  boxShadow: '0 2px 6px rgba(79,70,229,0.25)',
                  transition: 'background 0.2s',
                }}
              >
                <span>→ Xác nhận & chọn giờ khác</span>
              </button>
            ) : (
              <div
                style={{
                  marginTop: 6,
                  padding: '8px 12px',
                  background: '#ECFDF5',
                  color: '#065F46',
                  borderRadius: 8,
                  fontSize: '0.82rem',
                  fontWeight: 600,
                  textAlign: 'center',
                }}
              >
                ✓ Đã thêm vào lịch lúc 16:00–17:00!
              </div>
            )}

            {/* Secondary Action */}
            <button
              onClick={() =>
                onEditTaskDetails({
                  title: 'Làm báo cáo đồ án',
                  date: '2026-10-14',
                  startTime: '15:00',
                  endTime: '16:00',
                  priority: 'MEDIUM',
                })
              }
              style={{
                textAlign: 'center',
                color: '#6C5CE7',
                fontSize: '0.82rem',
                fontWeight: 500,
                padding: '4px 0',
                background: 'none',
              }}
            >
              Chỉnh sửa thông tin
            </button>
          </div>
        </div>
      )}

      {/* ── Suggestions Section (Bạn cũng có thể thử) ── */}
      <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div style={{ fontSize: '0.82rem', color: '#64748B', fontWeight: 500 }}>
          Bạn cũng có thể thử
        </div>

        <button
          onClick={() => {
            setInputText('Sắp xếp cho tôi 2 tiếng đọc sách trong tuần này');
            setShowProposal(true);
            setIsConfirmed(false);
          }}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            padding: '12px 14px',
            background: '#F8FAFC',
            border: '1px solid #E2E8F0',
            borderRadius: 10,
            textAlign: 'left',
            color: '#334155',
            fontSize: '0.83rem',
            lineHeight: 1.4,
            transition: 'all 0.15s',
          }}
        >
          <BookOpen size={16} style={{ color: '#6C5CE7', flexShrink: 0 }} />
          <span style={{ flex: 1 }}>Sắp xếp cho tôi 2 tiếng đọc sách trong tuần này</span>
          <ExternalLink size={14} style={{ color: '#94A3B8', flexShrink: 0 }} />
        </button>
      </div>

      {/* ── Footer Disclaimer ── */}
      <div
        style={{
          marginTop: 'auto',
          padding: '14px 20px',
          borderTop: '1px solid #F1F5F9',
          fontSize: '0.72rem',
          color: '#94A3B8',
          lineHeight: 1.5,
        }}
      >
        Mọi thay đổi đều cần bạn xác nhận. Nhập giọng nói được đề xuất cho ứng dụng di động.
      </div>
    </aside>
  );
}
