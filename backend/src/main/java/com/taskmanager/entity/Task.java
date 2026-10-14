package com.taskmanager.entity;

import jakarta.persistence.*;
import lombok.*;
import java.time.OffsetDateTime;

@Entity
@Table(name = "tasks")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Task {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "user_id", nullable = false)
    private Long userId;

    @Column(name = "workspace_id")
    private Long workspaceId;

    @Column(name = "category_id")
    private Long categoryId;

    @Column(nullable = false, length = 255)
    private String title;

    @Column(columnDefinition = "TEXT")
    private String description;

    @Column(length = 20)
    @Builder.Default
    private String priority = "MEDIUM"; // LOW, MEDIUM, HIGH, URGENT

    @Column(name = "eisenhower_quadrant", length = 20)
    @Builder.Default
    private String eisenhowerQuadrant = "SCHEDULE"; // DO_FIRST, SCHEDULE, DELEGATE, DONT_DO

    @Column(length = 20)
    @Builder.Default
    private String status = "TODO"; // TODO, IN_PROGRESS, COMPLETED, CANCELLED, OVERDUE

    @Column(name = "due_date")
    private OffsetDateTime dueDate;

    @Column(name = "estimated_duration_minutes")
    @Builder.Default
    private Integer estimatedDurationMinutes = 60;

    @Column(name = "actual_duration_minutes")
    @Builder.Default
    private Integer actualDurationMinutes = 0;

    @Column(name = "is_fixed_time")
    @Builder.Default
    private Boolean isFixedTime = false;

    @Column(name = "fixed_start_time")
    private OffsetDateTime fixedStartTime;

    @Column(name = "fixed_end_time")
    private OffsetDateTime fixedEndTime;

    @Column(name = "is_recurring")
    @Builder.Default
    private Boolean isRecurring = false;

    @Column(name = "recurrence_rule", length = 100)
    private String recurrenceRule;

    @Column(name = "parent_task_id")
    private Long parentTaskId;

    @Column(name = "completed_at")
    private OffsetDateTime completedAt;

    @Column(name = "created_at")
    @Builder.Default
    private OffsetDateTime createdAt = OffsetDateTime.now();

    @Column(name = "updated_at")
    @Builder.Default
    private OffsetDateTime updatedAt = OffsetDateTime.now();
}
