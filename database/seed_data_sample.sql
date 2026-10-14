-- ==============================================================================
-- SEED DATA SCRIPT - SMARTTASK AI
-- Tài khoản quản trị viên: admin@gmail.com / Mật khẩu: 1 (BCrypt Hashed)
-- Dữ liệu lịch biểu mẫu, phân loại, nhật ký năng suất
-- ==============================================================================

-- 1. Đảm bảo Roles tồn tại
INSERT INTO roles (id, name, description)
VALUES 
    (1, 'ROLE_USER', 'Người dùng thông thường'),
    (2, 'ROLE_ADMIN', 'Quản trị viên hệ thống')
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, description = EXCLUDED.description;

-- 2. Tạo tài khoản admin@gmail.com với mật khẩu '1' đã hash bằng BCrypt
-- Hash: $2a$10$yEfE0fephkMMM8WOJPycZuXf0yyntC5V2oyjaxoSU4UIG8fUhy5Zu (BCrypt 10 rounds của '1')
INSERT INTO users (email, password_hash, full_name, phone_number, avatar_url, auth_provider, is_active, is_email_verified)
VALUES (
    'admin@gmail.com',
    '$2a$10$yEfE0fephkMMM8WOJPycZuXf0yyntC5V2oyjaxoSU4UIG8fUhy5Zu',
    'Minh Anh',
    '0901234567',
    NULL,
    'LOCAL',
    TRUE,
    TRUE
)
ON CONFLICT (email) DO UPDATE 
SET password_hash = '$2a$10$yEfE0fephkMMM8WOJPycZuXf0yyntC5V2oyjaxoSU4UIG8fUhy5Zu',
    full_name = 'Minh Anh',
    is_active = TRUE;

-- 3. Gán Role ADMIN và USER cho admin@gmail.com
DO $$
DECLARE
    v_admin_id BIGINT;
    v_cat_study BIGINT;
    v_cat_work BIGINT;
    v_cat_health BIGINT;
    v_cat_ent BIGINT;
