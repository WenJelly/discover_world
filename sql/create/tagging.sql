CREATE TABLE `tagging`
(
    `id`          BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '标签关联ID',
    `tag_id`      BIGINT UNSIGNED NOT NULL COMMENT '标签ID',
    `target_type` VARCHAR(50)     NOT NULL COMMENT '目标类型：media_asset / post / album / user_profile',
    `target_id`   BIGINT UNSIGNED NOT NULL COMMENT '目标对象ID',
    `source`      VARCHAR(30)     NOT NULL DEFAULT 'user'
        COMMENT '标签来源：user用户 / system系统 / ai机器生成',
    `confidence`  DECIMAL(5, 4)            DEFAULT NULL COMMENT 'AI标签置信度，范围0-1',
    `created_at`  DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    PRIMARY KEY (`id`),
    UNIQUE KEY `uk_tagging_tag_target` (`tag_id`, `target_type`, `target_id`),
    KEY `idx_tagging_target` (`target_type`, `target_id`),
    KEY `idx_tagging_tag_id` (`tag_id`),
    KEY `idx_tagging_source` (`source`),
    CONSTRAINT `fk_tagging_tag`
        FOREIGN KEY (`tag_id`) REFERENCES `tag` (`id`)
            ON UPDATE CASCADE
            ON DELETE CASCADE
) ENGINE = InnoDB
  DEFAULT CHARSET = utf8mb4
  COLLATE = utf8mb4_unicode_ci COMMENT ='通用标签关联表';