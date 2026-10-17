import { useState, useEffect, useRef } from 'react';
import {
  Sparkles, Mic, MicOff, ArrowUp, Calendar as CalendarIcon,
  Flag, AlertTriangle, BookOpen, ExternalLink, Loader2, CheckCircle2, Clock
} from 'lucide-react';
import { TimeBlock } from '../types';
import { aiService, AiParseTaskResponse } from '../services/aiService';
import { checkWorkHoursConstraint } from '../utils/workHoursConstraint';

interface AIAssistantPanelProps {
  onScheduleTask: (newTask: Partial<TimeBlock>) => void;
  onEditTaskDetails: (taskInfo: any) => void;
  currentDate?: Date;
}

export default function AIAssistantPanel({
  onScheduleTask,
  onEditTaskDetails,
  currentDate,
}: AIAssistantPanelProps) {
  const [inputText, setInputText] = useState(
    'Nhắc tôi làm báo cáo đồ án vào chiều mai lúc 3h'
  );
  const [isListening, setIsListening] = useState(false);
  const [speechError, setSpeechError] = useState<string | null>(null);

  // AI response state
  const [parsedTask, setParsedTask] = useState<AiParseTaskResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);
  const [isConfirmed, setIsConfirmed] = useState(false);
  const [offHoursPendingConfirm, setOffHoursPendingConfirm] = useState<{
    useAlternative: boolean;
    reason: string;
    promptMessage: string;
  } | null>(null);

  const recognitionRef = useRef<any>(null);

  // Helper: Chuyển đổi từ số nói tiếng Việt sang số (khi nói 1 thì luôn thành số 1)
  const convertSpokenWordsToNumbers = (text: string): string => {
    if (!text) return text;
    let res = text;
    // Chuyển đổi "một" thành "1" (theo yêu cầu: nói 1 thì sẽ luôn là số)
    res = res.replace(/(?:một|mốt)\s*(?:giờ|gio|h)\b/gi, '1h');
    res = res.replace(/(?:một|mốt)\s*(?:tiếng|tieng)\b/gi, '1 tiếng');
    res = res.replace(/(?:một|mốt)\s*(?:lịch|lich)\b/gi, '1 lịch');
    res = res.replace(/(?:một|mốt)\s*(?:ngày|ngay)\b/gi, '1 ngày');
    res = res.replace(/(?:một|mốt)\s*(?:phút|phut|p)\b/gi, '1 phút');
    res = res.replace(/(?:vào lúc|lúc|từ|đến|tới|khoảng|tầm)\s+(?:một|mốt)\b/gi, (match) => {
      return match.replace(/(?:một|mốt)/gi, '1');
    });
    res = res.replace(/\b(?:một|mốt)\b/gi, '1');

    // Chuyển đổi các số phổ biến khác: hai -> 2, ba -> 3...
    res = res.replace(/\bhai\s*(?:giờ|gio|h)\b/gi, '2h');
    res = res.replace(/\bhai\s*(?:tiếng|tieng)\b/gi, '2 tiếng');
    res = res.replace(/\bba\s*(?:giờ|gio|h)\b/gi, '3h');
    res = res.replace(/\bbốn\s*(?:giờ|gio|h)\b/gi, '4h');
    res = res.replace(/\bnăm\s*(?:giờ|gio|h)\b/gi, '5h');
    res = res.replace(/\bsáu\s*(?:giờ|gio|h)\b/gi, '6h');
    res = res.replace(/\bbảy\s*(?:giờ|gio|h)\b/gi, '7h');
    res = res.replace(/\btám\s*(?:giờ|gio|h)\b/gi, '8h');
    res = res.replace(/\bchín\s*(?:giờ|gio|h)\b/gi, '9h');
    res = res.replace(/\bmười\s*(?:giờ|gio|h)\b/gi, '10h');

    // Viết tắt giờ phút:
    res = res.replace(/\bhai\s*giờ\s*ba\s*mươi(?:\s*phút)?\b/gi, '2h30');
    res = res.replace(/\bhai\s*giờ\s*rưỡi\b/gi, '2h30');
    res = res.replace(/\b(\d+)\s*tiếng\s*rưỡi\b/gi, '$1 tiếng rưỡi');

    return res;
  };

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
        let transcript = Array.from(event.results)
          .map((res: any) => res[0].transcript)
          .join('');
        transcript = convertSpokenWordsToNumbers(transcript);
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
          recognitionRef.current.stop();
          setTimeout(() => recognitionRef.current?.start(), 150);
        }
      } else {
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

  // Execute AI Parsing
  const executeAiParse = async (promptText: string) => {
    if (!promptText.trim()) return;
    setIsLoading(true);
    setApiError(null);
    setIsConfirmed(false);
    setOffHoursPendingConfirm(null);

    try {
      let refIso: string | undefined = undefined;
      const baseDate = currentDate || new Date();
      const y = baseDate.getFullYear();
      const m = String(baseDate.getMonth() + 1).padStart(2, '0');
      const d = String(baseDate.getDate()).padStart(2, '0');
      const now = new Date();
      const hh = String(now.getHours()).padStart(2, '0');
      const mm = String(now.getMinutes()).padStart(2, '0');
      const ss = String(now.getSeconds()).padStart(2, '0');
      refIso = `${y}-${m}-${d}T${hh}:${mm}:${ss}+07:00`;
      const result = await aiService.parseTask(promptText.trim(), undefined, refIso);
      setParsedTask(result);
    } catch (err: any) {
      console.error('Lỗi phân tích AI:', err);
      setApiError('Không thể kết nối đến Trợ lý AI. Vui lòng kiểm tra Backend.');
    } finally {
      setIsLoading(false);
    }
  };

  // Initial load default preview on mount
  useEffect(() => {
    executeAiParse(inputText);
  }, []);

  // Handle Send button click
  const handleSend = () => {
    executeAiParse(inputText);
  };

  // Handle Confirm & Auto-reschedule or direct schedule
  const handleConfirmSchedule = (useAlternative: boolean = false, bypassOffHours: boolean = false) => {
    if (!parsedTask) return;

    const start = (useAlternative && parsedTask.suggestedAlternativeStartTime)
      ? parsedTask.suggestedAlternativeStartTime
      : parsedTask.startTime;

    const end = (useAlternative && parsedTask.suggestedAlternativeEndTime)
      ? parsedTask.suggestedAlternativeEndTime
      : parsedTask.endTime;

    // Ràng buộc kiểm tra ngoài giờ làm việc & giờ nghỉ
    if (!bypassOffHours) {
      const val = checkWorkHoursConstraint(start, end, parsedTask.categoryType);
      if (val.isOutsideWorkHours) {
        setOffHoursPendingConfirm({
          useAlternative,
          reason: val.reason || 'Thời gian công việc nằm ngoài giờ làm việc hoặc rơi vào giờ nghỉ.',
          promptMessage: val.promptMessage, // "Bạn có muốn tạo việc làm ngoài giờ nghỉ?"
        });
        return;
      }
    }

    onScheduleTask({
      title: parsedTask.title,
      startTime: start,
      endTime: end,
      categoryType: parsedTask.categoryType,
      status: 'TODO',
      isAutoScheduled: true,
      priority: parsedTask.priority,
    });
    setOffHoursPendingConfirm(null);
    setIsConfirmed(true);
  };

  const getPriorityLabel = (pri?: string) => {
    switch (pri) {
      case 'URGENT': return 'Khẩn cấp';
      case 'HIGH': return 'Cao';
      case 'LOW': return 'Thấp';
      default: return 'Trung bình';
    }
  };

  const getPriorityColor = (pri?: string) => {
    switch (pri) {
      case 'URGENT': return '#DC2626';
      case 'HIGH': return '#EA580C';
      case 'LOW': return '#16A34A';
      default: return '#2563EB';
    }
  };

  const getCategoryLabel = (cat?: string) => {
    switch (cat?.toUpperCase()) {
      case 'STUDY': return 'HỌC TẬP';
      case 'HEALTH': return 'SỨC KHỎE';
      case 'ENTERTAINMENT': return 'GIẢI TRÍ';
      case 'WORK':
      default: return 'CÔNG VIỆC';
    }
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
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
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
            {/* Mic button with text matching mockup */}
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
                cursor: 'pointer',
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
              disabled={isLoading || !inputText.trim()}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 4,
                padding: '7px 16px',
                background: isLoading ? '#94A3B8' : '#6C5CE7',
                color: '#FFFFFF',
                borderRadius: 8,
                fontSize: '0.82rem',
                fontWeight: 600,
                boxShadow: '0 1px 3px rgba(108,92,231,0.3)',
                cursor: isLoading ? 'not-allowed' : 'pointer',
                border: 'none',
                transition: 'all 0.2s',
              }}
            >
              {isLoading ? (
                <Loader2 size={15} className="animate-spin" />
              ) : (
                <ArrowUp size={15} strokeWidth={2.5} />
              )}
              <span>{isLoading ? 'Đang phân tích...' : 'Gửi'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* ── Loading Spinner State ── */}
      {isLoading && (
        <div
          style={{
            margin: '0 20px',
            padding: '16px',
            background: '#F8FAFC',
            border: '1px dashed #CBD5E1',
            borderRadius: 12,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 10,
            fontSize: '0.84rem',
            color: '#475569',
          }}
        >
          <Sparkles size={18} style={{ color: '#6C5CE7', animation: 'spin 2s linear infinite' }} />
          <span>Trợ lý SmartTask đang suy nghĩ và sắp xếp...</span>
        </div>
      )}

      {/* ── Error Banner ── */}
      {apiError && !isLoading && (
        <div
          style={{
            margin: '0 20px',
            padding: '12px',
            background: '#FEF2F2',
            border: '1px solid #FECACA',
            borderRadius: 10,
            color: '#B91C1C',
            fontSize: '0.8rem',
          }}
        >
          {apiError}
        </div>
      )}

      {/* ── AI Reasoning & Proposal Card ── */}
      {parsedTask && !isLoading && (
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
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div
                style={{
                  fontSize: '0.72rem',
                  color: parsedTask.categoryType === 'STUDY' ? '#7C3AED' : parsedTask.categoryType === 'HEALTH' ? '#059669' : parsedTask.categoryType === 'ENTERTAINMENT' ? '#D97706' : '#2563EB',
                  fontWeight: 700,
                  letterSpacing: '0.04em',
                }}
              >
                {getCategoryLabel(parsedTask.categoryType)}
              </div>
              <div
                style={{
                  fontSize: '0.72rem',
                  fontWeight: 600,
                  color: getPriorityColor(parsedTask.priority),
                  background: '#FFFFFF',
                  padding: '2px 8px',
                  borderRadius: 12,
                  border: '1px solid #E2E8F0',
                }}
              >
                {getPriorityLabel(parsedTask.priority)}
              </div>
            </div>

            <div style={{ fontSize: '0.98rem', fontWeight: 700, color: '#0F172A' }}>
              {parsedTask.title}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.82rem', color: '#475569' }}>
              <CalendarIcon size={14} style={{ color: '#94A3B8' }} />
              <span>{parsedTask.formattedDateLabel}</span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.82rem', color: '#475569' }}>
              <Flag size={14} style={{ color: '#94A3B8' }} />
              <span>Thời lượng ước tính: {parsedTask.estimatedDurationMinutes} phút</span>
            </div>

            <p style={{ fontSize: '0.74rem', color: '#94A3B8', lineHeight: 1.45, marginTop: 4 }}>
              {parsedTask.note || 'Mặc định bạn có thể chỉnh trước khi thêm.'}
            </p>

            {/* Cảnh báo ngoài giờ làm việc & giờ nghỉ theo thiết lập */}
            {(() => {
              const check = checkWorkHoursConstraint(parsedTask.startTime, parsedTask.endTime, parsedTask.categoryType);
              if (!check.isOutsideWorkHours) return null;
              return (
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
                    <Clock size={15} />
                    <span>Ngoài khung giờ làm việc đã thiết lập ({check.workStart}–{check.workEnd})</span>
                  </div>
                  <p style={{ fontSize: '0.77rem', color: '#9A3412', lineHeight: 1.45, margin: 0 }}>
                    {check.reason}
                  </p>
                  <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#EA580C', marginTop: 2 }}>
                    {check.promptMessage}
                  </div>
                </div>
              );
            })()}

            {/* Amber Conflict Warning */}
            {parsedTask.hasConflict && (
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
                  {parsedTask.conflictMessage}
                </p>
              </div>
            )}

            {/* Hộp xác nhận khi tạo việc ngoài giờ nghỉ */}
            {offHoursPendingConfirm && (
              <div
                style={{
                  marginTop: 8,
                  background: '#FFFBEB',
                  border: '1.5px solid #FCD34D',
                  borderRadius: 10,
                  padding: '12px 14px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 8,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#B45309', fontWeight: 700, fontSize: '0.85rem' }}>
                  <AlertTriangle size={16} />
                  <span>{offHoursPendingConfirm.promptMessage}</span>
                </div>
                <p style={{ fontSize: '0.78rem', color: '#78350F', margin: 0 }}>
                  {offHoursPendingConfirm.reason}
                </p>
                <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                  <button
                    onClick={() => setOffHoursPendingConfirm(null)}
                    style={{
                      flex: 1,
                      padding: '7px 10px',
                      background: '#FFFFFF',
                      border: '1px solid #D1D5DB',
                      borderRadius: 6,
                      fontSize: '0.8rem',
                      fontWeight: 600,
                      color: '#4B5563',
                      cursor: 'pointer',
                    }}
                  >
                    Hủy bỏ
                  </button>
                  <button
                    onClick={() => handleConfirmSchedule(offHoursPendingConfirm.useAlternative, true)}
                    style={{
                      flex: 1,
                      padding: '7px 10px',
                      background: '#D97706',
                      border: 'none',
                      borderRadius: 6,
                      fontSize: '0.8rem',
                      fontWeight: 600,
                      color: '#FFFFFF',
                      cursor: 'pointer',
                    }}
                  >
                    Đồng ý tạo ngoài giờ
                  </button>
                </div>
              </div>
            )}

            {/* Action Buttons */}
            {!isConfirmed && !offHoursPendingConfirm ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 6 }}>
                {parsedTask.hasConflict ? (
                  <>
                    {/* Nút chính ưu tiên: Tự động chuyển sang giờ trống tiếp theo để không chèn đè lên task trước */}
                    {parsedTask.suggestedAlternativeStartTime && (
                      <button
                        onClick={() => handleConfirmSchedule(true)}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: 6,
                          padding: '10px 14px',
                          background: '#4F46E5',
                          color: '#FFFFFF',
                          borderRadius: 8,
                          fontWeight: 600,
                          fontSize: '0.86rem',
                          boxShadow: '0 2px 6px rgba(79,70,229,0.25)',
                          cursor: 'pointer',
                          border: 'none',
                        }}
                      >
                        <span>⚡ Tự động chuyển sang giờ trống ({parsedTask.suggestedAlternativeStartTime.substring(11, 16)}–{parsedTask.suggestedAlternativeEndTime?.substring(11, 16)})</span>
                      </button>
                    )}

                    {/* Nút phụ: Giữ nguyên giờ trùng nếu người dùng chủ ý xếp chồng */}
                    <button
                      onClick={() => handleConfirmSchedule(false)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 6,
                        padding: '8px 12px',
                        background: '#FFF7ED',
                        color: '#C2410C',
                        border: '1px solid #FED7AA',
                        borderRadius: 8,
                        fontWeight: 600,
                        fontSize: '0.8rem',
                        cursor: 'pointer',
                      }}
                    >
                      <span>⚠️ Vẫn xếp chồng giờ này ({parsedTask.startTime.substring(11, 16)}–{parsedTask.endTime.substring(11, 16)})</span>
                    </button>
                  </>
                ) : (
                  <button
                    onClick={() => handleConfirmSchedule(false)}
                    style={{
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
                      cursor: 'pointer',
                      border: 'none',
                      transition: 'background 0.2s',
                    }}
                  >
                    <span>→ Xác nhận & thêm vào lịch</span>
                  </button>
                )}
              </div>
            ) : null}

            {isConfirmed && (
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
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 6,
                }}
              >
                <CheckCircle2 size={16} />
                <span>Đã thêm vào lịch thành công!</span>
              </div>
            )}

            {/* Secondary Action */}
            <button
              onClick={() => {
                const now = new Date();
                const defaultDateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
                const datePart = parsedTask.startTime ? parsedTask.startTime.substring(0, 10) : defaultDateStr;
                const startH = parsedTask.startTime ? parsedTask.startTime.substring(11, 16) : '15:00';
                const endH = parsedTask.endTime ? parsedTask.endTime.substring(11, 16) : '16:30';

                onEditTaskDetails({
                  title: parsedTask.title,
                  date: datePart,
                  startTime: startH,
                  endTime: endH,
                  priority: parsedTask.priority,
                  categoryType: parsedTask.categoryType,
                  estimatedDurationMinutes: parsedTask.estimatedDurationMinutes,
                });
              }}
              style={{
                textAlign: 'center',
                color: '#6C5CE7',
                fontSize: '0.82rem',
                fontWeight: 500,
                padding: '4px 0',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
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
            const prompt = 'Sắp xếp cho tôi 2 tiếng đọc sách vào sáng mai lúc 8h';
            setInputText(prompt);
            executeAiParse(prompt);
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
            cursor: 'pointer',
            transition: 'all 0.15s',
          }}
        >
          <BookOpen size={16} style={{ color: '#6C5CE7', flexShrink: 0 }} />
          <span style={{ flex: 1 }}>Sắp xếp cho tôi 2 tiếng đọc sách vào sáng mai lúc 8h</span>
          <ExternalLink size={14} style={{ color: '#94A3B8', flexShrink: 0 }} />
        </button>

        <button
          onClick={() => {
            const prompt = 'Nhắc tôi chạy bộ 45 phút vào 6h sáng thứ 2 tuần sau';
            setInputText(prompt);
            executeAiParse(prompt);
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
            cursor: 'pointer',
            transition: 'all 0.15s',
          }}
        >
          <Sparkles size={16} style={{ color: '#10B981', flexShrink: 0 }} />
          <span style={{ flex: 1 }}>Nhắc tôi chạy bộ 45 phút vào 6h sáng thứ 2 tuần sau</span>
          <ExternalLink size={14} style={{ color: '#94A3B8', flexShrink: 0 }} />
        </button>

        <button
          onClick={() => {
            const prompt = 'Hãy lặp cho tôi một lịch Tiếng Anh 2 vào lúc 1h đến 2h30p khoảng 1tiếng rưỡi chiều ngày hôm sau thứ 7';
            setInputText(prompt);
            executeAiParse(prompt);
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
            cursor: 'pointer',
            transition: 'all 0.15s',
          }}
        >
          <BookOpen size={16} style={{ color: '#7C3AED', flexShrink: 0 }} />
          <span style={{ flex: 1 }}>Lịch Tiếng Anh 1h đến 2h30 chiều (1 tiếng rưỡi)</span>
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
        Mọi thay đổi đều cần bạn xác nhận. Nhập giọng nói được hỗ trợ trực tiếp qua Web Speech API tiếng Việt.
      </div>
    </aside>
  );
}
