-- ==============================================================================
-- DATABASE INITIALIZATION SCRIPT FOR POSTGRESQL 17
-- Dự án: Hệ thống Quản lý và Tự động Lập lịch Công việc Cá nhân (SmartTask AI)
-- Database: quanlycongviec_db
-- ==============================================================================

-- Drop tables if exists (theo thứ tự khóa ngoại)
DROP TABLE IF EXISTS notifications CASCADE;
DROP TABLE IF EXISTS productivity_logs CASCADE;
DROP TABLE IF EXISTS ai_scheduling_logs CASCADE;
DROP TABLE IF EXISTS reminders CASCADE;
DROP TABLE IF EXISTS pomodoro_sessions CASCADE;
DROP TABLE IF EXISTS time_blocks CASCADE;
DROP TABLE IF EXISTS subtasks CASCADE;
DROP TABLE IF EXISTS task_tags CASCADE;
DROP TABLE IF EXISTS tasks CASCADE;
DROP TABLE IF EXISTS tags CASCADE;
DROP TABLE IF EXISTS categories CASCADE;
DROP TABLE IF EXISTS workspaces CASCADE;
DROP TABLE IF EXISTS user_preferences CASCADE;
DROP TABLE IF EXISTS user_roles CASCADE;
DROP TABLE IF EXISTS roles CASCADE;
DROP TABLE IF EXISTS users CASCADE;

