package com.taskmanager.service;

import com.taskmanager.entity.Notification;
import com.taskmanager.entity.Task;
import com.taskmanager.entity.TimeBlock;
import com.taskmanager.entity.User;
import com.taskmanager.repository.NotificationRepository;
import com.taskmanager.repository.TaskRepository;
import com.taskmanager.repository.TimeBlockRepository;
import com.taskmanager.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.time.OffsetDateTime;
import java.time.format.DateTimeFormatter;
import java.util.*;

/**
 * Thuật toán Quyết định Thông báo Tự động (Smart Notification Decision Engine)
 * Thuật toán này phân tích toàn bộ dữ liệu thực tế từ CSDL
 * (Tasks, Deadlines, TimeBlocks, Trạng thái hoàn thành, Tải công việc, Xung đột lịch và Thời gian thực)
 * để tự động đưa ra các quyết định tạo thông báo phù hợp, lưu trữ vào CSDL PostgreSQL.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class NotificationDecisionService {

    private final TaskRepository taskRepository;
    private final TimeBlockRepository timeBlockRepository;
    private final NotificationRepository notificationRepository;
    private final UserRepository userRepository;

    private static final DateTimeFormatter TIME_FORMATTER = DateTimeFormatter.ofPattern("HH:mm");
    private static final DateTimeFormatter DATE_TIME_FORMATTER = DateTimeFormatter.ofPattern("HH:mm 'ngày' dd/MM");

    /**
     * Chạy định kỳ nền mỗi 2 phút cho tất cả người dùng trong hệ thống
     */
    @Scheduled(fixedDelay = 120000)
    public void scheduledEvaluationForAllUsers() {
        try {
            List<User> users = userRepository.findAll();
            for (User u : users) {
                evaluateAndGenerateNotifications(u.getId());
            }
        } catch (Exception e) {
            log.error("Lỗi khi chạy quét định kỳ thuật toán thông báo: {}", e.getMessage());
        }
    }

    @Transactional
    public List<Notification> evaluateAndGenerateNotifications(Long userId) {
        log.info("Running Notification Decision Engine for userId: {}", userId);
        OffsetDateTime now = OffsetDateTime.now();
        OffsetDateTime deduplicationCutoff = now.minusHours(8); // Khử trùng lặp trong vòng 8 tiếng

        List<Task> allTasks = taskRepository.findByUserId(userId);
        List<TimeBlock> allBlocks = timeBlockRepository.findByUserId(userId);

        List<Notification> newlyGenerated = new ArrayList<>();

        // Map task id to list of time blocks
        Map<Long, List<TimeBlock>> taskBlockMap = new HashMap<>();
        for (TimeBlock b : allBlocks) {
            if (b.getTaskId() != null) {
                taskBlockMap.computeIfAbsent(b.getTaskId(), k -> new ArrayList<>()).add(b);
            }
        }

        // ── THUẬT TOÁN 1: PHÁT HIỆN CÔNG VIỆC QUÁ HẠN (OVERDUE DETECTION ALGORITHM) ──
        for (Task task : allTasks) {
            if ("COMPLETED".equalsIgnoreCase(task.getStatus()) || "CANCELLED".equalsIgnoreCase(task.getStatus())) {
                continue;
            }

            OffsetDateTime due = task.getDueDate();
            if (due == null && task.getFixedEndTime() != null) {
                due = task.getFixedEndTime();
            }

            if (due != null) {
                if (due.isBefore(now)) {
                    // Task có due_date đã quá hạn!
                    long hoursOverdue = Math.max(1, Duration.between(due, now).toHours());
                    String timeUnit = hoursOverdue >= 24 ? (hoursOverdue / 24) + " ngày" : hoursOverdue + " giờ";

                    boolean alreadyNotified = notificationRepository.existsByUserIdAndTaskIdAndTypeAndCreatedAtAfter(
                            userId, task.getId(), "alert", deduplicationCutoff);

                    if (!alreadyNotified) {
                        Notification overdueNotice = Notification.builder()
                                .userId(userId)
                                .taskId(task.getId())
                                .type("alert")
                                .title("⚠️ Quá hạn deadline: " + task.getTitle())
                                .message("Công việc này đã trễ hạn " + timeUnit + " (hạn chót: " + due.format(DATE_TIME_FORMATTER) + "). Hãy ưu tiên xử lý hoặc sử dụng Trợ lý AI để dời lịch!")
                                .isRead(false)
                                .createdAt(now)
                                .updatedAt(now)
                                .build();
                        newlyGenerated.add(overdueNotice);
                    }
                } else {
                    // ── THUẬT TOÁN 2: CẢNH BÁO DEADLINE SẮP ĐẾN TRONG VÒNG 12 TIẾNG (IMMINENT DEADLINE ALGORITHM) ──
                    long hoursUntilDue = Duration.between(now, due).toHours();
                    if (hoursUntilDue <= 12) {
                        boolean alreadyNotified = notificationRepository.existsByUserIdAndTaskIdAndTypeAndCreatedAtAfter(
                                userId, task.getId(), "alert", deduplicationCutoff);

                        if (!alreadyNotified) {
                            String remainingText = hoursUntilDue <= 1 
                                    ? Duration.between(now, due).toMinutes() + " phút nữa" 
                                    : hoursUntilDue + " giờ nữa";
                            Notification imminentNotice = Notification.builder()
                                    .userId(userId)
                                    .taskId(task.getId())
                                    .type("alert")
                                    .title("⏳ Sắp đến hạn chót: " + task.getTitle())
                                    .message("Hạn chót vào lúc " + due.format(TIME_FORMATTER) + " hôm nay (còn khoảng " + remainingText + "). Hãy tập trung hoàn thành đúng tiến độ.")
                                    .isRead(false)
                                    .createdAt(now)
                                    .updatedAt(now)
                                    .build();
                            newlyGenerated.add(imminentNotice);
                        }
                    }
                }
            } else {
                // Kiểm tra nếu task chưa xong mà khối thời gian của nó đã kết thúc trong quá khứ (> 2 giờ trước)
                List<TimeBlock> blocks = taskBlockMap.get(task.getId());
                if (blocks != null && !blocks.isEmpty()) {
                    for (TimeBlock b : blocks) {
                        if (b.getEndTime() != null && b.getEndTime().isBefore(now.minusHours(1))) {
                            String titleKey = "⚠️ Quá hạn lịch trình: " + task.getTitle();
                            boolean alreadyNotified = notificationRepository.existsByUserIdAndTitleAndCreatedAtAfter(
                                    userId, titleKey, deduplicationCutoff);
                            if (!alreadyNotified) {
                                Notification blockOverdueNotice = Notification.builder()
                                        .userId(userId)
                                        .taskId(task.getId())
                                        .type("alert")
                                        .title(titleKey)
                                        .message("Khung giờ của công việc này đã kết thúc lúc " + b.getEndTime().format(TIME_FORMATTER) + " nhưng vẫn chưa được đánh dấu hoàn thành. Hãy cập nhật tiến độ!")
                                        .isRead(false)
                                        .createdAt(now)
                                        .updatedAt(now)
                                        .build();
                                newlyGenerated.add(blockOverdueNotice);
                                break;
                            }
                        }
                    }
                }
            }
        }

        // ── THUẬT TOÁN 3: NHẮC NHỞ LỊCH TRÌNH / CUỘC HẸN SẮP DIỄN RA (TIME-BLOCK REMINDER ALGORITHM) ──
        for (TimeBlock block : allBlocks) {
            OffsetDateTime start = block.getStartTime();
            if (start != null) {
                long minutesUntilStart = Duration.between(now, start).toMinutes();
                // Bắt đầu trong khoảng từ -10 phút đến +90 phút
                if (minutesUntilStart >= -10 && minutesUntilStart <= 90) {
                    String titleKey = "🔔 Nhắc nhở: " + block.getTitle();
                    boolean alreadyNotified = notificationRepository.existsByUserIdAndTitleAndCreatedAtAfter(
                            userId, titleKey, deduplicationCutoff);

                    if (!alreadyNotified) {
                        String timeDesc = minutesUntilStart > 0 
                                ? "sẽ bắt đầu lúc " + start.format(TIME_FORMATTER) + " (khoảng " + minutesUntilStart + " phút nữa)"
                                : "đang diễn ra (bắt đầu lúc " + start.format(TIME_FORMATTER) + ")";

                        Notification reminderNotice = Notification.builder()
                                .userId(userId)
                                .taskId(block.getTaskId())
                                .type("reminder")
                                .title(titleKey)
                                .message("Sự kiện/công việc \"" + block.getTitle() + "\" " + timeDesc + ". Hãy sẵn sàng chuyển sang trạng thái tập trung.")
                                .isRead(false)
                                .createdAt(now)
                                .updatedAt(now)
                                .build();
                        newlyGenerated.add(reminderNotice);
                    }
                }
            }
        }

        // ── THUẬT TOÁN 4: PHÁT HIỆN XUNG ĐỘT LỊCH TRÌNH (SCHEDULE CONFLICT DETECTION ALGORITHM) ──
        for (int i = 0; i < allBlocks.size(); i++) {
            TimeBlock b1 = allBlocks.get(i);
            if (b1.getStartTime() == null || b1.getEndTime() == null) continue;
            // Chỉ kiểm tra các block trong tương lai hoặc hôm nay
            if (b1.getEndTime().isBefore(now.minusHours(2))) continue;

            for (int j = i + 1; j < allBlocks.size(); j++) {
                TimeBlock b2 = allBlocks.get(j);
                if (b2.getStartTime() == null || b2.getEndTime() == null) continue;

                // Kiểm tra chồng lấn: start1 < end2 && start2 < end1
                if (b1.getStartTime().isBefore(b2.getEndTime()) && b2.getStartTime().isBefore(b1.getEndTime())) {
                    String conflictTitle = "⚠️ Xung đột lịch: " + b1.getTitle() + " & " + b2.getTitle();
                    boolean alreadyNotified = notificationRepository.existsByUserIdAndTitleAndCreatedAtAfter(
                            userId, conflictTitle, deduplicationCutoff);

                    if (!alreadyNotified) {
                        Notification conflictNotice = Notification.builder()
                                .userId(userId)
                                .type("alert")
                                .title(conflictTitle)
                                .message("Phát hiện 2 khối thời gian bị trùng nhau lúc " + b1.getStartTime().format(TIME_FORMATTER) + " - " + b1.getEndTime().format(TIME_FORMATTER) + ". Hãy dời lịch hoặc dùng Trợ lý AI để tự động tách lịch!")
                                .isRead(false)
                                .createdAt(now)
                                .updatedAt(now)
                                .build();
                        newlyGenerated.add(conflictNotice);
                    }
                }
            }
        }

        // ── THUẬT TOÁN 5: PHÂN TÍCH TẢI CÔNG VIỆC & ĐỀ XUẤT TỐI ƯU HÓA AI (WORKLOAD & AI ADVICE ALGORITHM) ──
        Set<Long> scheduledTaskIds = new HashSet<>();
        for (TimeBlock tb : allBlocks) {
            if (tb.getTaskId() != null) {
                scheduledTaskIds.add(tb.getTaskId());
            }
        }

        long unscheduledHighPriority = allTasks.stream()
                .filter(t -> !"COMPLETED".equalsIgnoreCase(t.getStatus()))
                .filter(t -> "URGENT".equalsIgnoreCase(t.getPriority()) || "HIGH".equalsIgnoreCase(t.getPriority()))
                .filter(t -> !scheduledTaskIds.contains(t.getId()))
                .count();

        if (unscheduledHighPriority > 0) {
            String aiTitle = "💡 Đề xuất tối ưu hóa từ Trợ lý AI SmartTask";
            boolean alreadyNotified = notificationRepository.existsByUserIdAndTitleAndCreatedAtAfter(
                    userId, aiTitle, deduplicationCutoff);

            if (!alreadyNotified) {
                Notification aiNotice = Notification.builder()
                        .userId(userId)
                        .type("ai")
                        .title(aiTitle)
                        .message("Phát hiện " + unscheduledHighPriority + " công việc ưu tiên cao chưa được ấn định khung giờ trên lịch. Hãy dùng Trợ lý AI để tự động lấp đầy vào các khoảng trống tối ưu.")
                        .isRead(false)
                        .createdAt(now)
                        .updatedAt(now)
                        .build();
                newlyGenerated.add(aiNotice);
            }
        }

        // ── THUẬT TOÁN 6: TỔNG KẾT NĂNG SUẤT & TUYÊN DƯƠNG THÀNH TÍCH (MILESTONE & PRODUCTIVITY ALGORITHM) ──
        long completedTasks = allTasks.stream().filter(t -> "COMPLETED".equalsIgnoreCase(t.getStatus())).count();
        if (allTasks.size() > 0 && completedTasks >= 1) {
            double completionRate = ((double) completedTasks / allTasks.size()) * 100;
            if (completionRate >= 30.0) {
                String successTitle = "🎉 Tiến độ năng suất đạt " + (int) completionRate + "%";
                boolean alreadyNotified = notificationRepository.existsByUserIdAndTitleAndCreatedAtAfter(
                        userId, successTitle, now.minusHours(24));

                if (!alreadyNotified) {
                    Notification successNotice = Notification.builder()
                            .userId(userId)
                            .type("success")
                            .title(successTitle)
                            .message("Bạn đã hoàn thành " + completedTasks + "/" + allTasks.size() + " công việc (" + String.format("%.0f", completionRate) + "%). Giữ vững phong độ tập trung này nhé!")
                            .isRead(false)
                            .createdAt(now)
                            .updatedAt(now)
                            .build();
                    newlyGenerated.add(successNotice);
                }
            }
        }

        // Lưu các thông báo vừa sinh vào CSDL PostgreSQL
        if (!newlyGenerated.isEmpty()) {
            notificationRepository.saveAll(newlyGenerated);
            log.info("Notification Decision Engine created {} new notifications for user {}", newlyGenerated.size(), userId);
        }

        return notificationRepository.findByUserIdOrderByCreatedAtDesc(userId);
    }
}
