package com.taskmanager.controller;

import com.taskmanager.entity.Category;
import com.taskmanager.entity.User;
import com.taskmanager.repository.CategoryRepository;
import com.taskmanager.util.UserResolver;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/categories")
@CrossOrigin(origins = "*")
public class CategoryController {

    private final CategoryRepository categoryRepository;
    private final com.taskmanager.repository.TaskRepository taskRepository;
    private final UserResolver userResolver;

    public CategoryController(
            CategoryRepository categoryRepository,
            com.taskmanager.repository.TaskRepository taskRepository,
            UserResolver userResolver) {
        this.categoryRepository = categoryRepository;
        this.taskRepository = taskRepository;
        this.userResolver = userResolver;
    }

    @GetMapping
    public ResponseEntity<List<Category>> getCategories(
            @RequestParam(required = false) Long workspaceId,
            HttpServletRequest request) {
        Long userId = userResolver.resolveUserId(request);
        if (workspaceId != null) {
            return ResponseEntity.ok(categoryRepository.findByUserIdAndWorkspaceId(userId, workspaceId));
        }
        return ResponseEntity.ok(categoryRepository.findByUserId(userId));
    }

    @PostMapping
    public ResponseEntity<Category> createCategory(
            @RequestBody Category category,
            @RequestParam(required = false) Long workspaceId,
            HttpServletRequest request) {
        Long userId = userResolver.resolveUserId(request);
        category.setUserId(userId);
        if (category.getWorkspaceId() == null && workspaceId != null) {
            category.setWorkspaceId(workspaceId);
        }
        if (category.getColorCode() == null || category.getColorCode().isBlank()) {
            category.setColorCode("#6C5CE7");
        }
        if (category.getIconName() == null || category.getIconName().isBlank()) {
            category.setIconName("Folder");
        }
        category.setCreatedAt(java.time.OffsetDateTime.now());
        category.setUpdatedAt(java.time.OffsetDateTime.now());
        return ResponseEntity.ok(categoryRepository.save(category));
    }

    @PutMapping("/{id}")
    public ResponseEntity<Category> updateCategory(@PathVariable Long id, @RequestBody Category dto) {
        Category category = categoryRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Không tìm thấy nhóm #" + id));
        if (dto.getName() != null && !dto.getName().isBlank()) {
            category.setName(dto.getName());
        }
        if (dto.getColorCode() != null && !dto.getColorCode().isBlank()) {
            category.setColorCode(dto.getColorCode());
        }
        if (dto.getIconName() != null && !dto.getIconName().isBlank()) {
            category.setIconName(dto.getIconName());
        }
        category.setUpdatedAt(java.time.OffsetDateTime.now());
        return ResponseEntity.ok(categoryRepository.save(category));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<?> deleteCategory(@PathVariable Long id) {
        Category category = categoryRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Không tìm thấy nhóm #" + id));

        // Kiểm tra ràng buộc: KHÔNG ĐƯỢC XÓA khi có task đang dùng tag/nhóm này
        long taskCount = taskRepository.countByCategoryId(id);
        if (taskCount > 0) {
            return ResponseEntity.badRequest().body(java.util.Map.of(
                "message", "Không thể xóa nhóm \"" + category.getName() + "\" vì đang có " + taskCount + " công việc đang sử dụng nhóm này!",
                "taskCount", taskCount
            ));
        }

        categoryRepository.deleteById(id);
        return ResponseEntity.noContent().build();
    }
}
