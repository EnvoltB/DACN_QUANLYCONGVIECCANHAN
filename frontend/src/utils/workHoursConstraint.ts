/**
 * Tiện ích kiểm tra ràng buộc giờ làm việc & khoảng nghỉ theo thiết lập người dùng.
 * Hỗ trợ hiển thị cảnh báo: "Bạn có muốn tạo việc làm ngoài giờ nghỉ?"
 */

export interface WorkHoursValidationResult {
  isOutsideWorkHours: boolean;
  reason?: string;
  promptTitle: string;
  promptMessage: string;
  workStart: string;
  workEnd: string;
  lunchStart: string;
  lunchEnd: string;
}

export function getUserSettings() {
  const DEFAULT_SETTINGS = {
    workingDays: ['MON', 'TUE', 'WED', 'THU', 'FRI'],
    workHours: '07:00 - 20:00',
    lunchBreak: '12:00 - 13:00',
    bufferMinutes: '15 phút',
    allowWeekend: true,
  };

  try {
    const saved = localStorage.getItem('smarttask_settings_full');
    if (saved) {
      const parsed = JSON.parse(saved);
      return { ...DEFAULT_SETTINGS, ...parsed };
    }
    const legacy = localStorage.getItem('smarttask_preferences');
    if (legacy) {
      const p = JSON.parse(legacy);
      return {
        ...DEFAULT_SETTINGS,
        workingDays: p.workingDays || DEFAULT_SETTINGS.workingDays,
        workHours: `${p.workStartTime || '07:00'} - ${p.workEndTime || '20:00'}`,
        bufferMinutes: `${p.bufferTime || 15} phút`,
      };
    }
  } catch (e) {
    console.error('Error reading user settings:', e);
  }
  return DEFAULT_SETTINGS;
}

function timeStringToMinutes(timeStr: string): number {
  if (!timeStr) return 0;
  const parts = timeStr.trim().split(':');
  const h = parseInt(parts[0], 10) || 0;
  const m = parseInt(parts[1], 10) || 0;
  return h * 60 + m;
}

/**
 * Kiểm tra xem công việc có vi phạm ràng buộc giờ làm việc, nghỉ trưa hoặc ngày nghỉ cuối tuần không
 */
export function checkWorkHoursConstraint(
  startTimeIsoOrStr: string,
  endTimeIsoOrStr: string,
  categoryType: string = 'WORK'
): WorkHoursValidationResult {
  const settings = getUserSettings();

  const [workStart, workEnd] = settings.workHours.split('-').map((s: string) => s.trim() || '07:00');
  const [lunchStart, lunchEnd] = settings.lunchBreak.split('-').map((s: string) => s.trim() || '12:00');

  const workStartMin = timeStringToMinutes(workStart || '07:00');
  const workEndMin = timeStringToMinutes(workEnd || '20:00');
  const lunchStartMin = timeStringToMinutes(lunchStart || '12:00');
  const lunchEndMin = timeStringToMinutes(lunchEnd || '13:00');

  const startDate = new Date(startTimeIsoOrStr);
  const endDate = new Date(endTimeIsoOrStr);

  const taskStartMin = startDate.getHours() * 60 + startDate.getMinutes();
  let taskEndMin = endDate.getHours() * 60 + endDate.getMinutes();
  if (taskEndMin === 0 && endDate.getDate() !== startDate.getDate()) {
    taskEndMin = 24 * 60; // 24:00
  }

  const dayOfWeekIndex = startDate.getDay(); // 0 = SUN, 1 = MON, ..., 6 = SAT
  const dayCodeMap = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
  const currentDayCode = dayCodeMap[dayOfWeekIndex];

  const isWorkingDay = (settings.workingDays || []).includes(currentDayCode);
  const isWeekend = dayOfWeekIndex === 0 || dayOfWeekIndex === 6;

  let isOutside = false;
  let reason = '';

  // 1. Kiểm tra vượt quá thời gian kết thúc (task kết thúc sau workEnd)
  if (taskEndMin > workEndMin) {
    isOutside = true;
    const taskEndStr = `${String(Math.floor(taskEndMin / 60)).padStart(2, '0')}:${String(taskEndMin % 60).padStart(2, '0')}`;
    reason = `Thời gian kết thúc (${taskEndStr}) vượt quá giờ làm việc quy định (${workEnd}).`;
  }
  // 2. Bắt đầu trước giờ làm việc
  else if (taskStartMin < workStartMin) {
    isOutside = true;
    const taskStartStr = `${String(Math.floor(taskStartMin / 60)).padStart(2, '0')}:${String(taskStartMin % 60).padStart(2, '0')}`;
    reason = `Thời gian bắt đầu (${taskStartStr}) sớm hơn giờ làm việc quy định (${workStart}).`;
  }
  // 3. Trùng giờ nghỉ trưa
  else if (taskStartMin < lunchEndMin && taskEndMin > lunchStartMin) {
    isOutside = true;
    reason = `Công việc rơi vào khung giờ nghỉ trưa (${lunchStart} – ${lunchEnd}).`;
  }
  // 4. Ngày nghỉ cuối tuần (T7, CN)
  else if (!isWorkingDay && isWeekend) {
    const isLeisure = categoryType === 'HEALTH' || categoryType === 'ENTERTAINMENT';
    // Nếu cho phép Sức khỏe & Giải trí vào cuối tuần trong khung 08:00 - 18:00
    if (settings.allowWeekend && isLeisure && taskStartMin >= 480 && taskEndMin <= 1080) {
      isOutside = false;
    } else {
      isOutside = true;
      if (!isLeisure) {
        reason = `Hôm nay là ngày nghỉ cuối tuần, khung giờ ưu tiên nghỉ ngơi cho Học tập và Công việc.`;
      } else {
        reason = `Khung giờ cuối tuần cho Sức khỏe & Giải trí được đề xuất từ 08:00 đến 18:00.`;
      }
    }
  }

  return {
    isOutsideWorkHours: isOutside,
    reason,
    promptTitle: 'Tạo việc làm ngoài giờ nghỉ',
    promptMessage: 'Bạn có muốn tạo việc làm ngoài giờ nghỉ?',
    workStart,
    workEnd,
    lunchStart,
    lunchEnd,
  };
}
