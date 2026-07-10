CREATE TABLE `user_account`
(
    `id`            BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '用户ID',
    `username`      VARCHAR(50)     NOT NULL COMMENT '用户名，系统内唯一',
    `email`         VARCHAR(255)             DEFAULT NULL COMMENT '邮箱，可用于登录',
    `phone`         VARCHAR(30)              DEFAULT NULL COMMENT '手机号，可用于登录',
    `password_hash` VARCHAR(255)             DEFAULT NULL COMMENT '密码哈希，不存明文密码',
    `role`          VARCHAR(50)     NOT NULL DEFAULT 'user' COMMENT '权限角色：初版使用 admin / user，后续可扩展',
    `status`        VARCHAR(30)     NOT NULL DEFAULT 'active' COMMENT '账号状态：active正常 / disabled禁用 / deleted已删除',
    `last_login_at` DATETIME                 DEFAULT NULL COMMENT '最后登录时间',
    `created_at`    DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    `updated_at`    DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    `deleted_at`    DATETIME                 DEFAULT NULL COMMENT '软删除时间',
    PRIMARY KEY (`id`),
    UNIQUE KEY `uk_user_account_username` (`username`),
    UNIQUE KEY `uk_user_account_email` (`email`),
    UNIQUE KEY `uk_user_account_phone` (`phone`),
    KEY `idx_user_account_role` (`role`),
    KEY `idx_user_account_status` (`status`),
    KEY `idx_user_account_created_at` (`created_at`)
) ENGINE = InnoDB
  DEFAULT CHARSET = utf8mb4
  COLLATE = utf8mb4_unicode_ci COMMENT ='用户账号表';