BEGIN
    SELECT id INTO v_admin_id FROM users WHERE email = 'admin@gmail.com';

    INSERT INTO user_roles (user_id, role_id)
    VALUES (v_admin_id, 1), (v_admin_id, 2)
    ON CONFLICT (user_id, role_id) DO NOTHING;

    -- 4. Tạo User Preferences
    INSERT INTO user_preferences (user_id, work_start_time, work_end_time, working_days, buffer_time_minutes, peak_productivity_time, timezone, theme)
    VALUES (v_admin_id, '08:00:00', '18:00:00', 'MON,TUE,WED,THU,FRI', 15, 'MORNING', 'Asia/Ho_Chi_Minh', 'LIGHT')
    ON CONFLICT (user_id) DO UPDATE SET theme = 'LIGHT';

    -- 5. Xóa dữ liệu cũ của user nếu có để insert đồng bộ
    DELETE FROM time_blocks WHERE user_id = v_admin_id;
    DELETE FROM tasks WHERE user_id = v_admin_id;
    DELETE FROM categories WHERE user_id = v_admin_id;
    
    INSERT INTO categories (user_id, name, color_code, icon_name, is_default)
    VALUES (v_admin_id, 'Học tập', '#3B82F6', 'BookOpen', TRUE)
    RETURNING id INTO v_cat_study;

    INSERT INTO categories (user_id, name, color_code, icon_name, is_default)
    VALUES (v_admin_id, 'Công việc', '#8B5CF6', 'Briefcase', TRUE)
    RETURNING id INTO v_cat_work;

    INSERT INTO categories (user_id, name, color_code, icon_name, is_default)
    VALUES (v_admin_id, 'Sức khỏe', '#10B981', 'Heart', TRUE)
    RETURNING id INTO v_cat_health;

    INSERT INTO categories (user_id, name, color_code, icon_name, is_default)
    VALUES (v_admin_id, 'Giải trí', '#F59E0B', 'Gamepad2', TRUE)
    RETURNING id INTO v_cat_ent;

    -- 6. Tạo Công việc (Tasks) & Khối Lịch biểu (Time Blocks) Tuần 12 - 18/10/2026
    -- T2: Lên kế hoạch tuần
    INSERT INTO tasks (id, user_id, category_id, title, priority, status, estimated_duration_minutes, is_recurring)
    VALUES (101, v_admin_id, v_cat_work, 'Lên kế hoạch tuần', 'MEDIUM', 'TODO', 60, TRUE);
    INSERT INTO time_blocks (user_id, task_id, title, start_time, end_time, is_auto_scheduled, color_code)
    VALUES (v_admin_id, 101, 'Lên kế hoạch tuần', '2026-10-12 09:00:00+07', '2026-10-12 10:00:00+07', FALSE, '#3B82F6');

    -- T2: Nghiên cứu đồ án
    INSERT INTO tasks (id, user_id, category_id, title, priority, status, estimated_duration_minutes)
    VALUES (102, v_admin_id, v_cat_study, 'Nghiên cứu đồ án', 'HIGH', 'COMPLETED', 120);
    INSERT INTO time_blocks (user_id, task_id, title, start_time, end_time, is_auto_scheduled, color_code)
    VALUES (v_admin_id, 102, 'Nghiên cứu đồ án', '2026-10-12 13:00:00+07', '2026-10-12 15:00:00+07', FALSE, '#8B5CF6');

    -- T3: Yoga buổi sáng
    INSERT INTO tasks (id, user_id, category_id, title, priority, status, estimated_duration_minutes, is_recurring)
    VALUES (103, v_admin_id, v_cat_health, 'Yoga buổi sáng', 'MEDIUM', 'COMPLETED', 60, TRUE);
    INSERT INTO time_blocks (user_id, task_id, title, start_time, end_time, is_auto_scheduled, color_code)
    VALUES (v_admin_id, 103, 'Yoga buổi sáng', '2026-10-13 08:00:00+07', '2026-10-13 09:00:00+07', FALSE, '#10B981');

    -- T3: Thiết kế giao diện
    INSERT INTO tasks (id, user_id, category_id, title, priority, status, estimated_duration_minutes)
    VALUES (104, v_admin_id, v_cat_work, 'Thiết kế giao diện', 'URGENT', 'IN_PROGRESS', 120);
    INSERT INTO time_blocks (user_id, task_id, title, start_time, end_time, is_auto_scheduled, color_code)
    VALUES (v_admin_id, 104, 'Thiết kế giao diện', '2026-10-13 09:00:00+07', '2026-10-13 11:00:00+07', FALSE, '#3B82F6');

    -- T3: Học tiếng Anh
    INSERT INTO tasks (id, user_id, category_id, title, priority, status, estimated_duration_minutes, is_recurring)
    VALUES (105, v_admin_id, v_cat_study, 'Học tiếng Anh', 'MEDIUM', 'TODO', 60, TRUE);
    INSERT INTO time_blocks (user_id, task_id, title, start_time, end_time, is_auto_scheduled, color_code)
    VALUES (v_admin_id, 105, 'Học tiếng Anh', '2026-10-13 14:00:00+07', '2026-10-13 15:00:00+07', FALSE, '#8B5CF6');

    -- T4: Viết đề cương
    INSERT INTO tasks (id, user_id, category_id, title, priority, status, estimated_duration_minutes)
    VALUES (106, v_admin_id, v_cat_study, 'Viết đề cương', 'HIGH', 'TODO', 120);
    INSERT INTO time_blocks (user_id, task_id, title, start_time, end_time, is_auto_scheduled, color_code)
    VALUES (v_admin_id, 106, 'Viết đề cương', '2026-10-14 09:00:00+07', '2026-10-14 11:00:00+07', FALSE, '#8B5CF6');

    -- T4: Họp nhóm đồ án
    INSERT INTO tasks (id, user_id, category_id, title, priority, status, estimated_duration_minutes, is_fixed_time)
    VALUES (107, v_admin_id, v_cat_work, 'Họp nhóm đồ án', 'HIGH', 'TODO', 60, TRUE);
    INSERT INTO time_blocks (user_id, task_id, title, start_time, end_time, is_auto_scheduled, color_code)
    VALUES (v_admin_id, 107, 'Họp nhóm đồ án', '2026-10-14 15:00:00+07', '2026-10-14 16:00:00+07', FALSE, '#8B5CF6');

    -- T5: Họp nhóm sản phẩm
    INSERT INTO tasks (id, user_id, category_id, title, priority, status, estimated_duration_minutes, is_recurring)
    VALUES (108, v_admin_id, v_cat_work, 'Họp nhóm sản phẩm', 'MEDIUM', 'TODO', 60, TRUE);
    INSERT INTO time_blocks (user_id, task_id, title, start_time, end_time, is_auto_scheduled, color_code)
    VALUES (v_admin_id, 108, 'Họp nhóm sản phẩm', '2026-10-15 09:00:00+07', '2026-10-15 10:00:00+07', FALSE, '#3B82F6');

    -- T5: Tập gym
    INSERT INTO tasks (id, user_id, category_id, title, priority, status, estimated_duration_minutes, is_recurring)
    VALUES (109, v_admin_id, v_cat_health, 'Tập gym', 'LOW', 'TODO', 60, TRUE);
    INSERT INTO time_blocks (user_id, task_id, title, start_time, end_time, is_auto_scheduled, color_code)
    VALUES (v_admin_id, 109, 'Tập gym', '2026-10-15 17:00:00+07', '2026-10-15 18:00:00+07', FALSE, '#10B981');

    -- T6: Hoàn thiện prototype
    INSERT INTO tasks (id, user_id, category_id, title, priority, status, estimated_duration_minutes)
    VALUES (110, v_admin_id, v_cat_work, 'Hoàn thiện prototype', 'HIGH', 'TODO', 120);
    INSERT INTO time_blocks (user_id, task_id, title, start_time, end_time, is_auto_scheduled, color_code)
    VALUES (v_admin_id, 110, 'Hoàn thiện prototype', '2026-10-16 09:00:00+07', '2026-10-16 11:00:00+07', FALSE, '#3B82F6');

    -- T6: Tổng kết tuần
    INSERT INTO tasks (id, user_id, category_id, title, priority, status, estimated_duration_minutes, is_recurring)
    VALUES (111, v_admin_id, v_cat_work, 'Tổng kết tuần', 'MEDIUM', 'TODO', 60, TRUE);
    INSERT INTO time_blocks (user_id, task_id, title, start_time, end_time, is_auto_scheduled, color_code)
    VALUES (v_admin_id, 111, 'Tổng kết tuần', '2026-10-16 16:00:00+07', '2026-10-16 17:00:00+07', FALSE, '#3B82F6');

    -- T7: Đi bộ công viên
    INSERT INTO tasks (id, user_id, category_id, title, priority, status, estimated_duration_minutes, is_recurring)
    VALUES (112, v_admin_id, v_cat_health, 'Đi bộ công viên', 'LOW', 'TODO', 60, TRUE);
    INSERT INTO time_blocks (user_id, task_id, title, start_time, end_time, is_auto_scheduled, color_code)
    VALUES (v_admin_id, 112, 'Đi bộ công viên', '2026-10-17 09:00:00+07', '2026-10-17 10:00:00+07', FALSE, '#10B981');

    -- T7: Xem phim cùng bạn
    INSERT INTO tasks (id, user_id, category_id, title, priority, status, estimated_duration_minutes)
    VALUES (113, v_admin_id, v_cat_ent, 'Xem phim cùng bạn', 'LOW', 'TODO', 120);
    INSERT INTO time_blocks (user_id, task_id, title, start_time, end_time, is_auto_scheduled, color_code)
    VALUES (v_admin_id, 113, 'Xem phim cùng bạn', '2026-10-17 15:00:00+07', '2026-10-17 17:00:00+07', FALSE, '#F59E0B');

    -- CN: Chuẩn bị tuần mới
    INSERT INTO tasks (id, user_id, category_id, title, priority, status, estimated_duration_minutes, is_recurring)
    VALUES (114, v_admin_id, v_cat_ent, 'Chuẩn bị tuần mới', 'MEDIUM', 'TODO', 60, TRUE);
    INSERT INTO time_blocks (user_id, task_id, title, start_time, end_time, is_auto_scheduled, color_code)
    VALUES (v_admin_id, 114, 'Chuẩn bị tuần mới', '2026-10-18 10:00:00+07', '2026-10-18 11:00:00+07', FALSE, '#F59E0B');

    -- 8. Thông báo được tự động tạo bởi Thuật toán Quyết định Thông minh (NotificationDecisionService)
    -- dựa trên dữ liệu thực tế (Tasks, TimeBlocks, Deadlines, Năng suất). Không chèn dữ liệu tĩnh.
END $$;
