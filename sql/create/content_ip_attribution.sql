CREATE TABLE `content_ip_attribution`
(
    `id`               BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT 'IP属地记录ID',
    `target_type`      VARCHAR(50)     NOT NULL COMMENT '目标类型：media_asset / post',
    `target_id`        BIGINT UNSIGNED NOT NULL COMMENT '目标对象ID',
    `action_type`      VARCHAR(30)     NOT NULL DEFAULT 'create' COMMENT '动作类型：create / upload / direct_upload_complete',
    `user_id`          BIGINT UNSIGNED NOT NULL COMMENT '触发动作的用户ID',
    `ip_hash`          CHAR(64)                 DEFAULT NULL COMMENT 'HMAC-SHA256 后的IP，不存明文',
    `ip_version`       TINYINT                  DEFAULT NULL COMMENT 'IP版本：4 / 6',
    `country`          VARCHAR(80)              DEFAULT NULL COMMENT '国家或地区',
    `province`         VARCHAR(80)              DEFAULT NULL COMMENT '省/州/自治区',
    `city`             VARCHAR(80)              DEFAULT NULL COMMENT '城市',
    `district`         VARCHAR(80)              DEFAULT NULL COMMENT '区县',
    `isp`              VARCHAR(80)              DEFAULT NULL COMMENT '运营商',
    `display_location` VARCHAR(120)             DEFAULT NULL COMMENT '展示文案，如：中国 · 上海',
    `provider`         VARCHAR(50)              DEFAULT NULL COMMENT '解析来源：static / ip2region / provider name',
    `provider_version` VARCHAR(80)              DEFAULT NULL COMMENT '解析库或供应商版本',
    `resolved_at`      DATETIME                 DEFAULT NULL COMMENT '解析时间',
    `created_at`       DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    `updated_at`       DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    PRIMARY KEY (`id`),
    UNIQUE KEY `uk_content_ip_target_action` (`target_type`, `target_id`, `action_type`),
    KEY `idx_content_ip_user_created` (`user_id`, `created_at`),
    KEY `idx_content_ip_location` (`country`, `province`, `city`)
) ENGINE = InnoDB
  DEFAULT CHARSET = utf8mb4
  COLLATE = utf8mb4_unicode_ci COMMENT ='内容IP属地快照表';
