-- 数据库初始化脚本
-- 创建数据库（如果不存在）
CREATE DATABASE IF NOT EXISTS recommendation DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

USE recommendation;

-- 用户表
CREATE TABLE IF NOT EXISTS users (
    user_id BIGINT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(50) NOT NULL UNIQUE,
    email VARCHAR(100) NOT NULL UNIQUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_username (username),
    INDEX idx_email (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 浏览历史表
CREATE TABLE IF NOT EXISTS browse_histories (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    user_id BIGINT NOT NULL,
    product_id BIGINT NOT NULL,
    browsed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_user_product (user_id, product_id),
    INDEX idx_browsed_at (browsed_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 商品表
CREATE TABLE IF NOT EXISTS products (
    product_id BIGINT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(200) NOT NULL,
    description TEXT,
    price DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
    category VARCHAR(100),
    view_count BIGINT NOT NULL DEFAULT 0,
    hot_score DOUBLE NOT NULL DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_name (name),
    INDEX idx_category (category),
    INDEX idx_hot_score (hot_score DESC)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- AB测试实验表
CREATE TABLE IF NOT EXISTS ab_experiments (
    experiment_id VARCHAR(100) PRIMARY KEY,
    name VARCHAR(200) NOT NULL,
    description TEXT,
    groups JSON,
    enabled BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_enabled (enabled)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- AB测试统计数据表
CREATE TABLE IF NOT EXISTS ab_experiment_stats (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    experiment_id VARCHAR(100) NOT NULL,
    group_id VARCHAR(100) NOT NULL,
    impressions BIGINT NOT NULL DEFAULT 0,
    clicks BIGINT NOT NULL DEFAULT 0,
    date DATE NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY idx_exp_group_date (experiment_id, group_id, date),
    INDEX idx_date (date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 插入示例商品数据
INSERT INTO products (name, description, price, category, view_count, hot_score) VALUES
('iPhone 15 Pro', '最新款苹果手机，A17 Pro芯片', 9999.00, '手机', 1500, 1450.5),
('MacBook Pro 14', 'M3 Pro芯片，专业级笔记本', 14999.00, '电脑', 1200, 1180.2),
('AirPods Pro 2', '主动降噪无线耳机', 1899.00, '配件', 2000, 1920.8),
('iPad Pro 12.9', 'M2芯片，Liquid Retina XDR显示屏', 8999.00, '平板', 800, 780.3),
('Apple Watch Ultra 2', '专业级智能手表', 6499.00, '手表', 600, 580.1),
('小米14 Pro', '徕卡光学镜头，骁龙8 Gen3', 4999.00, '手机', 1800, 1750.6),
('华为Mate 60 Pro', '麒麟芯片，卫星通信', 6999.00, '手机', 2200, 2100.9),
('索尼WH-1000XM5', '顶级降噪头戴耳机', 2699.00, '配件', 900, 870.4),
('戴尔XPS 15', 'Intel i9，OLED屏幕', 12999.00, '电脑', 700, 680.7),
('联想ThinkPad X1', '商务旗舰笔记本', 11999.00, '电脑', 650, 630.2),
('三星Galaxy S24', 'AI手机，Exynos芯片', 5999.00, '手机', 1100, 1080.5),
('任天堂Switch OLED', '掌上游戏机', 2599.00, '游戏', 1600, 1550.3),
('PS5 Slim', '索尼次世代主机', 3899.00, '游戏', 1900, 1850.1),
('Kindle Paperwhite', '电子阅读器', 1099.00, '阅读', 500, 480.9),
('Bose QuietComfort', '消噪耳机旗舰', 2299.00, '配件', 750, 730.6)
ON DUPLICATE KEY UPDATE name=name;

-- 插入示例用户数据
INSERT INTO users (username, email) VALUES
('test_user1', 'test1@example.com'),
('test_user2', 'test2@example.com'),
('test_user3', 'test3@example.com'),
('test_user4', 'test4@example.com'),
('test_user5', 'test5@example.com')
ON DUPLICATE KEY UPDATE username=username;
