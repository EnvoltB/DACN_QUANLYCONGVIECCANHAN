package com.taskmanager.repository;

import com.taskmanager.entity.Notification;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface NotificationRepository extends JpaRepository<Notification, Long> {

    List<Notification> findByUserIdOrderByCreatedAtDesc(Long userId);

    long countByUserIdAndIsReadFalse(Long userId);

    Optional<Notification> findByIdAndUserId(Long id, Long userId);

    void deleteByUserId(Long userId);

    @Modifying
    @Query("UPDATE Notification n SET n.isRead = true, n.updatedAt = CURRENT_TIMESTAMP WHERE n.userId = :userId AND n.isRead = false")
    void markAllAsReadByUserId(@Param("userId") Long userId);

    boolean existsByUserIdAndTaskIdAndTypeAndCreatedAtAfter(Long userId, Long taskId, String type, java.time.OffsetDateTime after);

    boolean existsByUserIdAndTitleAndCreatedAtAfter(Long userId, String title, java.time.OffsetDateTime after);
}
