CREATE TABLE `share_link`
(
    `id`               BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '分享链接ID',
    `user_id`          BIGINT UNSIGNED NOT NULL COMMENT '创建分享的用户ID',
    `target_type`      VARCHAR(50)     NOT NULL COMMENT '目标类型：media_asset / post / album / user_profile',
    `target_id`        BIGINT UNSIGNED NOT NULL COMMENT '目标对象ID',
    `token`            VARCHAR(128)    NOT NULL COMMENT '分享令牌，URL中使用',
    `permission_type`  VARCHAR(30)     NOT NULL DEFAULT 'view'
        COMMENT '权限类型：view预览 / download下载',
    `expire_at`        DATETIME                 DEFAULT NULL COMMENT '过期时间，NULL表示不过期',
    `max_access_count` INT UNSIGNED             DEFAULT NULL COMMENT '最大访问次数，NULL表示不限',
    `access_count`     INT UNSIGNED    NOT NULL DEFAULT 0 COMMENT '已访问次数',
    `status`           TINYINT         NOT NULL DEFAULT 1 COMMENT '状态：1启用 / 0禁用',
    `created_at`       DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    PRIMARY KEY (`id`),
    UNIQUE KEY `uk_share_link_token` (`token`),
    KEY `idx_share_link_target` (`target_type`, `target_id`),
    KEY `idx_share_link_user_id` (`user_id`),
    KEY `idx_share_link_status` (`status`),
    KEY `idx_share_link_expire_at` (`expire_at`),
    CONSTRAINT `fk_share_link_user`
        FOREIGN KEY (`user_id`) REFERENCES `user_account` (`id`)
            ON UPDATE CASCADE
            ON DELETE CASCADE
) ENGINE = InnoDB
  DEFAULT CHARSET = utf8mb4
  COLLATE = utf8mb4_unicode_ci COMMENT ='通用分享链接表';