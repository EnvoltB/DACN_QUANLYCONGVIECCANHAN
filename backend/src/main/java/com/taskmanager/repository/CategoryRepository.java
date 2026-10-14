package com.taskmanager.repository;

import com.taskmanager.entity.Category;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.List;

@Repository
public interface CategoryRepository extends JpaRepository<Category, Long> {
    List<Category> findByUserId(Long userId);
    List<Category> findByUserIdAndWorkspaceId(Long userId, Long workspaceId);
    long countByWorkspaceId(Long workspaceId);
    void deleteByWorkspaceId(Long workspaceId);
}
