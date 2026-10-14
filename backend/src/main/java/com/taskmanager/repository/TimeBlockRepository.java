package com.taskmanager.repository;

import com.taskmanager.entity.TimeBlock;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.time.OffsetDateTime;
import java.util.List;

@Repository
public interface TimeBlockRepository extends JpaRepository<TimeBlock, Long> {
    List<TimeBlock> findByUserId(Long userId);
    List<TimeBlock> findByUserIdAndStartTimeBetween(Long userId, OffsetDateTime start, OffsetDateTime end);
    void deleteByTaskId(Long taskId);
}
