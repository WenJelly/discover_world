CREATE TABLE `admin_role_policy`
(
    `id`         BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '后台角色权限策略ID',
    `role`       VARCHAR(50)     NOT NULL COMMENT '账号角色，对应 user_account.role',
    `capability` VARCHAR(80)     NOT NULL COMMENT '后台能力点，如 admin.media.review',
    `status`     TINYINT         NOT NULL DEFAULT 1 COMMENT '状态：1启用 / 0禁用',
    `created_at` DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    `updated_at` DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    PRIMARY KEY (`id`),
    UNIQUE KEY `uk_admin_role_capability` (`role`, `capability`),
    KEY `idx_admin_role_policy_status` (`status`)
) ENGINE = InnoDB
  DEFAULT CHARSET = utf8mb4
  COLLATE = utf8mb4_unicode_ci COMMENT ='后台角色权限策略表';
