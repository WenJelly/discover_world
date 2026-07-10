CREATE TABLE `entity_stat`
(
    `id`             BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '统计ID',
    `target_type`    VARCHAR(50)     NOT NULL COMMENT '目标类型：media_asset / post / album / comment_record / user_profile',
    `target_id`      BIGINT UNSIGNED NOT NULL COMMENT '目标对象ID',
    `view_count`     BIGINT UNSIGNED NOT NULL DEFAULT 0 COMMENT '浏览数',
    `reaction_count` BIGINT UNSIGNED NOT NULL DEFAULT 0 COMMENT '互动数，如点赞数',
    `favorite_count` BIGINT UNSIGNED NOT NULL DEFAULT 0 COMMENT '收藏数',
    `comment_count`  BIGINT UNSIGNED NOT NULL DEFAULT 0 COMMENT '评论数',
    `share_count`    BIGINT UNSIGNED NOT NULL DEFAULT 0 COMMENT '分享数',
    `download_count` BIGINT UNSIGNED NOT NULL DEFAULT 0 COMMENT '下载数',
    `created_at`     DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    `updated_at`     DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    PRIMARY KEY (`id`),
    UNIQUE KEY `uk_entity_stat_target` (`target_type`, `target_id`),
    KEY `idx_entity_stat_target_type` (`target_type`),
    KEY `idx_entity_stat_view_count` (`view_count`),
    KEY `idx_entity_stat_reaction_count` (`reaction_count`),
    KEY `idx_entity_stat_favorite_count` (`favorite_count`),
    KEY `idx_entity_stat_created_at` (`created_at`)
) ENGINE = InnoDB
  DEFAULT CHARSET = utf8mb4
  COLLATE = utf8mb4_unicode_ci COMMENT ='通用统计表';