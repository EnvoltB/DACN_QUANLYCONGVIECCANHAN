package com.taskmanager.service;

import com.taskmanager.dto.TaskDto;
import com.taskmanager.entity.Category;
import com.taskmanager.entity.Task;
import com.taskmanager.entity.TimeBlock;
import com.taskmanager.repository.CategoryRepository;
import com.taskmanager.repository.TaskRepository;
import com.taskmanager.repository.TimeBlockRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.OffsetDateTime;
import java.util.*;

@Service
@RequiredArgsConstructor
public class TaskService {

    private final TaskRepository taskRepository;
    private final TimeBlockRepository timeBlockRepository;
    private final CategoryRepository categoryRepository;

    @jakarta.annotation.PostConstruct
    public void migrateWorkspacesForExistingData() {
        try {
            List<Task> allTasks = taskRepository.findAll();
            for (Task t : allTasks) {
                if (t.getWorkspaceId() == null) {
                    t.setWorkspaceId(1L);
                    taskRepository.save(t);
                }
            }
            List<Category> allCats = categoryRepository.findAll();
            for (Category c : allCats) {
                if (c.getWorkspaceId() == null) {
                    c.setWorkspaceId(1L);
                    categoryRepository.save(c);
                }
            }
        } catch (Exception e) {
            // ignore if table not ready yet
        }
    }

    @Transactional(readOnly = true)
    public List<TaskDto> getTasks(Long userId, Long workspaceId) {
        List<Task> tasks;
        if (workspaceId != null) {
            tasks = taskRepository.findByUserIdAndWorkspaceId(userId, workspaceId);
        } else {
            tasks = taskRepository.findByUserId(userId);
        }
        List<TimeBlock> blocks = timeBlockRepository.findByUserId(userId);
        Map<Long, TimeBlock> blockMap = new HashMap<>();
        for (TimeBlock b : blocks) {
            if (b.getTaskId() != null) {
                blockMap.put(b.getTaskId(), b);
            }
        }

        Map<Long, Category> categoryMap = new HashMap<>();
        for (Category c : categoryRepository.findByUserId(userId)) {
            categoryMap.put(c.getId(), c);
        }

        List<TaskDto> dtos = new ArrayList<>();
        for (Task t : tasks) {
            TimeBlock b = blockMap.get(t.getId());
            Category c = t.getCategoryId() != null ? categoryMap.get(t.getCategoryId()) : null;

            String categoryType = "WORK";
            if (c != null) {
                if ("Học tập".equalsIgnoreCase(c.getName())) categoryType = "STUDY";
                else if ("Sức khỏe".equalsIgnoreCase(c.getName())) categoryType = "HEALTH";
                else if ("Giải trí".equalsIgnoreCase(c.getName())) categoryType = "ENTERTAINMENT";
            }

            OffsetDateTime start = (b != null) ? b.getStartTime() : (t.getFixedStartTime() != null ? t.getFixedStartTime() : OffsetDateTime.now());
            OffsetDateTime end = (b != null) ? b.getEndTime() : (t.getFixedEndTime() != null ? t.getFixedEndTime() : start.plusHours(1));

            String colorCode = (b != null && b.getColorCode() != null) ? b.getColorCode() : (c != null ? c.getColorCode() : "#6C5CE7");

            dtos.add(TaskDto.builder()
                    .id(t.getId())
                    .userId(t.getUserId())
                    .workspaceId(t.getWorkspaceId())
                    .categoryId(t.getCategoryId())
                    .categoryType(categoryType)
                    .title(t.getTitle())
                    .description(t.getDescription())
                    .priority(t.getPriority())
                    .status(t.getStatus())
                    .startTime(start)
                    .endTime(end)
                    .estimatedDurationMinutes(t.getEstimatedDurationMinutes())
                    .isRecurring(t.getIsRecurring())
                    .colorCode(colorCode)
                    .isAutoScheduled(b != null && Boolean.TRUE.equals(b.getIsAutoScheduled()))
                    .subtext("COMPLETED".equalsIgnoreCase(t.getStatus()) ? "✓ Đã hoàn thành" :
                             "IN_PROGRESS".equalsIgnoreCase(t.getStatus()) ? "• Đang làm" : "Cần làm")
                    .build());
        }
        return dtos;
    }