-- 1. Bảng USERS (Người dùng)
CREATE TABLE users (
    id BIGSERIAL PRIMARY KEY,
    email VARCHAR(120) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    full_name VARCHAR(100) NOT NULL,
    phone_number VARCHAR(20),
    avatar_url VARCHAR(500),
    auth_provider VARCHAR(20) DEFAULT 'LOCAL', -- LOCAL, GOOGLE
    is_active BOOLEAN DEFAULT TRUE,
    is_email_verified BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 2. Bảng ROLES & USER_ROLES (Phân quyền)
CREATE TABLE roles (
    id SERIAL PRIMARY KEY,
    name VARCHAR(50) NOT NULL UNIQUE, -- ROLE_USER, ROLE_ADMIN
    description VARCHAR(255)
);

CREATE TABLE user_roles (
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role_id INT NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
    PRIMARY KEY (user_id, role_id)
);

-- 3. Bảng USER_PREFERENCES (Cấu hình thói quen làm việc & AI)
CREATE TABLE user_preferences (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    work_start_time TIME DEFAULT '08:00:00',
    work_end_time TIME DEFAULT '18:00:00',
    working_days VARCHAR(50) DEFAULT 'MON,TUE,WED,THU,FRI',
    buffer_time_minutes INT DEFAULT 15,            -- Thời gian đệm giữa các việc
    peak_productivity_time VARCHAR(20) DEFAULT 'MORNING', -- MORNING, AFTERNOON, EVENING
    default_pomodoro_minutes INT DEFAULT 25,
    default_short_break_minutes INT DEFAULT 5,
    default_long_break_minutes INT DEFAULT 15,
    auto_reschedule_enabled BOOLEAN DEFAULT TRUE,  -- Tự động dời lịch khi trễ việc
    timezone VARCHAR(50) DEFAULT 'Asia/Ho_Chi_Minh',
    theme VARCHAR(20) DEFAULT 'LIGHT',             -- LIGHT, DARK, SYSTEM
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 3.1 Bảng WORKSPACES (Không gian làm việc)
CREATE TABLE workspaces (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    icon_name VARCHAR(50) DEFAULT 'Briefcase',
    is_default BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 4. Bảng CATEGORIES (Danh mục công việc)
CREATE TABLE categories (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    workspace_id BIGINT REFERENCES workspaces(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    color_code VARCHAR(20) DEFAULT '#4F46E5',
    icon_name VARCHAR(50) DEFAULT 'Folder',
    is_default BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 5. Bảng TAGS (Thẻ phân loại nhãn)
CREATE TABLE tags (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(50) NOT NULL,
    color_code VARCHAR(20) DEFAULT '#64748B',
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 6. Bảng TASKS (Công việc / Nhiệm vụ)
CREATE TABLE tasks (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    workspace_id BIGINT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    category_id BIGINT REFERENCES categories(id) ON DELETE RESTRICT,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    priority VARCHAR(20) DEFAULT 'MEDIUM',           -- LOW, MEDIUM, HIGH, URGENT
    eisenhower_quadrant VARCHAR(20) DEFAULT 'SCHEDULE', -- DO_FIRST, SCHEDULE, DELEGATE, DONT_DO
    status VARCHAR(20) DEFAULT 'TODO',               -- TODO, IN_PROGRESS, COMPLETED, CANCELLED, OVERDUE
    due_date TIMESTAMPTZ,                            -- Deadline hoàn thành
    estimated_duration_minutes INT DEFAULT 30,       -- Thời lượng dự kiến (phút)
    actual_duration_minutes INT DEFAULT 0,          -- Thời gian thực tế đã làm
    is_fixed_time BOOLEAN DEFAULT FALSE,             -- Lịch cứng (họp, lịch học) không thể tự động dời
    fixed_start_time TIMESTAMPTZ,
    fixed_end_time TIMESTAMPTZ,
    is_recurring BOOLEAN DEFAULT FALSE,              -- Việc lặp lại
    recurrence_rule VARCHAR(100),                    -- VD: DAILY, WEEKLY_MON_WED_FRI, MONTHLY
    parent_task_id BIGINT REFERENCES tasks(id) ON DELETE CASCADE, -- Cho công việc cha-con
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 7. Bảng TASK_TAGS (Quan hệ nhiều - nhiều giữa Task và Tag)
CREATE TABLE task_tags (
    task_id BIGINT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    tag_id BIGINT NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
    PRIMARY KEY (task_id, tag_id)
);

-- 8. Bảng SUBTASKS (Checklist / Công việc con)
CREATE TABLE subtasks (
    id BIGSERIAL PRIMARY KEY,
    task_id BIGINT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    is_completed BOOLEAN DEFAULT FALSE,
    estimated_minutes INT DEFAULT 15,
    sort_order INT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 9. Bảng TIME_BLOCKS (Khối thời gian trên lịch trình cá nhân)
CREATE TABLE time_blocks (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    task_id BIGINT REFERENCES tasks(id) ON DELETE SET NULL,
    title VARCHAR(255) NOT NULL,
    start_time TIMESTAMPTZ NOT NULL,
    end_time TIMESTAMPTZ NOT NULL,
    is_auto_scheduled BOOLEAN DEFAULT FALSE,         -- Được AI xếp lịch tự động
    status VARCHAR(20) DEFAULT 'SCHEDULED',          -- SCHEDULED, IN_PROGRESS, COMPLETED, SKIPPED, CANCELLED
    color_code VARCHAR(20),
    note TEXT,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 10. Bảng POMODORO_SESSIONS (Phiên tập trung làm việc)
CREATE TABLE pomodoro_sessions (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    task_id BIGINT REFERENCES tasks(id) ON DELETE SET NULL,
    start_time TIMESTAMPTZ NOT NULL,
    end_time TIMESTAMPTZ,
    duration_minutes INT NOT NULL DEFAULT 25,
    session_type VARCHAR(20) DEFAULT 'WORK',        -- WORK, SHORT_BREAK, LONG_BREAK
    is_completed BOOLEAN DEFAULT TRUE,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 11. Bảng REMINDERS (Nhắc nhở)
CREATE TABLE reminders (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    task_id BIGINT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    remind_at TIMESTAMPTZ NOT NULL,
    channel VARCHAR(20) DEFAULT 'PUSH',             -- PUSH, EMAIL, IN_APP
    is_sent BOOLEAN DEFAULT FALSE,
    sent_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 11.1 Bảng NOTIFICATIONS (Thông báo hệ thống & Lưu trạng thái đã đọc)
CREATE TABLE notifications (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    task_id BIGINT REFERENCES tasks(id) ON DELETE SET NULL,
    type VARCHAR(50) DEFAULT 'reminder',            -- reminder, ai, alert, success
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 12. Bảng AI_SCHEDULING_LOGS (Nhật ký xử lý tự động của Gemini API)
CREATE TABLE ai_scheduling_logs (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    action_type VARCHAR(50) NOT NULL,               -- AUTO_SCHEDULE, TASK_BREAKDOWN, NATURAL_PARSING, RESCHEDULE_OVERDUE
    input_prompt TEXT NOT NULL,
    raw_ai_response JSONB,
    status VARCHAR(20) DEFAULT 'SUCCESS',           -- SUCCESS, FAILED, PARTIALLY_APPLIED
    tokens_used INT DEFAULT 0,
    execution_time_ms BIGINT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 13. Bảng PRODUCTIVITY_LOGS (Báo cáo & Thống kê năng suất hằng ngày)
CREATE TABLE productivity_logs (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    log_date DATE NOT NULL,
    total_tasks_completed INT DEFAULT 0,
    total_focus_minutes INT DEFAULT 0,
    on_time_completion_rate NUMERIC(5,2) DEFAULT 0.00,
    overdue_tasks_count INT DEFAULT 0,
    ai_insights TEXT,                               -- Đánh giá nhận xét tự động từ Gemini
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_user_log_date UNIQUE (user_id, log_date)
);

-- ==============================================================================
-- INDEXES TỐI ƯU HÓA HIỆU NĂNG TRUY VẤN
-- ==============================================================================
CREATE INDEX idx_tasks_user_status ON tasks(user_id, status);
CREATE INDEX idx_tasks_user_due_date ON tasks(user_id, due_date);
CREATE INDEX idx_tasks_category ON tasks(category_id);
CREATE INDEX idx_time_blocks_user_time ON time_blocks(user_id, start_time, end_time);
CREATE INDEX idx_pomodoro_user_time ON pomodoro_sessions(user_id, start_time);
CREATE INDEX idx_reminders_unsent ON reminders(remind_at) WHERE is_sent = FALSE;
CREATE INDEX idx_notifications_user_is_read ON notifications(user_id, is_read);

-- ==============================================================================
-- DỮ LIỆU MẪU BAN ĐẦU (SEED DATA)
-- ==============================================================================
INSERT INTO roles (name, description) VALUES 
('ROLE_USER', 'Người dùng cá nhân tiêu chuẩn'),
('ROLE_ADMIN', 'Quản trị viên hệ thống');

-- Mật khẩu mặc định: '1' cho admin@gmail.com và 'password123' cho demo
INSERT INTO users (email, password_hash, full_name, auth_provider, is_active, is_email_verified) VALUES 
('admin@gmail.com', '$2a$10$WzW1762U0K/uV5FmIomQge4qU27eP6X00D7qB9kC7q0cK8p9z0S2e', 'Minh Anh', 'LOCAL', TRUE, TRUE),
('demo@smarttask.ai', '$2a$10$7R3vP1X75lKqM8fF85F80eYlS9sXoUjH7tCq6rV4v9Q8k2p8z0S2e', 'Người Dùng Demo', 'LOCAL', TRUE, TRUE);

INSERT INTO user_roles (user_id, role_id) VALUES 
(1, 2),
(2, 1);

INSERT INTO user_preferences (user_id, work_start_time, work_end_time, working_days, buffer_time_minutes, peak_productivity_time) VALUES 
(1, '08:00:00', '18:00:00', 'MON,TUE,WED,THU,FRI', 15, 'MORNING');

-- Khởi tạo không gian làm việc
INSERT INTO workspaces (id, user_id, name, icon_name, is_default) VALUES
(1, 1, 'Không gian cá nhân', 'User', TRUE),
(2, 1, 'Đồ án Tốt nghiệp SmartTask', 'Briefcase', FALSE),
(3, 1, 'Học tập & Nghiên cứu', 'GraduationCap', FALSE);

-- Khởi tạo danh mục thuộc workspace 1 (Không gian cá nhân)
INSERT INTO categories (user_id, workspace_id, name, color_code, icon_name, is_default) VALUES 
(1, 1, 'Học tập', '#3B82F6', 'GraduationCap', TRUE),
(1, 1, 'Công việc', '#8B5CF6', 'Briefcase', FALSE),
(1, 1, 'Sức khỏe', '#10B981', 'Heart', FALSE),
(1, 1, 'Giải trí', '#F59E0B', 'Smile', FALSE);

-- Thông báo được tự động tạo và lưu vào bảng notifications bởi Thuật toán Quyết định Thông minh (NotificationDecisionService)
-- Không chèn dữ liệu mẫu tĩnh để đảm bảo tính chính xác và khách quan của thuật toán.
