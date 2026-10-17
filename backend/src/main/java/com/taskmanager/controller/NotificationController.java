package com.taskmanager.controller;

import com.taskmanager.entity.Notification;
import com.taskmanager.repository.NotificationRepository;
import com.taskmanager.service.NotificationDecisionService;
import com.taskmanager.util.UserResolver;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/notifications")
@CrossOrigin(origins = "*")
public class NotificationController {

    private final NotificationRepository notificationRepository;
    private final NotificationDecisionService notificationDecisionService;
    private final UserResolver userResolver;

    public NotificationController(
            NotificationRepository notificationRepository,
            NotificationDecisionService notificationDecisionService,
            UserResolver userResolver) {
        this.notificationRepository = notificationRepository;
        this.notificationDecisionService = notificationDecisionService;
        this.userResolver = userResolver;
    }

    /**
     * Lấy danh sách toàn bộ thông báo từ CSDL của người dùng hiện tại
     * Tự động kích hoạt Thuật toán Quyết định Thông báo phân tích công việc & lịch trình thực tế
     */
    @GetMapping
    public ResponseEntity<List<Notification>> getNotifications(HttpServletRequest request) {
        Long userId = userResolver.resolveUserId(request);
        List<Notification> list = notificationDecisionService.evaluateAndGenerateNotifications(userId);
        return ResponseEntity.ok(list);
    }

    /**
     * Kích hoạt chạy thuật toán quyết định thông báo thủ công
     */
    @PostMapping("/evaluate")
    public ResponseEntity<List<Notification>> evaluateNotifications(HttpServletRequest request) {
        Long userId = userResolver.resolveUserId(request);
        List<Notification> list = notificationDecisionService.evaluateAndGenerateNotifications(userId);
        return ResponseEntity.ok(list);
    }

    /**
     * Lấy số lượng thông báo chưa đọc từ CSDL
     */
    @GetMapping("/unread-count")
    public ResponseEntity<Map<String, Object>> getUnreadCount(HttpServletRequest request) {
        Long userId = userResolver.resolveUserId(request);
        notificationDecisionService.evaluateAndGenerateNotifications(userId);
        long count = notificationRepository.countByUserIdAndIsReadFalse(userId);
        return ResponseEntity.ok(Map.of("unreadCount", count));
    }

    /**
     * Cập nhật trạng thái đã đọc cho một thông báo cụ thể trong CSDL
     */
    @PutMapping("/{id}/read")
    public ResponseEntity<?> markAsRead(@PathVariable Long id, HttpServletRequest request) {
        Long userId = userResolver.resolveUserId(request);
        return notificationRepository.findByIdAndUserId(id, userId)
                .map(n -> {
                    n.setIsRead(true);
                    n.setUpdatedAt(OffsetDateTime.now());
                    Notification updated = notificationRepository.save(n);
                    return ResponseEntity.ok(updated);
                })
                .orElse(ResponseEntity.notFound().build());
    }

    /**
     * Đánh dấu toàn bộ thông báo của người dùng là đã đọc trong CSDL
     */
    @PutMapping("/read-all")
    @Transactional
    public ResponseEntity<?> markAllAsRead(HttpServletRequest request) {
        Long userId = userResolver.resolveUserId(request);
        notificationRepository.markAllAsReadByUserId(userId);
        return ResponseEntity.ok(Map.of("success", true, "message", "Đã đánh dấu tất cả thông báo là đã đọc trong CSDL"));
    }

    /**
     * Xóa một thông báo khỏi CSDL
     */
    @DeleteMapping("/{id}")
    @Transactional
    public ResponseEntity<?> deleteNotification(@PathVariable Long id, HttpServletRequest request) {
        Long userId = userResolver.resolveUserId(request);
        return notificationRepository.findByIdAndUserId(id, userId)
                .map(n -> {
                    notificationRepository.delete(n);
                    return ResponseEntity.ok(Map.of("success", true, "message", "Đã xóa thông báo khỏi CSDL"));
                })
                .orElse(ResponseEntity.notFound().build());
    }

    /**
     * Xóa toàn bộ thông báo của người dùng khỏi CSDL
     */
    @DeleteMapping("/clear-all")
    @Transactional
    public ResponseEntity<?> clearAllNotifications(HttpServletRequest request) {
        Long userId = userResolver.resolveUserId(request);
        notificationRepository.deleteByUserId(userId);
        return ResponseEntity.ok(Map.of("success", true, "message", "Đã xóa toàn bộ thông báo khỏi CSDL"));
    }

    /**
     * Tạo thông báo mới vào CSDL
     */
    @PostMapping
    public ResponseEntity<Notification> createNotification(@RequestBody Map<String, Object> body, HttpServletRequest request) {
        Long userId = userResolver.resolveUserId(request);
        String title = (String) body.getOrDefault("title", "Thông báo mới");
        String message = (String) body.getOrDefault("message", "");
        String type = (String) body.getOrDefault("type", "reminder");
        Long taskId = body.get("taskId") != null ? Long.valueOf(body.get("taskId").toString()) : null;

        Notification notification = Notification.builder()
                .userId(userId)
                .taskId(taskId)
                .title(title)
                .message(message)
                .type(type)
                .isRead(false)
                .createdAt(OffsetDateTime.now())
                .updatedAt(OffsetDateTime.now())
                .build();

        Notification saved = notificationRepository.save(notification);
        return ResponseEntity.ok(saved);
    }
}