    @Transactional
    public TaskDto createTask(Long userId, TaskDto dto) {
        Long workspaceId = dto.getWorkspaceId();
        if (workspaceId == null) {
            workspaceId = 1L; // Mặc định workspace 1 (Không gian cá nhân)
        }

        // Find matching category by type name
        Long categoryId = dto.getCategoryId();
        if (categoryId == null && dto.getCategoryType() != null) {
            String catName = "Công việc";
            if ("STUDY".equalsIgnoreCase(dto.getCategoryType())) catName = "Học tập";
            else if ("HEALTH".equalsIgnoreCase(dto.getCategoryType())) catName = "Sức khỏe";
            else if ("ENTERTAINMENT".equalsIgnoreCase(dto.getCategoryType())) catName = "Giải trí";

            for (Category c : categoryRepository.findByUserId(userId)) {
                if (c.getName().equalsIgnoreCase(catName)) {
                    categoryId = c.getId();
                    break;
                }
            }
        }

        Task task = Task.builder()
                .userId(userId)
                .workspaceId(workspaceId)
                .categoryId(categoryId)
                .title(dto.getTitle())
                .description(dto.getDescription())
                .priority(dto.getPriority() != null ? dto.getPriority() : "MEDIUM")
                .status(dto.getStatus() != null ? dto.getStatus() : "TODO")
                .isRecurring(Boolean.TRUE.equals(dto.getIsRecurring()))
                .estimatedDurationMinutes(dto.getEstimatedDurationMinutes() != null ? dto.getEstimatedDurationMinutes() : 60)
                .build();

        Task savedTask = taskRepository.save(task);

        OffsetDateTime start = dto.getStartTime() != null ? dto.getStartTime() : OffsetDateTime.now();
        OffsetDateTime end = dto.getEndTime() != null ? dto.getEndTime() : start.plusHours(1);

        TimeBlock block = TimeBlock.builder()
                .userId(userId)
                .taskId(savedTask.getId())
                .title(savedTask.getTitle())
                .startTime(start)
                .endTime(end)
                .colorCode(dto.getColorCode() != null ? dto.getColorCode() : "#6C5CE7")
                .isAutoScheduled(Boolean.TRUE.equals(dto.getIsAutoScheduled()))
                .build();

        timeBlockRepository.save(block);

        dto.setId(savedTask.getId());
        dto.setUserId(userId);
        dto.setWorkspaceId(workspaceId);
        return dto;
    }

    @Transactional
    public TaskDto updateTask(Long userId, Long taskId, TaskDto dto) {
        Task task = taskRepository.findById(taskId)
                .orElseThrow(() -> new RuntimeException("Không tìm thấy công việc #" + taskId));

        if (dto.getTitle() != null && !dto.getTitle().trim().isEmpty()) {
            task.setTitle(dto.getTitle().trim());
        }
        if (dto.getDescription() != null) {
            task.setDescription(dto.getDescription());
        }
        if (dto.getPriority() != null) {
            task.setPriority(dto.getPriority());
        }
        if (dto.getStatus() != null) {
            task.setStatus(dto.getStatus());
        }
        if (dto.getIsRecurring() != null) {
            task.setIsRecurring(dto.getIsRecurring());
        }
        if (dto.getEstimatedDurationMinutes() != null) {
            task.setEstimatedDurationMinutes(dto.getEstimatedDurationMinutes());
        }
        if (dto.getCategoryId() != null) {
            task.setCategoryId(dto.getCategoryId());
        } else if (dto.getCategoryType() != null) {
            String catName = "Công việc";
            if ("STUDY".equalsIgnoreCase(dto.getCategoryType())) catName = "Học tập";
            else if ("HEALTH".equalsIgnoreCase(dto.getCategoryType())) catName = "Sức khỏe";
            else if ("ENTERTAINMENT".equalsIgnoreCase(dto.getCategoryType())) catName = "Giải trí";

            for (Category c : categoryRepository.findByUserId(userId)) {
                if (c.getName().equalsIgnoreCase(catName)) {
                    task.setCategoryId(c.getId());
                    break;
                }
            }
        }
        if (dto.getWorkspaceId() != null) {
            task.setWorkspaceId(dto.getWorkspaceId());
        }
        Task updatedTask = taskRepository.save(task);

        // Update corresponding TimeBlock if time or title changed
        boolean foundBlock = false;
        List<TimeBlock> userBlocks = timeBlockRepository.findByUserId(userId);
        for (TimeBlock b : userBlocks) {
            if (taskId.equals(b.getTaskId())) {
                if (dto.getTitle() != null && !dto.getTitle().trim().isEmpty()) {
                    b.setTitle(dto.getTitle().trim());
                } else {
                    b.setTitle(updatedTask.getTitle());
                }
                if (dto.getStartTime() != null) b.setStartTime(dto.getStartTime());
                if (dto.getEndTime() != null) b.setEndTime(dto.getEndTime());
                if (dto.getColorCode() != null) b.setColorCode(dto.getColorCode());
                timeBlockRepository.save(b);
                foundBlock = true;
                break;
            }
        }

        // If no TimeBlock exists yet, create one if startTime is specified
        if (!foundBlock && (dto.getStartTime() != null || dto.getEndTime() != null)) {
            OffsetDateTime start = dto.getStartTime() != null ? dto.getStartTime() : OffsetDateTime.now();
            OffsetDateTime end = dto.getEndTime() != null ? dto.getEndTime() : start.plusHours(1);
            TimeBlock newBlock = TimeBlock.builder()
                    .userId(userId)
                    .taskId(taskId)
                    .title(updatedTask.getTitle())
                    .startTime(start)
                    .endTime(end)
                    .colorCode(dto.getColorCode() != null ? dto.getColorCode() : "#6C5CE7")
                    .isAutoScheduled(false)
                    .build();
            timeBlockRepository.save(newBlock);
        }

        return TaskDto.builder()
                .id(updatedTask.getId())
                .userId(userId)
                .workspaceId(updatedTask.getWorkspaceId())
                .categoryId(updatedTask.getCategoryId())
                .categoryType(dto.getCategoryType())
                .title(updatedTask.getTitle())
                .description(updatedTask.getDescription())
                .priority(updatedTask.getPriority())
                .status(updatedTask.getStatus())
                .startTime(dto.getStartTime())
                .endTime(dto.getEndTime())
                .isRecurring(updatedTask.getIsRecurring())
                .build();
    }

    @Transactional
    public void deleteTask(Long userId, Long taskId) {
        timeBlockRepository.deleteByTaskId(taskId);
        taskRepository.deleteById(taskId);
    }

    @Transactional(readOnly = true)
    public Map<String, Object> getStats(Long userId, Long workspaceId) {
        long totalTasks = (workspaceId != null)
                ? taskRepository.countByUserIdAndWorkspaceId(userId, workspaceId)
                : taskRepository.countByUserId(userId);
        long completedTasks = (workspaceId != null)
                ? taskRepository.countByUserIdAndWorkspaceIdAndStatus(userId, workspaceId, "COMPLETED")
                : taskRepository.countByUserIdAndStatus(userId, "COMPLETED");

        Map<String, Object> map = new HashMap<>();
        map.put("totalTasksThisWeek", totalTasks);
        map.put("completedTasks", completedTasks);
        map.put("focusHours", totalTasks > 0 ? 13 : 0);
        map.put("focusLabel", totalTasks > 0 ? "Học tập & Công việc" : "Không có nhiệm vụ");
        map.put("freeSlots", 8);
        return map;
    }
}
